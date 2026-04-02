import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";
import { CerrarSesionSchema } from "@/types/api";
import { appendAuditLog } from "@/lib/audit";
import { enviarAlerta } from "@/lib/alertas/n8n-webhook";
import { MIN_DURACION_SESION_SEGUNDOS } from "@/lib/constants";

// POST — Close a session
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(["dueno", "bodeguero"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = CerrarSesionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", detalles: parsed.error.issues },
      { status: 400 }
    );
  }

  const sesion = await prisma.sesionDevolucion.findUnique({
    where: { id: params.id },
    include: {
      lineas: { include: { producto: true } },
      conductor: true,
    },
  });

  if (!sesion) {
    return NextResponse.json(
      { error: "Sesion no encontrada" },
      { status: 404 }
    );
  }

  if (sesion.estado !== "abierta") {
    return NextResponse.json(
      { error: "Sesion ya fue cerrada" },
      { status: 409 }
    );
  }

  // Only the assigned bodeguero can close
  if (sesion.bodegueroId !== auth.user.id) {
    return NextResponse.json(
      { error: "Solo el bodeguero asignado puede cerrar esta sesion" },
      { status: 403 }
    );
  }

  // VALIDATION 1: Video is mandatory (unless camera went offline)
  if (!sesion.videoUrl && !sesion.camaraOffline) {
    return NextResponse.json(
      { error: "Video obligatorio para cerrar la sesion. Espere a que el video se suba." },
      { status: 400 }
    );
  }

  // VALIDATION 2: Minimum session duration
  const duracionMs = Date.now() - sesion.creadoEn.getTime();
  if (duracionMs < MIN_DURACION_SESION_SEGUNDOS * 1000) {
    return NextResponse.json(
      {
        error: `La sesion debe durar al menos ${MIN_DURACION_SESION_SEGUNDOS} segundos`,
      },
      { status: 400 }
    );
  }

  // Update product states if provided
  if (parsed.data.lineas) {
    for (const lineaUpdate of parsed.data.lineas) {
      await prisma.lineaDevolucion.update({
        where: { id: lineaUpdate.lineaId },
        data: { estadoProducto: lineaUpdate.estadoProducto },
      });
    }
  }

  // Determine discrepancies
  const lineasConDiscrepancia = sesion.lineas.filter(
    (l) => l.cantidadDetectada !== l.cantidadDeclarada
  );
  const hayDiscrepancia = lineasConDiscrepancia.length > 0;

  // Close session + mark turno as completed in transaction
  await prisma.$transaction(async (tx) => {
    await tx.sesionDevolucion.update({
      where: { id: params.id },
      data: {
        estado: "cerrada",
        cerradoEn: new Date(),
        notas: parsed.data.notas ?? sesion.notas,
      },
    });

    await tx.colaTurno.update({
      where: { id: sesion.turnoId },
      data: {
        estado: "completado",
        fechaFin: new Date(),
      },
    });

    // Adjust inventory for lines marked as "bueno"
    const lineasActualizadas = parsed.data.lineas ?? [];
    for (const lineaUpdate of lineasActualizadas) {
      if (lineaUpdate.estadoProducto === "bueno") {
        const linea = sesion.lineas.find((l) => l.id === lineaUpdate.lineaId);
        if (linea && linea.cantidadDetectada > 0) {
          await tx.inventario.upsert({
            where: { productoId: linea.productoId },
            create: {
              productoId: linea.productoId,
              stockActual: linea.cantidadDetectada,
            },
            update: {
              stockActual: { increment: linea.cantidadDetectada },
            },
          });

          await tx.movimientoInventario.create({
            data: {
              inventarioId: (
                await tx.inventario.findUnique({
                  where: { productoId: linea.productoId },
                })
              )!.id,
              tipo: "entrada_devolucion",
              cantidad: linea.cantidadDetectada,
              referencia: params.id,
            },
          });
        }
      }
    }
  });

  // If discrepancy, alert owner
  if (hayDiscrepancia) {
    await prisma.alerta.create({
      data: {
        sesionId: params.id,
        tipo: "exceso_cantidad",
        mensaje: `Discrepancia en sesión de ${sesion.conductor.nombre}: ${lineasConDiscrepancia.length} líneas con diferencia`,
        enviada: true,
        enviadaEn: new Date(),
      },
    });

    await enviarAlerta({
      tipo: "exceso_cantidad",
      sesionId: params.id,
      conductorNombre: sesion.conductor.nombre,
      conductorCedula: sesion.conductor.cedula,
      tienda: sesion.tienda,
      mensaje: `Sesión cerrada con discrepancias — ${sesion.conductor.nombre}`,
      detalleLineas: lineasConDiscrepancia.map((l) => ({
        producto: l.producto.nombre,
        declarada: l.cantidadDeclarada,
        detectada: l.cantidadDetectada,
      })),
    });
  }

  // Alert if camera was offline
  if (sesion.camaraOffline && !sesion.videoUrl) {
    await prisma.alerta.create({
      data: {
        sesionId: params.id,
        tipo: "sesion_sin_video",
        mensaje: `Sesión de ${sesion.conductor.nombre} cerrada SIN video`,
        enviada: true,
        enviadaEn: new Date(),
      },
    });
  }

  await appendAuditLog({
    usuarioId: auth.user.id,
    accion: "sesion.cerrada",
    entidad: "SesionDevolucion",
    entidadId: params.id,
    detalle: {
      hayDiscrepancia,
      lineasConDiscrepancia: lineasConDiscrepancia.length,
      camaraOffline: sesion.camaraOffline,
      tieneVideo: !!sesion.videoUrl,
    },
  });

  return NextResponse.json({
    ok: true,
    hayDiscrepancia,
    lineasConDiscrepancia: lineasConDiscrepancia.length,
  });
}

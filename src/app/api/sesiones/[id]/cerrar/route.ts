import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";
import { CerrarSesionSchema } from "@/types/api";
import { appendAuditLog } from "@/lib/audit";
import { enviarAlerta } from "@/lib/alertas/n8n-webhook";
import { generarNotaCredito } from "@/lib/nota-credito";
import { MIN_DURACION_SESION_SEGUNDOS } from "@/lib/constants";

// POST — Close or reject a session
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
    return NextResponse.json({ error: "Sesion no encontrada" }, { status: 404 });
  }

  if (sesion.estado !== "abierta") {
    return NextResponse.json({ error: "Sesion ya fue cerrada" }, { status: 409 });
  }

  if (sesion.bodegueroId !== auth.user.id && auth.user.rol !== "dueno") {
    return NextResponse.json(
      { error: "Solo el bodeguero asignado o el dueno puede cerrar esta sesion" },
      { status: 403 }
    );
  }

  // ─── P1: REJECT entire session ─────────────────────────
  if (parsed.data.rechazarSesion) {
    await prisma.$transaction(async (tx) => {
      await tx.sesionDevolucion.update({
        where: { id: params.id },
        data: {
          estado: "rechazada",
          cerradoEn: new Date(),
          notas: parsed.data.motivoRechazoSesion ?? "Devolucion rechazada en dock",
          firmaConductor: parsed.data.firmaConductor ?? null,
          firmaBodeguero: parsed.data.firmaBodeguero ?? null,
          firmaTimestamp: parsed.data.firmaConductor ? new Date() : null,
        },
      });

      await tx.colaTurno.update({
        where: { id: sesion.turnoId },
        data: { estado: "completado", fechaFin: new Date() },
      });
    });

    await prisma.alerta.create({
      data: {
        sesionId: params.id,
        tipo: "devolucion_rechazada",
        mensaje: `Devolucion rechazada: ${sesion.conductor.nombre} — ${parsed.data.motivoRechazoSesion ?? "Sin motivo"}`,
        enviada: true,
        enviadaEn: new Date(),
      },
    });

    await enviarAlerta({
      tipo: "devolucion_rechazada",
      sesionId: params.id,
      conductorNombre: sesion.conductor.nombre,
      conductorCedula: sesion.conductor.cedula,
      tienda: sesion.tienda,
      mensaje: `DEVOLUCION RECHAZADA: ${sesion.conductor.nombre} — ${parsed.data.motivoRechazoSesion ?? ""}`,
    });

    await appendAuditLog({
      usuarioId: auth.user.id,
      accion: "sesion.rechazada",
      entidad: "SesionDevolucion",
      entidadId: params.id,
      detalle: { motivo: parsed.data.motivoRechazoSesion },
    });

    return NextResponse.json({ ok: true, estado: "rechazada" });
  }

  // ─── NORMAL CLOSE FLOW ─────────────────────────────────

  // Validation: Video mandatory
  if (!sesion.videoUrl && !sesion.camaraOffline) {
    return NextResponse.json(
      { error: "Video obligatorio para cerrar la sesion." },
      { status: 400 }
    );
  }

  // Validation: Minimum duration
  const duracionMs = Date.now() - sesion.creadoEn.getTime();
  if (duracionMs < MIN_DURACION_SESION_SEGUNDOS * 1000) {
    return NextResponse.json(
      { error: `La sesion debe durar al menos ${MIN_DURACION_SESION_SEGUNDOS} segundos` },
      { status: 400 }
    );
  }

  // ─── Update lines with estado, temperatura, rechazo ────
  let valorTotalDetectado = 0;

  if (parsed.data.lineas) {
    for (const lineaUpdate of parsed.data.lineas) {
      const linea = sesion.lineas.find((l) => l.id === lineaUpdate.lineaId);
      if (!linea) continue;

      const valorLinea = linea.cantidadDetectada * linea.producto.precioCosto;
      valorTotalDetectado += lineaUpdate.rechazada ? 0 : valorLinea;

      // P1: Check temperatura for refrigerados
      let cadenaFrioOk = lineaUpdate.cadenaFrioOk ?? null;
      if (
        linea.producto.refrigerado &&
        lineaUpdate.temperaturaRegistrada != null &&
        linea.producto.temperaturaMaxima != null
      ) {
        cadenaFrioOk = lineaUpdate.temperaturaRegistrada <= linea.producto.temperaturaMaxima;

        if (!cadenaFrioOk) {
          await prisma.alerta.create({
            data: {
              sesionId: params.id,
              tipo: "cadena_frio_rota",
              mensaje: `${linea.producto.nombre}: ${lineaUpdate.temperaturaRegistrada}°C > max ${linea.producto.temperaturaMaxima}°C`,
              enviada: true,
              enviadaEn: new Date(),
            },
          });
        }
      }

      await prisma.lineaDevolucion.update({
        where: { id: lineaUpdate.lineaId },
        data: {
          estadoProducto: lineaUpdate.estadoProducto,
          temperaturaRegistrada: lineaUpdate.temperaturaRegistrada ?? null,
          cadenaFrioOk,
          rechazada: lineaUpdate.rechazada ?? false,
          motivoRechazo: lineaUpdate.motivoRechazo ?? null,
          valorUnitario: linea.producto.precioCosto,
          valorTotalLinea: valorLinea,
        },
      });
    }
  }

  // Calculate totals
  const valorTotalDeclarado = sesion.lineas.reduce(
    (sum, l) => sum + l.cantidadDeclarada * l.producto.precioCosto,
    0
  );

  const lineasConDiscrepancia = sesion.lineas.filter(
    (l) => l.cantidadDetectada !== l.cantidadDeclarada
  );
  const hayDiscrepancia = lineasConDiscrepancia.length > 0;

  // ─── Transaction: close session + turno + inventory ────
  await prisma.$transaction(async (tx) => {
    await tx.sesionDevolucion.update({
      where: { id: params.id },
      data: {
        estado: "cerrada",
        cerradoEn: new Date(),
        notas: parsed.data.notas ?? sesion.notas,
        firmaConductor: parsed.data.firmaConductor ?? null,
        firmaBodeguero: parsed.data.firmaBodeguero ?? null,
        firmaTimestamp: parsed.data.firmaConductor ? new Date() : null,
        valorTotalDeclarado,
        valorTotalDetectado,
      },
    });

    await tx.colaTurno.update({
      where: { id: sesion.turnoId },
      data: { estado: "completado", fechaFin: new Date() },
    });

    // Inventory adjustment for "bueno" products
    const lineasActualizadas = parsed.data.lineas ?? [];
    for (const lu of lineasActualizadas) {
      if (lu.estadoProducto === "bueno" && !lu.rechazada) {
        const linea = sesion.lineas.find((l) => l.id === lu.lineaId);
        if (linea && linea.cantidadDetectada > 0) {
          await tx.inventario.upsert({
            where: { productoId: linea.productoId },
            create: { productoId: linea.productoId, stockActual: linea.cantidadDetectada },
            update: { stockActual: { increment: linea.cantidadDetectada } },
          });

          const inv = await tx.inventario.findUnique({
            where: { productoId: linea.productoId },
          });
          if (inv) {
            await tx.movimientoInventario.create({
              data: {
                inventarioId: inv.id,
                tipo: "entrada_devolucion",
                cantidad: linea.cantidadDetectada,
                referencia: params.id,
              },
            });
          }
        }
      }
    }
  });

  // ─── Discrepancy alert ─────────────────────────────────
  if (hayDiscrepancia) {
    const valorEnRiesgo = Math.abs(valorTotalDetectado - valorTotalDeclarado);

    await prisma.alerta.create({
      data: {
        sesionId: params.id,
        tipo: "exceso_cantidad",
        mensaje: `Discrepancia: ${sesion.conductor.nombre} — ${lineasConDiscrepancia.length} lineas, COP $${valorEnRiesgo.toLocaleString()} en riesgo`,
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
      mensaje: `Sesion cerrada con discrepancias — COP $${valorEnRiesgo.toLocaleString()} en riesgo`,
      detalleLineas: lineasConDiscrepancia.map((l) => ({
        producto: l.producto.nombre,
        declarada: l.cantidadDeclarada,
        detectada: l.cantidadDetectada,
      })),
    });
  }

  // ─── P2: Auto-generate nota credito draft ──────────────
  let notaCredito = null;
  try {
    notaCredito = await generarNotaCredito(params.id, auth.user.id);
  } catch {
    // Non-blocking — nota credito generation failure shouldn't block close
  }

  await appendAuditLog({
    usuarioId: auth.user.id,
    accion: "sesion.cerrada",
    entidad: "SesionDevolucion",
    entidadId: params.id,
    detalle: {
      hayDiscrepancia,
      lineasConDiscrepancia: lineasConDiscrepancia.length,
      valorTotalDeclarado,
      valorTotalDetectado,
      tieneVideo: !!sesion.videoUrl,
      tieneFirma: !!parsed.data.firmaConductor,
      notaCreditoId: notaCredito?.id ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    hayDiscrepancia,
    lineasConDiscrepancia: lineasConDiscrepancia.length,
    valorTotalDeclarado,
    valorTotalDetectado,
    notaCreditoId: notaCredito?.id ?? null,
    notaCreditoNumero: notaCredito?.numero ?? null,
  });
}

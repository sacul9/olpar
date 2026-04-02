import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";
import { isUniqueConstraintError } from "@/lib/scanner/idempotency";
import { appendAuditLog } from "@/lib/audit";
import { enviarAlerta } from "@/lib/alertas/n8n-webhook";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/scanner/scan-from-ui
 * Same as /api/scanner/item but authenticated via Supabase session (for USB barcode gun).
 * The bodeguero/dueno scans with a USB gun connected to the tablet.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(["dueno", "bodeguero"]);
  if (auth.error) return auth.error;

  const allowed = await checkRateLimit(`ui-scan:${auth.user.id}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit excedido" },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { codigoBarras, sesionId } = body;

  if (!codigoBarras || !sesionId) {
    return NextResponse.json(
      { error: "codigoBarras y sesionId requeridos" },
      { status: 400 }
    );
  }

  // Generate idempotency key server-side
  const idempotencyKey = crypto.randomUUID();

  // Verify session
  const sesion = await prisma.sesionDevolucion.findUnique({
    where: { id: sesionId },
    include: {
      lineas: { include: { producto: true } },
      conductor: true,
    },
  });

  if (!sesion || sesion.estado !== "abierta") {
    return NextResponse.json(
      { error: "Sesion no activa" },
      { status: 409 }
    );
  }

  // Look up product
  const producto = await prisma.producto.findUnique({
    where: { codigoBarras },
  });

  // Find matching line
  const lineaMatch = sesion.lineas.find(
    (l) => l.producto.codigoBarras === codigoBarras
  );

  // Create ItemDetectado
  try {
    await prisma.itemDetectado.create({
      data: {
        sesionId,
        productoId: producto?.id ?? null,
        codigoBarras,
        reconocido: !!producto,
        idempotencyKey,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ ok: true, duplicado: true });
    }
    throw error;
  }

  // Increment count if line exists
  let cantidadDetectada = 0;
  let exceso = false;

  if (lineaMatch) {
    const updated = await prisma.lineaDevolucion.update({
      where: { id: lineaMatch.id },
      data: { cantidadDetectada: { increment: 1 } },
    });
    cantidadDetectada = updated.cantidadDetectada;
    exceso = cantidadDetectada > updated.cantidadDeclarada;

    if (exceso) {
      await prisma.alerta.create({
        data: {
          sesionId,
          tipo: "exceso_cantidad",
          mensaje: `EXCESO: ${lineaMatch.producto.nombre} ${cantidadDetectada}/${updated.cantidadDeclarada}`,
          enviada: true,
          enviadaEn: new Date(),
        },
      });

      await enviarAlerta({
        tipo: "exceso_cantidad",
        sesionId,
        conductorNombre: sesion.conductor.nombre,
        conductorCedula: sesion.conductor.cedula,
        tienda: sesion.tienda,
        mensaje: `EXCESO: ${lineaMatch.producto.nombre} ${cantidadDetectada}/${updated.cantidadDeclarada}`,
        detalleLineas: [{
          producto: lineaMatch.producto.nombre,
          declarada: updated.cantidadDeclarada,
          detectada: cantidadDetectada,
        }],
      });
    }
  }

  await appendAuditLog({
    usuarioId: auth.user.id,
    accion: "scan.pistola_ui",
    entidad: "ItemDetectado",
    entidadId: sesionId,
    detalle: { codigoBarras, reconocido: !!producto, cantidadDetectada, exceso },
  });

  return NextResponse.json({
    ok: true,
    duplicado: false,
    reconocido: !!producto,
    productoId: producto?.id ?? null,
    productoNombre: producto?.nombre ?? null,
    productoImagen: producto?.imagenUrl ?? null,
    productoRefrigerado: producto?.refrigerado ?? false,
    cantidadDetectada,
    cantidadDeclarada: lineaMatch?.cantidadDeclarada ?? null,
    exceso,
    lineaId: lineaMatch?.id ?? null,
    noDeclarado: !lineaMatch && !!producto,
  });
}

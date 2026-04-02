import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/auth/require-api-key";
import { isUniqueConstraintError } from "@/lib/scanner/idempotency";
import { appendAuditLog } from "@/lib/audit";
import { ScannerItemSchema } from "@/types/api";
import { enviarAlerta } from "@/lib/alertas/n8n-webhook";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // 1. Verify RPi API key
  const authError = requireApiKey(request);
  if (authError) return authError;

  // 1b. Rate limiting
  const apiKey = request.headers.get("x-api-key") ?? "unknown";
  const allowed = await checkRateLimit(`scanner:${apiKey}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit excedido. Maximo 120 requests/minuto." },
      { status: 429 }
    );
  }

  // 2. Parse and validate body
  const body = await request.json();
  const parsed = ScannerItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", detalles: parsed.error.issues },
      { status: 400 }
    );
  }

  const { codigoBarras, idempotencyKey, sesionId, screenshotBase64 } =
    parsed.data;

  // 3. Verify session exists and is open
  const sesion = await prisma.sesionDevolucion.findUnique({
    where: { id: sesionId },
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
      { error: "Sesion no esta activa" },
      { status: 409 }
    );
  }

  // 4. Look up product by barcode
  const producto = await prisma.producto.findUnique({
    where: { codigoBarras },
  });

  // 5. Find matching line in this session
  const lineaMatch = sesion.lineas.find(
    (l) => l.producto.codigoBarras === codigoBarras
  );

  // 6. Upload screenshot if provided
  let screenshotUrl: string | undefined;
  if (screenshotBase64) {
    try {
      const { supabaseAdmin } = await import("@/lib/supabase/admin");
      const buffer = Buffer.from(screenshotBase64, "base64");
      const path = `screenshots/${sesionId}/${idempotencyKey}.jpg`;
      await supabaseAdmin.storage
        .from("evidencia")
        .upload(path, buffer, { contentType: "image/jpeg" });
      screenshotUrl = path;
    } catch {
      // Screenshot upload failure is non-blocking
    }
  }

  // 7. Create ItemDetectado with idempotency
  try {
    await prisma.itemDetectado.create({
      data: {
        sesionId,
        productoId: producto?.id ?? null,
        codigoBarras,
        reconocido: !!producto,
        idempotencyKey,
        screenshotUrl: screenshotUrl ?? null,
        confianza: null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      // Idempotent — RPi retried and this item was already registered
      return NextResponse.json({
        ok: true,
        duplicado: true,
        mensaje: "Item ya registrado",
      });
    }
    throw error;
  }

  // 8. If product matches a declared line, atomically increment count
  let cantidadDetectada = 0;
  let exceso = false;

  if (lineaMatch) {
    const updated = await prisma.lineaDevolucion.update({
      where: { id: lineaMatch.id },
      data: {
        cantidadDetectada: { increment: 1 },
      },
    });

    cantidadDetectada = updated.cantidadDetectada;
    exceso = cantidadDetectada > updated.cantidadDeclarada;

    // 9. If detected > declared → IMMEDIATE alert to owner
    if (exceso) {
      await enviarAlerta({
        tipo: "exceso_cantidad",
        sesionId,
        conductorNombre: sesion.conductor.nombre,
        conductorCedula: sesion.conductor.cedula,
        tienda: sesion.tienda,
        mensaje: `ALERTA: ${sesion.conductor.nombre} declaró ${updated.cantidadDeclarada} unidades de ${lineaMatch.producto.nombre} pero se detectaron ${cantidadDetectada}`,
        detalleLineas: [
          {
            producto: lineaMatch.producto.nombre,
            declarada: updated.cantidadDeclarada,
            detectada: cantidadDetectada,
          },
        ],
      });

      // Create alert record
      await prisma.alerta.create({
        data: {
          sesionId,
          tipo: "exceso_cantidad",
          mensaje: `Detectadas ${cantidadDetectada}/${updated.cantidadDeclarada} unidades de ${lineaMatch.producto.nombre}`,
          enviada: true,
          enviadaEn: new Date(),
        },
      });
    }
  }

  // 10. Audit log
  await appendAuditLog({
    accion: "item.detectado",
    entidad: "ItemDetectado",
    entidadId: sesionId,
    detalle: {
      codigoBarras,
      reconocido: !!producto,
      productoNombre: producto?.nombre ?? null,
      lineaId: lineaMatch?.id ?? null,
      cantidadDetectada,
      exceso,
    },
  });

  return NextResponse.json({
    ok: true,
    duplicado: false,
    reconocido: !!producto,
    productoNombre: producto?.nombre ?? null,
    cantidadDetectada,
    exceso,
    alerta: exceso ? "exceso_cantidad" : null,
  });
}

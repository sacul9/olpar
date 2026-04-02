import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/auth/require-api-key";
import { appendAuditLog } from "@/lib/audit";
import { ScannerVideoListoSchema } from "@/types/api";

export async function POST(request: NextRequest) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const body = await request.json();
  const parsed = ScannerVideoListoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", detalles: parsed.error.issues },
      { status: 400 }
    );
  }

  const { sesionId, storagePath } = parsed.data;

  const sesion = await prisma.sesionDevolucion.findUnique({
    where: { id: sesionId },
  });

  if (!sesion) {
    return NextResponse.json(
      { error: "Sesion no encontrada" },
      { status: 404 }
    );
  }

  // Only the RPi can set videoUrl — this is the sole write path
  await prisma.sesionDevolucion.update({
    where: { id: sesionId },
    data: {
      videoUrl: storagePath,
      videoSubidoEn: new Date(),
    },
  });

  await appendAuditLog({
    accion: "video.subido",
    entidad: "SesionDevolucion",
    entidadId: sesionId,
    detalle: { storagePath },
  });

  return NextResponse.json({ ok: true });
}

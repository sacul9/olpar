import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/auth/require-api-key";
import { appendAuditLog } from "@/lib/audit";
import { enviarAlerta } from "@/lib/alertas/n8n-webhook";

export async function POST(request: NextRequest) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const body = await request.json();
  const { sesionId } = body;

  if (!sesionId || typeof sesionId !== "string") {
    return NextResponse.json(
      { error: "sesionId requerido" },
      { status: 400 }
    );
  }

  const sesion = await prisma.sesionDevolucion.findUnique({
    where: { id: sesionId },
    include: { conductor: true },
  });

  if (!sesion) {
    return NextResponse.json(
      { error: "Sesion no encontrada" },
      { status: 404 }
    );
  }

  // Mark session as camera offline
  await prisma.sesionDevolucion.update({
    where: { id: sesionId },
    data: { camaraOffline: true },
  });

  // Create alert record
  await prisma.alerta.create({
    data: {
      sesionId,
      tipo: "camara_offline",
      mensaje: `Cámara offline durante sesión de ${sesion.conductor.nombre}`,
      enviada: true,
      enviadaEn: new Date(),
    },
  });

  // Send immediate alert to owner
  await enviarAlerta({
    tipo: "camara_offline",
    sesionId,
    conductorNombre: sesion.conductor.nombre,
    conductorCedula: sesion.conductor.cedula,
    tienda: sesion.tienda,
    mensaje: `ALERTA CRITICA: Cámara offline durante sesión de ${sesion.conductor.nombre} en tienda ${sesion.tienda}`,
  });

  await appendAuditLog({
    accion: "camara.offline",
    entidad: "SesionDevolucion",
    entidadId: sesionId,
    detalle: { conductorId: sesion.conductorId },
  });

  return NextResponse.json({ ok: true });
}

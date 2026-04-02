import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";
import { appendAuditLog } from "@/lib/audit";

// POST — Call next in queue (FIFO strictly enforced)
export async function POST() {
  const auth = await requireRole(["dueno", "bodeguero"]);
  if (auth.error) return auth.error;

  // Check no one is currently being attended
  const enAtencion = await prisma.colaTurno.findFirst({
    where: { estado: "en_atencion" },
  });

  if (enAtencion) {
    return NextResponse.json(
      { error: "Ya hay un turno en atencion. Cierre la sesion actual primero." },
      { status: 409 }
    );
  }

  // FIFO: get the oldest waiting turn
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const siguiente = await prisma.colaTurno.findFirst({
    where: {
      estado: "esperando",
      fechaRegistro: { gte: today },
    },
    orderBy: { fechaRegistro: "asc" },
    include: { conductor: true },
  });

  if (!siguiente) {
    return NextResponse.json(
      { error: "No hay conductores esperando" },
      { status: 404 }
    );
  }

  // Mark as en_atencion
  const updated = await prisma.colaTurno.update({
    where: { id: siguiente.id },
    data: {
      estado: "en_atencion",
      fechaLlamado: new Date(),
    },
    include: { conductor: true },
  });

  await appendAuditLog({
    usuarioId: auth.user.id,
    accion: "turno.llamado",
    entidad: "ColaTurno",
    entidadId: updated.id,
    detalle: {
      conductorId: updated.conductorId,
      numeroTurno: updated.numeroTurno,
    },
  });

  return NextResponse.json(updated);
}

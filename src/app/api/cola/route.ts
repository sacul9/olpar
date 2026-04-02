import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";
import { RegistrarTurnoSchema } from "@/types/api";
import { appendAuditLog } from "@/lib/audit";

// GET — List today's queue
export async function GET() {
  const auth = await requireRole(["dueno", "gerente", "bodeguero"]);
  if (auth.error) return auth.error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cola = await prisma.colaTurno.findMany({
    where: {
      fechaRegistro: { gte: today },
    },
    include: { conductor: true },
    orderBy: { fechaRegistro: "asc" },
  });

  return NextResponse.json(cola);
}

// POST — Register a new turn
export async function POST(request: NextRequest) {
  const auth = await requireRole(["dueno", "gerente", "bodeguero"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = RegistrarTurnoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", detalles: parsed.error.issues },
      { status: 400 }
    );
  }

  const { conductorId } = parsed.data;

  // Verify conductor exists and is active
  const conductor = await prisma.conductor.findUnique({
    where: { id: conductorId },
  });

  if (!conductor || !conductor.activo) {
    return NextResponse.json(
      { error: "Conductor no encontrado o inactivo" },
      { status: 404 }
    );
  }

  // Check conductor is not already in queue today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.colaTurno.findFirst({
    where: {
      conductorId,
      fechaRegistro: { gte: today },
      estado: { in: ["esperando", "en_atencion"] },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Conductor ya tiene turno activo hoy" },
      { status: 409 }
    );
  }

  // Get next turn number for today
  const lastTurno = await prisma.colaTurno.findFirst({
    where: { fechaRegistro: { gte: today } },
    orderBy: { numeroTurno: "desc" },
  });

  const numeroTurno = (lastTurno?.numeroTurno ?? 0) + 1;

  const turno = await prisma.colaTurno.create({
    data: {
      conductorId,
      numeroTurno,
      estado: "esperando",
    },
    include: { conductor: true },
  });

  await appendAuditLog({
    usuarioId: auth.user.id,
    accion: "turno.registrado",
    entidad: "ColaTurno",
    entidadId: turno.id,
    detalle: { conductorId, numeroTurno },
  });

  // Count waiting ahead
  const esperandoAntes = await prisma.colaTurno.count({
    where: {
      fechaRegistro: { gte: today },
      estado: "esperando",
      numeroTurno: { lt: numeroTurno },
    },
  });

  return NextResponse.json({
    turno,
    posicion: esperandoAntes + 1,
  });
}

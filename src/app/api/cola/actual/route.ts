import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";

// GET — Current turn being attended
export async function GET() {
  const auth = await requireRole(["dueno", "gerente", "bodeguero"]);
  if (auth.error) return auth.error;

  const turnoActual = await prisma.colaTurno.findFirst({
    where: { estado: "en_atencion" },
    include: { conductor: true },
  });

  return NextResponse.json(turnoActual);
}

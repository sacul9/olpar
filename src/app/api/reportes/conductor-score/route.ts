import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";

// GET — Driver scores
export async function GET(request: NextRequest) {
  const auth = await requireRole(["dueno"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const conductorId = searchParams.get("conductorId");

  const where: Record<string, unknown> = {};
  if (conductorId) where.conductorId = conductorId;

  const scores = await prisma.conductorScore.findMany({
    where,
    include: { conductor: true },
    orderBy: [{ semana: "desc" }, { porcentajeExactitud: "asc" }],
    take: 50,
  });

  return NextResponse.json(scores);
}

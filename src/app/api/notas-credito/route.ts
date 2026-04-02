import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";

// GET — List notas credito
export async function GET(request: NextRequest) {
  const auth = await requireRole(["dueno", "gerente"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  const tienda = searchParams.get("tienda");

  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;
  if (tienda) where.tienda = { contains: tienda, mode: "insensitive" };

  const notas = await prisma.notaCredito.findMany({
    where,
    include: { sesion: { include: { conductor: true } } },
    orderBy: { creadoEn: "desc" },
    take: 100,
  });

  return NextResponse.json(notas);
}

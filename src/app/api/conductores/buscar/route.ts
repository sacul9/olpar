import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";

// GET — Search conductors by name or cedula
export async function GET(request: NextRequest) {
  const auth = await requireRole(["dueno", "gerente", "bodeguero"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const conductores = await prisma.conductor.findMany({
    where: {
      activo: true,
      OR: [
        { nombre: { contains: q, mode: "insensitive" } },
        { cedula: { contains: q } },
      ],
    },
    select: { id: true, nombre: true, cedula: true, placa: true, ruta: true },
    take: 10,
  });

  return NextResponse.json(conductores);
}

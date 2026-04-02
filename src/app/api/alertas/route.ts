import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";

// GET — List alerts (owner and gerente only)
export async function GET(request: NextRequest) {
  const auth = await requireRole(["dueno", "gerente"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const fecha = searchParams.get("fecha");
  const tipo = searchParams.get("tipo");
  const resuelta = searchParams.get("resuelta");

  const where: Record<string, unknown> = {};

  if (fecha) {
    const start = new Date(fecha);
    const end = new Date(fecha);
    end.setDate(end.getDate() + 1);
    where.creadoEn = { gte: start, lt: end };
  }

  if (tipo) {
    where.tipo = tipo;
  }

  if (resuelta === "true") {
    where.resueltaEn = { not: null };
  } else if (resuelta === "false") {
    where.resueltaEn = null;
  }

  const alertas = await prisma.alerta.findMany({
    where,
    include: {
      sesion: {
        include: {
          conductor: true,
          lineas: { include: { producto: true } },
        },
      },
    },
    orderBy: { creadoEn: "desc" },
    take: 100,
  });

  return NextResponse.json(alertas);
}

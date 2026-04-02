import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";

// GET — Daily report
export async function GET(request: NextRequest) {
  const auth = await requireRole(["dueno", "gerente"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const fecha = searchParams.get("fecha") ?? new Date().toISOString().split("T")[0];

  const start = new Date(fecha);
  start.setHours(0, 0, 0, 0);
  const end = new Date(fecha);
  end.setDate(end.getDate() + 1);

  const sesiones = await prisma.sesionDevolucion.findMany({
    where: {
      creadoEn: { gte: start, lt: end },
    },
    include: {
      conductor: true,
      lineas: { include: { producto: true } },
      alertas: true,
    },
    orderBy: { creadoEn: "desc" },
  });

  const totalSesiones = sesiones.length;
  const sesionesOk = sesiones.filter(
    (s) =>
      s.estado === "cerrada" &&
      s.lineas.every((l) => l.cantidadDetectada === l.cantidadDeclarada)
  ).length;
  const sesionesConDiscrepancia = sesiones.filter(
    (s) =>
      s.estado === "cerrada" &&
      s.lineas.some((l) => l.cantidadDetectada !== l.cantidadDeclarada)
  ).length;
  const sesionesAbiertas = sesiones.filter(
    (s) => s.estado === "abierta"
  ).length;

  return NextResponse.json({
    fecha,
    resumen: {
      total: totalSesiones,
      ok: sesionesOk,
      conDiscrepancia: sesionesConDiscrepancia,
      abiertas: sesionesAbiertas,
    },
    sesiones,
  });
}

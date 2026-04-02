import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";

// GET — Get the current open session for this bodeguero
export async function GET() {
  const auth = await requireRole(["dueno", "gerente", "bodeguero"]);
  if (auth.error) return auth.error;

  const sesion = await prisma.sesionDevolucion.findFirst({
    where: {
      estado: "abierta",
      ...(auth.user.rol === "bodeguero"
        ? { bodegueroId: auth.user.id }
        : {}),
    },
    include: {
      lineas: {
        include: { producto: true },
        orderBy: { creadoEn: "asc" },
      },
      conductor: true,
      itemsDetectados: {
        orderBy: { detectadoEn: "desc" },
        take: 20,
        include: { producto: true },
      },
    },
  });

  return NextResponse.json(sesion);
}

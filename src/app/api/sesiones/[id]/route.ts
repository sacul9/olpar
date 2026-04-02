import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";

// GET — Get session by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(["dueno", "gerente", "bodeguero"]);
  if (auth.error) return auth.error;

  const sesion = await prisma.sesionDevolucion.findUnique({
    where: { id: params.id },
    include: {
      lineas: { include: { producto: true } },
      conductor: true,
      alertas: true,
      itemsDetectados: {
        orderBy: { detectadoEn: "desc" },
        include: { producto: true },
      },
    },
  });

  if (!sesion) {
    return NextResponse.json(
      { error: "Sesion no encontrada" },
      { status: 404 }
    );
  }

  // Bodeguero can only see their own open sessions
  if (
    auth.user.rol === "bodeguero" &&
    sesion.bodegueroId !== auth.user.id
  ) {
    return NextResponse.json(
      { error: "No tiene permisos" },
      { status: 403 }
    );
  }

  return NextResponse.json(sesion);
}

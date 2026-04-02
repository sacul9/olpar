import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";

// GET — Export CSV
export async function GET(request: NextRequest) {
  const auth = await requireRole(["dueno"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const where: Record<string, unknown> = {};
  if (desde || hasta) {
    where.creadoEn = {};
    if (desde) (where.creadoEn as Record<string, Date>).gte = new Date(desde);
    if (hasta) {
      const end = new Date(hasta);
      end.setDate(end.getDate() + 1);
      (where.creadoEn as Record<string, Date>).lt = end;
    }
  }

  const sesiones = await prisma.sesionDevolucion.findMany({
    where,
    include: {
      conductor: true,
      lineas: { include: { producto: true } },
      bodeguero: true,
    },
    orderBy: { creadoEn: "desc" },
  });

  // Build CSV
  const header = [
    "Fecha",
    "Conductor",
    "Cedula",
    "Tienda",
    "Producto",
    "Motivo",
    "Declarado",
    "Detectado",
    "Discrepancia",
    "Estado Sesion",
    "Bodeguero",
    "Video",
  ].join(",");

  const rows = sesiones.flatMap((s) =>
    s.lineas.map((l) =>
      [
        s.creadoEn.toISOString().split("T")[0],
        `"${s.conductor.nombre}"`,
        s.conductor.cedula,
        `"${s.tienda}"`,
        `"${l.producto.nombre}"`,
        l.motivo,
        l.cantidadDeclarada,
        l.cantidadDetectada,
        l.cantidadDetectada - l.cantidadDeclarada,
        s.estado,
        `"${s.bodeguero.nombre}"`,
        s.videoUrl ? "Si" : "No",
      ].join(",")
    )
  );

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="devoluciones_${desde ?? "todos"}_${hasta ?? "hoy"}.csv"`,
    },
  });
}

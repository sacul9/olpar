import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";

// GET — Provider portal: read-only view of returns for a specific brand
export async function GET(request: NextRequest) {
  const auth = await requireRole(["dueno", "proveedor"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const marca = searchParams.get("marca");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  if (!marca) {
    return NextResponse.json(
      { error: "Parametro 'marca' requerido" },
      { status: 400 }
    );
  }

  const where: Record<string, unknown> = {
    estado: "cerrada",
    lineas: {
      some: {
        producto: { marca: { equals: marca, mode: "insensitive" } },
      },
    },
  };

  if (desde || hasta) {
    where.cerradoEn = {};
    if (desde) (where.cerradoEn as Record<string, Date>).gte = new Date(desde);
    if (hasta) {
      const end = new Date(hasta);
      end.setDate(end.getDate() + 1);
      (where.cerradoEn as Record<string, Date>).lt = end;
    }
  }

  const sesiones = await prisma.sesionDevolucion.findMany({
    where,
    include: {
      lineas: {
        where: {
          producto: { marca: { equals: marca, mode: "insensitive" } },
        },
        include: { producto: true },
      },
    },
    orderBy: { cerradoEn: "desc" },
    take: 200,
  });

  // Aggregate stats
  const totalSesiones = sesiones.length;
  const totalUnidades = sesiones.reduce(
    (sum, s) => sum + s.lineas.reduce((ls, l) => ls + l.cantidadDetectada, 0),
    0
  );
  const valorTotal = sesiones.reduce(
    (sum, s) => sum + s.lineas.reduce((ls, l) => ls + l.valorTotalLinea, 0),
    0
  );

  return NextResponse.json({
    marca,
    resumen: { totalSesiones, totalUnidades, valorTotal },
    sesiones: sesiones.map((s) => ({
      id: s.id,
      tienda: s.tienda,
      fecha: s.cerradoEn,
      lineas: s.lineas.map((l) => ({
        producto: l.producto.nombre,
        motivo: l.motivo,
        cantidad: l.cantidadDetectada,
        estadoProducto: l.estadoProducto,
        valor: l.valorTotalLinea,
      })),
    })),
  });
}

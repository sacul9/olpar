import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";

// GET — Export accounting CSV (Siigo/World Office compatible)
export async function GET(request: NextRequest) {
  const auth = await requireRole(["dueno"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const where: Record<string, unknown> = {
    estado: { in: ["cerrada", "rechazada"] },
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
      conductor: true,
      bodeguero: true,
      lineas: { include: { producto: true } },
      notaCredito: true,
    },
    orderBy: { cerradoEn: "desc" },
  });

  // CSV format compatible with Siigo import
  const header = [
    "Fecha",
    "Tipo Documento",
    "Numero Documento",
    "NIT/Cedula",
    "Nombre Tercero",
    "Cuenta Contable",
    "Centro Costo",
    "Codigo Producto",
    "Nombre Producto",
    "Cantidad",
    "Valor Unitario",
    "Valor Total",
    "Naturaleza",
    "Descripcion",
  ].join(";"); // Semicolon for Colombian locale

  const rows: string[] = [];

  for (const s of sesiones) {
    for (const l of s.lineas) {
      if (l.rechazada) continue;

      const fecha = s.cerradoEn
        ? s.cerradoEn.toISOString().split("T")[0]
        : "";
      const tipoDoc = s.notaCredito ? "NC" : "DEV";
      const numDoc = s.notaCredito?.numero ?? s.id.slice(0, 12);

      rows.push(
        [
          fecha,
          tipoDoc,
          numDoc,
          s.conductor.cedula,
          `"${s.conductor.nombre}"`,
          l.estadoProducto === "bueno" ? "143505" : "529505", // Inventario vs Gasto
          `"${s.tienda}"`,
          l.producto.codigoBarras,
          `"${l.producto.nombre}"`,
          l.cantidadDetectada,
          l.valorUnitario.toFixed(2),
          l.valorTotalLinea.toFixed(2),
          l.estadoProducto === "bueno" ? "D" : "C", // Debito/Credito
          `"Devolucion ${l.motivo} - ${s.tienda}"`,
        ].join(";")
      );
    }
  }

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contable_${desde ?? "inicio"}_${hasta ?? "hoy"}.csv"`,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";
import { parseAmovilCSV } from "@/lib/csv/amovil-parser";
import { appendAuditLog } from "@/lib/audit";

// POST — Sync products from Amovil CSV
export async function POST(request: NextRequest) {
  const auth = await requireRole(["dueno", "gerente"]);
  if (auth.error) return auth.error;

  const formData = await request.formData();
  const file = formData.get("archivo") as File | null;

  if (!file) {
    return NextResponse.json(
      { error: "Archivo CSV requerido" },
      { status: 400 }
    );
  }

  const text = await file.text();
  const { rows, errors } = parseAmovilCSV(text);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No se encontraron filas validas", errores: errors },
      { status: 400 }
    );
  }

  let creados = 0;
  let actualizados = 0;

  for (const row of rows) {
    const existing = await prisma.producto.findUnique({
      where: { codigoBarras: row.codigoBarras },
    });

    if (existing) {
      await prisma.producto.update({
        where: { codigoBarras: row.codigoBarras },
        data: {
          nombre: row.nombre,
          marca: row.marca,
          unidad: row.unidad,
          skuAmovil: row.skuAmovil || existing.skuAmovil,
        },
      });
      actualizados++;
    } else {
      await prisma.producto.create({
        data: {
          codigoBarras: row.codigoBarras,
          nombre: row.nombre,
          marca: row.marca,
          unidad: row.unidad,
          skuAmovil: row.skuAmovil || null,
        },
      });
      creados++;
    }
  }

  await appendAuditLog({
    usuarioId: auth.user.id,
    accion: "catalogo.sync_csv",
    entidad: "Producto",
    detalle: {
      archivo: file.name,
      totalFilas: rows.length,
      creados,
      actualizados,
      errores: errors.length,
    },
  });

  return NextResponse.json({
    ok: true,
    creados,
    actualizados,
    errores: errors,
  });
}

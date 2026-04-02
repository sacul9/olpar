import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";
import { appendAuditLog } from "@/lib/audit";

// GET — Single product
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(["dueno", "gerente", "bodeguero"]);
  if (auth.error) return auth.error;

  const producto = await prisma.producto.findUnique({
    where: { id: params.id },
  });

  if (!producto) {
    return NextResponse.json(
      { error: "Producto no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json(producto);
}

// PUT — Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(["dueno", "gerente"]);
  if (auth.error) return auth.error;

  const body = await request.json();

  const producto = await prisma.producto.update({
    where: { id: params.id },
    data: {
      nombre: body.nombre,
      marca: body.marca,
      categoria: body.categoria,
      unidad: body.unidad,
      presentacion: body.presentacion,
      unidadesPorCaja: body.unidadesPorCaja,
      refrigerado: body.refrigerado,
      skuAmovil: body.skuAmovil,
      activo: body.activo,
    },
  });

  await appendAuditLog({
    usuarioId: auth.user.id,
    accion: "producto.actualizado",
    entidad: "Producto",
    entidadId: params.id,
    detalle: { campos: Object.keys(body) },
  });

  return NextResponse.json(producto);
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";
import { CrearProductoSchema } from "@/types/api";
import { appendAuditLog } from "@/lib/audit";

// GET — List products with search
export async function GET(request: NextRequest) {
  const auth = await requireRole(["dueno", "gerente", "bodeguero"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const marca = searchParams.get("marca");
  const activo = searchParams.get("activo");

  const where: Record<string, unknown> = {};

  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { codigoBarras: { contains: q } },
      { skuAmovil: { contains: q } },
    ];
  }

  if (marca) {
    where.marca = marca;
  }

  if (activo !== null) {
    where.activo = activo !== "false";
  }

  const productos = await prisma.producto.findMany({
    where,
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(productos);
}

// POST — Create product
export async function POST(request: NextRequest) {
  const auth = await requireRole(["dueno", "gerente"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = CrearProductoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", detalles: parsed.error.issues },
      { status: 400 }
    );
  }

  // Check barcode uniqueness
  const existing = await prisma.producto.findUnique({
    where: { codigoBarras: parsed.data.codigoBarras },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Ya existe un producto con ese codigo de barras" },
      { status: 409 }
    );
  }

  const producto = await prisma.producto.create({
    data: parsed.data,
  });

  await appendAuditLog({
    usuarioId: auth.user.id,
    accion: "producto.creado",
    entidad: "Producto",
    entidadId: producto.id,
    detalle: { codigoBarras: producto.codigoBarras, nombre: producto.nombre },
  });

  return NextResponse.json(producto, { status: 201 });
}

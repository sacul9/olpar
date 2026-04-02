import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";
import { CrearSesionSchema } from "@/types/api";
import { appendAuditLog } from "@/lib/audit";

// POST — Create a new return session (multi-product)
export async function POST(request: NextRequest) {
  const auth = await requireRole(["dueno", "bodeguero"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = CrearSesionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", detalles: parsed.error.issues },
      { status: 400 }
    );
  }

  const { turnoId, tienda, lineas, remisionId, estacionId } = parsed.data;

  // Verify turno exists and is en_atencion
  const turno = await prisma.colaTurno.findUnique({
    where: { id: turnoId },
    include: { conductor: true },
  });

  if (!turno) {
    return NextResponse.json(
      { error: "Turno no encontrado" },
      { status: 404 }
    );
  }

  if (turno.estado !== "en_atencion") {
    return NextResponse.json(
      { error: "Turno no esta en atencion" },
      { status: 409 }
    );
  }

  // Check no open session already exists for this turn
  const existing = await prisma.sesionDevolucion.findUnique({
    where: { turnoId },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Ya existe una sesion para este turno" },
      { status: 409 }
    );
  }

  // Verify all products exist
  const productoIds = lineas.map((l) => l.productoId);
  const productos = await prisma.producto.findMany({
    where: { id: { in: productoIds } },
  });

  if (productos.length !== new Set(productoIds).size) {
    return NextResponse.json(
      { error: "Uno o mas productos no encontrados" },
      { status: 400 }
    );
  }

  // Create session + lines in a transaction
  const sesion = await prisma.$transaction(async (tx) => {
    const newSesion = await tx.sesionDevolucion.create({
      data: {
        turnoId,
        conductorId: turno.conductorId,
        bodegueroId: auth.user.id,
        tienda,
        remisionId: remisionId ?? null,
        estacionId: estacionId ?? null,
        estado: "abierta",
      },
    });

    await tx.lineaDevolucion.createMany({
      data: lineas.map((l) => ({
        sesionId: newSesion.id,
        productoId: l.productoId,
        motivo: l.motivo,
        cantidadDeclarada: l.cantidadDeclarada,
        cantidadDetectada: 0,
        notas: l.notas ?? null,
      })),
    });

    return tx.sesionDevolucion.findUnique({
      where: { id: newSesion.id },
      include: {
        lineas: { include: { producto: true } },
        conductor: true,
      },
    });
  });

  await appendAuditLog({
    usuarioId: auth.user.id,
    accion: "sesion.creada",
    entidad: "SesionDevolucion",
    entidadId: sesion!.id,
    detalle: {
      conductorId: turno.conductorId,
      tienda,
      totalLineas: lineas.length,
      totalDeclarado: lineas.reduce((sum, l) => sum + l.cantidadDeclarada, 0),
    },
  });

  return NextResponse.json(sesion, { status: 201 });
}

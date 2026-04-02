import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/require-role";
import { appendAuditLog } from "@/lib/audit";

// GET — Single nota credito
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(["dueno", "gerente"]);
  if (auth.error) return auth.error;

  const nota = await prisma.notaCredito.findUnique({
    where: { id: params.id },
    include: { sesion: { include: { conductor: true, lineas: { include: { producto: true } } } } },
  });

  if (!nota) {
    return NextResponse.json({ error: "Nota credito no encontrada" }, { status: 404 });
  }

  return NextResponse.json(nota);
}

// PUT — Approve or void nota credito
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(["dueno"]);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { estado } = body;

  if (!["aprobada", "enviada", "anulada"].includes(estado)) {
    return NextResponse.json({ error: "Estado invalido" }, { status: 400 });
  }

  const nota = await prisma.notaCredito.update({
    where: { id: params.id },
    data: {
      estado,
      aprobadaEn: estado === "aprobada" ? new Date() : undefined,
    },
  });

  await appendAuditLog({
    usuarioId: auth.user.id,
    accion: `nota_credito.${estado}`,
    entidad: "NotaCredito",
    entidadId: params.id,
    detalle: { numero: nota.numero, total: nota.total },
  });

  return NextResponse.json(nota);
}

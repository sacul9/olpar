import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Generate a nota credito (credit note) draft for a closed session.
 * Only generates if the session has products marked as "bueno" (returnable).
 */
export async function generarNotaCredito(
  sesionId: string,
  creadaPorId: string
) {
  const sesion = await prisma.sesionDevolucion.findUnique({
    where: { id: sesionId },
    include: {
      lineas: { include: { producto: true } },
      conductor: true,
    },
  });

  if (!sesion) return null;

  // Only include lines with product estado "bueno" and not rejected
  const lineasAprobadas = sesion.lineas.filter(
    (l) => l.estadoProducto === "bueno" && !l.rechazada
  );

  if (lineasAprobadas.length === 0) return null;

  // Build detail
  const detalle = lineasAprobadas.map((l) => ({
    producto: l.producto.nombre,
    codigoBarras: l.producto.codigoBarras,
    cantidad: l.cantidadDetectada,
    valorUnitario: l.producto.precioCosto,
    subtotal: l.cantidadDetectada * l.producto.precioCosto,
  }));

  const subtotal = detalle.reduce((sum, d) => sum + d.subtotal, 0);
  const impuesto = 0; // IVA handling would go here
  const total = subtotal + impuesto;

  // Generate sequential number
  const year = new Date().getFullYear();
  const lastNota = await prisma.notaCredito.findFirst({
    where: { numero: { startsWith: `NC-${year}` } },
    orderBy: { numero: "desc" },
  });
  const seq = lastNota
    ? parseInt(lastNota.numero.split("-")[2]) + 1
    : 1;
  const numero = `NC-${year}-${seq.toString().padStart(4, "0")}`;

  return prisma.notaCredito.create({
    data: {
      sesionId,
      numero,
      tienda: sesion.tienda,
      conductorNombre: sesion.conductor.nombre,
      subtotal,
      impuesto,
      total,
      estado: "borrador",
      detalle: detalle as unknown as Prisma.InputJsonValue,
      creadaPorId,
    },
  });
}

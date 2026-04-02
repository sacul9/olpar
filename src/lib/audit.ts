import { prisma } from "./prisma";

import type { Prisma } from "@/generated/prisma/client";

type AuditEntry = {
  usuarioId?: string;
  accion: string;
  entidad: string;
  entidadId?: string;
  detalle?: Prisma.InputJsonValue;
  ip?: string;
};

/**
 * Append-only audit log. This is the ONLY function that writes to audit_logs.
 * There is intentionally no update or delete function.
 */
export async function appendAuditLog(entry: AuditEntry) {
  return prisma.auditLog.create({
    data: {
      usuarioId: entry.usuarioId ?? null,
      accion: entry.accion,
      entidad: entry.entidad,
      entidadId: entry.entidadId ?? null,
      detalle: entry.detalle ?? undefined,
      ip: entry.ip ?? null,
    },
  });
}

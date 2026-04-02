import type { Rol } from "@/generated/prisma/client";

export type AppRole = Rol;

export const ROLE_ACCESS: Record<string, AppRole[]> = {
  "/devoluciones": ["dueno", "gerente", "bodeguero"],
  "/devoluciones/historial": ["dueno", "gerente"],
  "/reportes": ["dueno"],
  "/catalogo": ["dueno", "gerente"],
};

export function canAccess(role: AppRole, path: string): boolean {
  // Find the most specific matching route
  const matchingRoutes = Object.keys(ROLE_ACCESS)
    .filter((route) => path.startsWith(route))
    .sort((a, b) => b.length - a.length);

  if (matchingRoutes.length === 0) return false;

  const allowedRoles = ROLE_ACCESS[matchingRoutes[0]];
  return allowedRoles.includes(role);
}

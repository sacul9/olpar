"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Rol } from "@/generated/prisma/client";

const NAV_ITEMS = [
  {
    href: "/devoluciones",
    label: "Devoluciones",
    roles: ["dueno", "gerente", "bodeguero"] as Rol[],
  },
  {
    href: "/devoluciones/historial",
    label: "Historial",
    roles: ["dueno", "gerente"] as Rol[],
  },
  {
    href: "/reportes",
    label: "Reportes",
    roles: ["dueno"] as Rol[],
  },
  {
    href: "/catalogo",
    label: "Catálogo",
    roles: ["dueno", "gerente"] as Rol[],
  },
];

export function Sidebar({ role }: { role: Rol }) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(role)
  );

  return (
    <aside className="flex w-56 flex-col border-r bg-gray-50">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/devoluciones" className="text-lg font-bold text-gray-900">
          Olpar
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/devoluciones" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <p className="text-xs text-gray-400">
          Rol: <span className="font-medium capitalize">{role}</span>
        </p>
      </div>
    </aside>
  );
}

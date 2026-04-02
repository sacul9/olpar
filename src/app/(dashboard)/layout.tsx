import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { authId: authUser.id },
  });

  if (!usuario || !usuario.activo) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar: hidden on mobile, visible on md+ */}
      <div className="hidden md:block">
        <Sidebar role={usuario.rol} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header userName={usuario.nombre} role={usuario.rol} />
        {/* Mobile nav */}
        <div className="flex md:hidden border-b bg-white overflow-x-auto">
          <MobileNav role={usuario.rol} />
        </div>
        <main className="flex-1 overflow-auto bg-gray-50 p-3 sm:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function MobileNav({ role }: { role: string }) {
  const links = [
    { href: "/devoluciones", label: "Devoluciones", roles: ["dueno", "gerente", "bodeguero"] },
    { href: "/devoluciones/historial", label: "Historial", roles: ["dueno", "gerente"] },
    { href: "/reportes", label: "Reportes", roles: ["dueno"] },
    { href: "/catalogo", label: "Catalogo", roles: ["dueno", "gerente"] },
  ];

  return (
    <nav className="flex gap-1 p-2">
      {links
        .filter((l) => l.roles.includes(role))
        .map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            {l.label}
          </a>
        ))}
    </nav>
  );
}

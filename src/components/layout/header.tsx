"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function Header({
  userName,
  role,
}: {
  userName: string;
  role: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {userName}{" "}
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-500">
            {role}
          </span>
        </span>
        <button
          onClick={handleLogout}
          className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          Salir
        </button>
      </div>
    </header>
  );
}

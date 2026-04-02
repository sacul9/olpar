import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "./roles";
import type { Usuario } from "@/generated/prisma/client";

type AuthResult =
  | { user: Usuario; error: null }
  | { user: null; error: NextResponse };

export async function requireRole(
  allowedRoles: AppRole[]
): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      ),
    };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { authId: authUser.id },
  });

  if (!usuario || !usuario.activo) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Usuario no encontrado o inactivo" },
        { status: 403 }
      ),
    };
  }

  if (!allowedRoles.includes(usuario.rol)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "No tiene permisos para esta accion" },
        { status: 403 }
      ),
    };
  }

  return { user: usuario, error: null };
}

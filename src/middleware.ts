import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = ["/login"];
const BYPASS_PATHS = ["/api/scanner/", "/api/cron/"];

const ROLE_ACCESS: Record<string, string[]> = {
  "/devoluciones/historial": ["dueno", "gerente"],
  "/reportes": ["dueno"],
  "/catalogo": ["dueno", "gerente"],
  "/devoluciones": ["dueno", "gerente", "bodeguero"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bypass auth for scanner and cron endpoints (they use their own auth)
  if (BYPASS_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Bypass auth for static assets and API routes that don't need session
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const { user, supabaseResponse } = await updateSession(request);

  // Unauthenticated users → login
  if (!user && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated users on login page → dashboard
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/devoluciones";
    return NextResponse.redirect(url);
  }

  // Role-based access for dashboard routes
  if (user) {
    const role = user.user_metadata?.app_role as string | undefined;

    if (role) {
      // Find the most specific matching route
      const matchingRoute = Object.keys(ROLE_ACCESS)
        .filter((route) => pathname.startsWith(route))
        .sort((a, b) => b.length - a.length)[0];

      if (matchingRoute) {
        const allowedRoles = ROLE_ACCESS[matchingRoute];
        if (!allowedRoles.includes(role)) {
          const url = request.nextUrl.clone();
          url.pathname = "/devoluciones";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

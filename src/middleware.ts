import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, COOKIE_NAME } from "@/lib/session";

const PUBLIC_ROUTES = ["/login", "/manifest.webmanifest", "/manifest.json"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  console.log(`[Middleware] Path: ${pathname}`);

  // Statik dosyalar ve public rotalar
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/favicon") ||
    pathname.includes("manifest") ||
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r))
  ) {
    return NextResponse.next();
  }

  // Token kontrolü
  const token = req.cookies.get(COOKIE_NAME)?.value;
  console.log(`[Middleware] Token cookie present: ${!!token}, token prefix: ${token ? token.slice(0, 10) + "..." : "none"}`);
  if (!token) {
    console.log(`[Middleware] No token, redirecting to /login`);
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const session = await verifySession(token);
  console.log(`[Middleware] Session verification result: ${JSON.stringify(session)}`);
  if (!session) {
    console.log(`[Middleware] Session invalid/expired, clearing cookie and redirecting to /login`);
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|xlsx)).*)",
  ],
};

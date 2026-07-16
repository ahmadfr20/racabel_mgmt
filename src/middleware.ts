import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySession } from "./lib/session";

// Rute yang boleh diakses tanpa login (login page + endpoint machine-to-machine
// yang punya otorisasi sendiri lewat header, bukan session cookie — mis. cron).
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/cron"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const token = req.cookies.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  // Sudah login tapi buka /login -> arahkan ke dashboard
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isPublic) return NextResponse.next();

  // Belum login
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Belum login" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Kecualikan aset statis & file next internal
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
};

/**
 * Edge middleware — protects /admin/* and /api/admin/*.
 *
 * Firebase client auth cannot be verified in the Edge runtime without a
 * session cookie, so the guard is the httpOnly `htc_admin=1` cookie minted
 * by POST /api/auth/session after the Admin SDK verified the user's ID
 * token AND admin email allow-list.
 *
 * - /admin/* without the cookie -> redirect to /login
 * - /api/admin/* without the cookie -> 401 JSON
 */
import { NextRequest, NextResponse } from "next/server";

export const ADMIN_SESSION_COOKIE = "htc_admin";

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.get(ADMIN_SESSION_COOKIE)?.value === "1";
  const { pathname } = req.nextUrl;

  if (!hasSession) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

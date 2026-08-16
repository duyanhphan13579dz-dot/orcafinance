import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/dashboard", "/heatmap", "/stocks", "/commodities", "/reports", "/screener", "/news", "/agent", "/settings", "/watchlist"];
const AUTH_PAGES = ["/auth/login", "/auth/register"];

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const hasAccess = Boolean(req.cookies.get("orca_access_token")?.value);
  const hasRefresh = Boolean(req.cookies.get("refreshToken")?.value);
  const hasSession = hasAccess || hasRefresh;

  if (PROTECTED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) && !hasSession) {
    const login = new URL("/auth/login", req.url);
    login.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(login);
  }
  if (AUTH_PAGES.some((p) => path === p) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/heatmap/:path*", "/stocks/:path*", "/commodities/:path*", "/reports/:path*",
    "/screener/:path*", "/news/:path*", "/agent/:path*", "/settings/:path*",
    "/watchlist/:path*", "/auth/login", "/auth/register",
  ],
};

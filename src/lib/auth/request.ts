import { NextRequest } from "next/server";
import { verifyAccessToken, type JWTPayload } from "@/lib/auth/service";
import { fail } from "@/lib/api";

export const ACCESS_COOKIE = "orca_access_token";
export const REFRESH_COOKIE = "refreshToken";

export async function getAuthUser(req: NextRequest): Promise<JWTPayload | null> {
  const bearer = req.headers.get("authorization");
  const token = bearer?.startsWith("Bearer ")
    ? bearer.slice(7)
    : req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

export async function requireAuth(req: NextRequest): Promise<
  | { ok: true; user: JWTPayload }
  | { ok: false; response: ReturnType<typeof fail> }
> {
  const user = await getAuthUser(req);
  if (!user) return { ok: false, response: fail("Bạn cần đăng nhập để thực hiện thao tác này", 401) };
  return { ok: true, user };
}

export function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
}

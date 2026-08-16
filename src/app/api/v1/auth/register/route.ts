import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, refreshTokens, userPreferences, userSessions, users } from "@/db/schema";
import { checkRateLimit, fail, ok } from "@/lib/api";
import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiresAt, hashPassword } from "@/lib/auth/service";
import { ACCESS_COOKIE, REFRESH_COOKIE, authCookieOptions, clientIp } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, 10);
  if (limited) return limited;
  try {
    const body = (await req.json()) as { email?: string; password?: string; name?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.password) return fail("Email và mật khẩu là bắt buộc", 400);
    if (body.password.length < 8) return fail("Mật khẩu phải có ít nhất 8 ký tự", 400);
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Email không hợp lệ", 400);

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) return fail("Email đã được đăng ký", 409);

    const passwordHash = await hashPassword(body.password);
    const refreshToken = generateRefreshToken();
    const expiresAt = getRefreshTokenExpiresAt();
    const ip = clientIp(req);
    const userAgent = req.headers.get("user-agent");

    const user = await db.transaction(async (tx) => {
      const [created] = await tx.insert(users).values({ email, passwordHash, name: body.name?.trim() || null, provider: "local" }).returning();
      await tx.insert(userPreferences).values({ userId: created.id });
      await tx.insert(refreshTokens).values({ token: refreshToken, userId: created.id, expiresAt });
      await tx.insert(userSessions).values({ token: refreshToken, userId: created.id, expiresAt, ipAddress: ip, userAgent });
      await tx.insert(auditLogs).values({ userId: created.id, action: "register", metadata: { ip, userAgent } });
      return created;
    });

    const accessToken = await generateAccessToken({ userId: user.id, email: user.email, provider: user.provider });
    const response = ok({ user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, provider: user.provider } });
    response.cookies.set(ACCESS_COOKIE, accessToken, authCookieOptions(15 * 60));
    response.cookies.set(REFRESH_COOKIE, refreshToken, authCookieOptions(7 * 24 * 60 * 60));
    return response;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Đăng ký thất bại", 500);
  }
}

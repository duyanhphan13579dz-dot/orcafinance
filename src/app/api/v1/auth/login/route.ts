import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, refreshTokens, userSessions, users } from "@/db/schema";
import { checkRateLimit, fail, ok } from "@/lib/api";
import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiresAt, verifyPassword } from "@/lib/auth/service";
import { ACCESS_COOKIE, REFRESH_COOKIE, authCookieOptions, clientIp } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, 10);
  if (limited) return limited;
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.password) return fail("Email và mật khẩu là bắt buộc", 400);

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
      return fail("Email hoặc mật khẩu không đúng", 401);
    }

    const accessToken = await generateAccessToken({ userId: user.id, email: user.email, provider: user.provider });
    const refreshToken = generateRefreshToken();
    const expiresAt = getRefreshTokenExpiresAt();
    const userAgent = req.headers.get("user-agent");
    const ip = clientIp(req);

    await db.transaction(async (tx) => {
      await tx.insert(refreshTokens).values({ token: refreshToken, userId: user.id, expiresAt });
      await tx.insert(userSessions).values({ token: refreshToken, userId: user.id, expiresAt, userAgent, ipAddress: ip });
      await tx.insert(auditLogs).values({ userId: user.id, action: "login", metadata: { ip, userAgent } });
    });

    const response = ok({
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, provider: user.provider },
    });
    response.cookies.set(ACCESS_COOKIE, accessToken, authCookieOptions(15 * 60));
    response.cookies.set(REFRESH_COOKIE, refreshToken, authCookieOptions(7 * 24 * 60 * 60));
    return response;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Đăng nhập thất bại", 500);
  }
}

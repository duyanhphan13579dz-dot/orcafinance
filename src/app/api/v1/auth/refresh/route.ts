import { NextRequest } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { refreshTokens, users } from "@/db/schema";
import { fail, ok } from "@/lib/api";
import { generateAccessToken } from "@/lib/auth/service";
import { ACCESS_COOKIE, REFRESH_COOKIE, authCookieOptions } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!token) return fail("Refresh token missing", 401);
  const [row] = await db.select({ userId: refreshTokens.userId, email: users.email, provider: users.provider })
    .from(refreshTokens).innerJoin(users, eq(users.id, refreshTokens.userId))
    .where(and(eq(refreshTokens.token, token), gt(refreshTokens.expiresAt, new Date()))).limit(1);
  if (!row) return fail("Refresh token invalid or expired", 401);
  const access = await generateAccessToken({ userId: row.userId, email: row.email, provider: row.provider });
  const response = ok({ refreshed: true });
  response.cookies.set(ACCESS_COOKIE, access, authCookieOptions(15 * 60));
  return response;
}

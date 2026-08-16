import { NextRequest } from "next/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { refreshTokens, userSessions } from "@/db/schema";
import { fail, ok } from "@/lib/api";
import { REFRESH_COOKIE, requireAuth } from "@/lib/auth/request";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (!auth.ok) return auth.response;
  const current = req.cookies.get(REFRESH_COOKIE)?.value;
  const rows = await db.select({ id: userSessions.id, userAgent: userSessions.userAgent, ipAddress: userSessions.ipAddress, createdAt: userSessions.createdAt, lastSeenAt: userSessions.lastSeenAt, expiresAt: userSessions.expiresAt, token: userSessions.token }).from(userSessions).where(eq(userSessions.userId, auth.user.userId)).orderBy(desc(userSessions.lastSeenAt));
  return ok({ sessions: rows.map(({ token, ...s }) => ({ ...s, current: token === current })) });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (!auth.ok) return auth.response;
  const current = req.cookies.get(REFRESH_COOKIE)?.value;
  await db.transaction(async (tx) => {
    if (current) await tx.delete(refreshTokens).where(and(eq(refreshTokens.userId, auth.user.userId), ne(refreshTokens.token, current)));
    if (current) await tx.delete(userSessions).where(and(eq(userSessions.userId, auth.user.userId), ne(userSessions.token, current)));
  });
  return ok({ revokedOtherSessions: true });
}

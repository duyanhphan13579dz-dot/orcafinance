import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, refreshTokens, userSessions } from "@/db/schema";
import { checkRateLimit, ok } from "@/lib/api";
import { ACCESS_COOKIE, REFRESH_COOKIE, getAuthUser } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, 60);
  if (limited) return limited;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  const user = await getAuthUser(req);
  try {
    if (refresh) {
      await db.delete(refreshTokens).where(eq(refreshTokens.token, refresh));
      await db.delete(userSessions).where(eq(userSessions.token, refresh));
    }
    if (user) await db.insert(auditLogs).values({ userId: user.userId, action: "logout", metadata: {} });
  } catch {
    // Cookie cleanup must still happen if DB is temporarily unavailable.
  }
  const response = ok({ success: true });
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

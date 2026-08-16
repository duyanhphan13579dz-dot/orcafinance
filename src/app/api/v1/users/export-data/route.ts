import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, userPreferences, userSessions, users, watchlistItems } from "@/db/schema";
import { ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (!auth.ok) return auth.response;
  const [user, preferences, sessions, audit] = await Promise.all([
    db.select({ email: users.email, name: users.name, phoneNumber: users.phoneNumber, avatarUrl: users.avatarUrl, provider: users.provider, createdAt: users.createdAt }).from(users).where(eq(users.id, auth.user.userId)),
    db.select().from(userPreferences).where(eq(userPreferences.userId, auth.user.userId)),
    db.select({ id: userSessions.id, userAgent: userSessions.userAgent, ipAddress: userSessions.ipAddress, createdAt: userSessions.createdAt }).from(userSessions).where(eq(userSessions.userId, auth.user.userId)),
    db.select().from(auditLogs).where(eq(auditLogs.userId, auth.user.userId)),
  ]);
  await db.insert(auditLogs).values({ userId: auth.user.userId, action: "export_data", metadata: {} });
  return ok({ exportedAt: new Date().toISOString(), user: user[0], preferences: preferences[0] ?? null, sessions, auditLogs: audit });
}

import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (!auth.ok) return auth.response;
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.userId, auth.user.userId)).orderBy(desc(auditLogs.createdAt)).limit(100);
  return ok({ logs });
}

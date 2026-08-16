import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { fail, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";
import { hashPassword, verifyPassword } from "@/lib/auth/service";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (!auth.ok) return auth.response;
  const b = await req.json() as { currentPassword?: string; newPassword?: string };
  if (!b.currentPassword || !b.newPassword || b.newPassword.length < 8) return fail("Mật khẩu mới phải có ít nhất 8 ký tự", 400);
  const [user] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, auth.user.userId)).limit(1);
  if (!user?.hash || !(await verifyPassword(b.currentPassword, user.hash))) return fail("Mật khẩu hiện tại không đúng", 401);
  await db.update(users).set({ passwordHash: await hashPassword(b.newPassword), updatedAt: new Date() }).where(eq(users.id, auth.user.userId));
  await db.insert(auditLogs).values({ userId: auth.user.userId, action: "change_password", metadata: {} });
  return ok({ changed: true });
}

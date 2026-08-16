import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { fail, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (!auth.ok) return auth.response;
  const [user] = await db.select({ id: users.id, email: users.email, name: users.name, phoneNumber: users.phoneNumber, avatarUrl: users.avatarUrl, provider: users.provider, emailVerified: users.emailVerified, twoFactorEnabled: users.twoFactorEnabled, createdAt: users.createdAt }).from(users).where(eq(users.id, auth.user.userId)).limit(1);
  if (!user) return fail("User not found", 404);
  return ok({ user });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req); if (!auth.ok) return auth.response;
  const body = (await req.json()) as { name?: string; phoneNumber?: string; avatarUrl?: string };
  if (body.name && body.name.length > 100) return fail("Tên quá dài", 400);
  if (body.avatarUrl && !/^https?:\/\//.test(body.avatarUrl)) return fail("Avatar URL không hợp lệ", 400);
  const [user] = await db.update(users).set({ name: body.name?.trim(), phoneNumber: body.phoneNumber?.trim(), avatarUrl: body.avatarUrl?.trim(), updatedAt: new Date() }).where(eq(users.id, auth.user.userId)).returning({ id: users.id, email: users.email, name: users.name, phoneNumber: users.phoneNumber, avatarUrl: users.avatarUrl });
  await db.insert(auditLogs).values({ userId: auth.user.userId, action: "update_profile", metadata: {} });
  return ok({ user });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({})) as { confirmation?: string };
  if (body.confirmation !== "DELETE") return fail("Nhập DELETE để xác nhận", 400);
  await db.delete(users).where(eq(users.id, auth.user.userId));
  const response = ok({ deleted: true });
  response.cookies.delete("orca_access_token"); response.cookies.delete("refreshToken");
  return response;
}

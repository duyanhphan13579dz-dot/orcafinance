import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { refreshTokens, userSessions } from "@/db/schema";
import { fail, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req); if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const [session] = await db.select().from(userSessions).where(and(eq(userSessions.id, id), eq(userSessions.userId, auth.user.userId))).limit(1);
  if (!session) return fail("Session not found", 404);
  await db.transaction(async (tx) => {
    await tx.delete(refreshTokens).where(eq(refreshTokens.token, session.token));
    await tx.delete(userSessions).where(eq(userSessions.id, id));
  });
  return ok({ revoked: true });
}

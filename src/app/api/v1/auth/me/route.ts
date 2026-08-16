import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { checkRateLimit, fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, 120);
  if (limited) return limited;
  const tokenUser = await getAuthUser(req);
  if (!tokenUser) return fail("Unauthorized", 401);
  const [user] = await db.select({
    id: users.id, email: users.email, name: users.name, phoneNumber: users.phoneNumber,
    avatarUrl: users.avatarUrl, provider: users.provider, emailVerified: users.emailVerified,
    twoFactorEnabled: users.twoFactorEnabled,
  }).from(users).where(eq(users.id, tokenUser.userId)).limit(1);
  if (!user) return fail("User not found", 404);
  return ok({ user });
}

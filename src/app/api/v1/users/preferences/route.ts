import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, userPreferences } from "@/db/schema";
import { fail, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (!auth.ok) return auth.response;
  let [preferences] = await db.select().from(userPreferences).where(eq(userPreferences.userId, auth.user.userId)).limit(1);
  if (!preferences) [preferences] = await db.insert(userPreferences).values({ userId: auth.user.userId }).returning();
  return ok({ preferences });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req); if (!auth.ok) return auth.response;
  const b = await req.json() as Record<string, unknown>;
  const theme = typeof b.theme === "string" && ["light", "dark", "system"].includes(b.theme) ? b.theme : undefined;
  const language = typeof b.language === "string" && ["vi", "en"].includes(b.language) ? b.language : undefined;
  const accentColor = typeof b.accentColor === "string" && /^#[0-9a-f]{6}$/i.test(b.accentColor) ? b.accentColor : undefined;
  const set = {
    ...(theme && { theme }), ...(language && { language }), ...(accentColor && { accentColor }),
    ...(typeof b.fontFamily === "string" && { fontFamily: b.fontFamily }),
    ...(typeof b.emailMorning === "boolean" && { emailMorning: b.emailMorning }),
    ...(typeof b.morningTime === "string" && /^\d{2}:\d{2}$/.test(b.morningTime) && { morningTime: b.morningTime }),
    ...(typeof b.emailSummary === "boolean" && { emailSummary: b.emailSummary }),
    ...(typeof b.summaryTime === "string" && /^\d{2}:\d{2}$/.test(b.summaryTime) && { summaryTime: b.summaryTime }),
    ...(typeof b.emailAlerts === "boolean" && { emailAlerts: b.emailAlerts }),
    ...(typeof b.pushEnabled === "boolean" && { pushEnabled: b.pushEnabled }),
    ...(typeof b.inAppNews === "boolean" && { inAppNews: b.inAppNews }),
    ...(typeof b.inAppAi === "boolean" && { inAppAi: b.inAppAi }),
    updatedAt: new Date(),
  };
  const [preferences] = await db.insert(userPreferences).values({ userId: auth.user.userId, ...set }).onConflictDoUpdate({ target: userPreferences.userId, set }).returning();
  await db.insert(auditLogs).values({ userId: auth.user.userId, action: "update_preferences", metadata: {} });
  return ok({ preferences });
}

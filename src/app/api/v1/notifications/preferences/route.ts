import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationPreferences } from "@/db/schema";
import { ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";
import { notificationConfig } from "@/lib/notifications/service";

export async function GET(req: NextRequest) {
  const auth=await requireAuth(req); if(!auth.ok)return auth.response;
  let [p]=await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId,auth.user.userId)).limit(1);
  if(!p)[p]=await db.insert(notificationPreferences).values({userId:auth.user.userId}).onConflictDoNothing().returning();
  return ok({preferences:p,config:notificationConfig()});
}
export async function PUT(req:NextRequest){
  const auth=await requireAuth(req);if(!auth.ok)return auth.response;const b=await req.json() as Record<string,unknown>;
  const keys=["pushEnabled","emailMorning","emailSummary","emailPriceAlerts","emailBreakingNews","pushPriceAlerts","pushBreakingNews","pushReports"] as const;
  const set:Record<string,unknown>={updatedAt:new Date()}; for(const k of keys)if(typeof b[k]==="boolean")set[k]=b[k];
  const [preferences]=await db.insert(notificationPreferences).values({userId:auth.user.userId,...set}).onConflictDoUpdate({target:notificationPreferences.userId,set}).returning();
  return ok({preferences,config:notificationConfig()});
}

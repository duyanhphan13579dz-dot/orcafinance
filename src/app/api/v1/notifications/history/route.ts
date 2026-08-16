import { NextRequest } from "next/server";
import { desc,eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationLogs } from "@/db/schema";
import { ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";
export async function GET(req:NextRequest){const auth=await requireAuth(req);if(!auth.ok)return auth.response;const logs=await db.select().from(notificationLogs).where(eq(notificationLogs.userId,auth.user.userId)).orderBy(desc(notificationLogs.createdAt)).limit(100);return ok({notifications:logs});}

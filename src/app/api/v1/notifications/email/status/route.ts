import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailConnections } from "@/db/schema";
import { ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";
import { notificationConfig } from "@/lib/notifications/service";
export async function GET(req:NextRequest){const auth=await requireAuth(req);if(!auth.ok)return auth.response;const [c]=await db.select({emailAddress:emailConnections.emailAddress,verifiedAt:emailConnections.verifiedAt}).from(emailConnections).where(eq(emailConnections.userId,auth.user.userId)).limit(1);return ok({connected:!!c?.verifiedAt,emailAddress:c?.emailAddress??null,verifiedAt:c?.verifiedAt??null,configured:notificationConfig().googleConfigured});}

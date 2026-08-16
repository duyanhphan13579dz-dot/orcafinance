import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationPreferences, pushSubscriptions } from "@/db/schema";
import { fail, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";

export async function POST(req:NextRequest){const auth=await requireAuth(req);if(!auth.ok)return auth.response;const b=await req.json() as any;if(!b?.endpoint||!b?.keys?.p256dh||!b?.keys?.auth)return fail("Push subscription không hợp lệ",400);await db.insert(pushSubscriptions).values({userId:auth.user.userId,endpoint:b.endpoint,p256dh:b.keys.p256dh,auth:b.keys.auth,userAgent:req.headers.get("user-agent")}).onConflictDoUpdate({target:pushSubscriptions.endpoint,set:{userId:auth.user.userId,p256dh:b.keys.p256dh,auth:b.keys.auth}});await db.insert(notificationPreferences).values({userId:auth.user.userId,pushEnabled:true}).onConflictDoUpdate({target:notificationPreferences.userId,set:{pushEnabled:true,updatedAt:new Date()}});return ok({subscribed:true});}
export async function DELETE(req:NextRequest){const auth=await requireAuth(req);if(!auth.ok)return auth.response;const b=await req.json().catch(()=>({})) as any;if(b.endpoint)await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId,auth.user.userId),eq(pushSubscriptions.endpoint,b.endpoint)));else await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId,auth.user.userId));await db.update(notificationPreferences).set({pushEnabled:false,updatedAt:new Date()}).where(eq(notificationPreferences.userId,auth.user.userId));return ok({subscribed:false});}

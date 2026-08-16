import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailConnections } from "@/db/schema";
import { ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";
export async function DELETE(req:NextRequest){const auth=await requireAuth(req);if(!auth.ok)return auth.response;await db.delete(emailConnections).where(eq(emailConnections.userId,auth.user.userId));return ok({connected:false});}

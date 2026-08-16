import { NextRequest } from "next/server";
import { fail,ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";
import { encryptJson } from "@/lib/notifications/crypto";
export async function POST(req:NextRequest){const auth=await requireAuth(req);if(!auth.ok)return auth.response;const id=process.env.GOOGLE_CLIENT_ID,redirect=process.env.GOOGLE_REDIRECT_URI;if(!id||!redirect)return fail("Google OAuth chưa được cấu hình",503);let state:string;try{state=encryptJson({userId:auth.user.userId,nonce:crypto.randomUUID(),expiresAt:Date.now()+10*60_000});}catch(e){return fail(e instanceof Error?e.message:String(e),503)}const q=new URLSearchParams({client_id:id,redirect_uri:redirect,response_type:"code",access_type:"offline",prompt:"consent",scope:"openid email https://www.googleapis.com/auth/gmail.send",state});return ok({url:`https://accounts.google.com/o/oauth2/v2/auth?${q}`});}

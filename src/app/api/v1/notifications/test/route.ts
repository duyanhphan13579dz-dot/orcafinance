import { NextRequest } from "next/server";
import { fail,ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";
import { dispatchToUser,notificationConfig } from "@/lib/notifications/service";
export async function POST(req:NextRequest){const auth=await requireAuth(req);if(!auth.ok)return auth.response;const config=notificationConfig();if(!config.vapidConfigured&&!config.googleConfigured)return fail("Chưa cấu hình VAPID hoặc Google OAuth trên server",503);const result=await dispatchToUser(auth.user.userId,{category:"test",title:"ORCA FINANCIAL",body:"Thông báo thử nghiệm đã hoạt động thành công.",url:"/settings"});return ok({sent:true,result});}

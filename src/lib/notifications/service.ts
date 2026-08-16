import webpush from "web-push";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { emailConnections, notificationLogs, notificationPreferences, pushSubscriptions, users } from "@/db/schema";
import { decryptJson } from "./crypto";
import { logger } from "@/lib/logger";

export type NotificationCategory = "price_alert" | "breaking_news" | "morning_report" | "summary_report" | "watchlist" | "test";
interface Message { category: NotificationCategory; title: string; body: string; url?: string; }
interface GoogleTokens { access_token?: string; refresh_token?: string; expires_at?: number; scope?: string }

function vapidConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}
function setupVapid() {
  if (!vapidConfigured()) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  return true;
}

async function freshGoogleAccessToken(tokens: GoogleTokens): Promise<GoogleTokens> {
  if (tokens.access_token && (!tokens.expires_at || tokens.expires_at > Date.now() + 60_000)) return tokens;
  if (!tokens.refresh_token || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new Error("Google refresh token unavailable");
  const form = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: tokens.refresh_token, grant_type: "refresh_token" });
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const data = await res.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !data.access_token) throw new Error(data.error_description || "Google token refresh failed");
  return { ...tokens, access_token: data.access_token, expires_at: Date.now() + (data.expires_in ?? 3600) * 1000 };
}

function gmailRaw(to: string, title: string, body: string) {
  const msg = [`To: ${to}`, `From: ${to}`, `Subject: =?UTF-8?B?${Buffer.from(title).toString("base64")}?=`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "", body].join("\r\n");
  return Buffer.from(msg).toString("base64url");
}

async function sendGmail(connection: typeof emailConnections.$inferSelect, message: Message) {
  const tokens = await freshGoogleAccessToken(decryptJson<GoogleTokens>(connection.encryptedTokens));
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: gmailRaw(connection.emailAddress, message.title, `${message.body}\n\n${message.url ?? ""}`) }),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

function categoryEnabled(pref: typeof notificationPreferences.$inferSelect, category: NotificationCategory, channel: "push" | "email") {
  if (category === "test") return true;
  if (channel === "push") {
    if (!pref.pushEnabled) return false;
    if (category === "price_alert" || category === "watchlist") return pref.pushPriceAlerts;
    if (category === "breaking_news") return pref.pushBreakingNews;
    return pref.pushReports;
  }
  if (category === "morning_report") return pref.emailMorning;
  if (category === "summary_report") return pref.emailSummary;
  if (category === "price_alert" || category === "watchlist") return pref.emailPriceAlerts;
  return pref.emailBreakingNews;
}

async function logDelivery(userId: string, type: string, m: Message, status: string, error?: string) {
  await db.insert(notificationLogs).values({ userId, type, category: m.category, title: m.title, body: m.body, url: m.url, status, error });
}

export async function dispatchToUser(userId: string, message: Message) {
  const [pref] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
  const effective = pref ?? (await db.insert(notificationPreferences).values({ userId }).onConflictDoNothing().returning())[0];
  if (!effective) return { push: 0, email: 0 };
  let pushSent = 0, emailSent = 0;

  if (categoryEnabled(effective, message.category, "push") && setupVapid()) {
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(message));
        pushSent++; await logDelivery(userId, "push", message, "sent");
      } catch (err: any) {
        await logDelivery(userId, "push", message, "failed", err?.message ?? String(err));
        if (err?.statusCode === 404 || err?.statusCode === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }

  if (categoryEnabled(effective, message.category, "email")) {
    const [connection] = await db.select().from(emailConnections).where(eq(emailConnections.userId, userId)).limit(1);
    if (connection?.verifiedAt) {
      try { await sendGmail(connection, message); emailSent++; await logDelivery(userId, "email", message, "sent"); }
      catch (err) { await logDelivery(userId, "email", message, "failed", err instanceof Error ? err.message : String(err)); }
    }
  }
  // Always retain in-app history for dispatchable events.
  await logDelivery(userId, "in_app", message, "sent");
  return { push: pushSent, email: emailSent };
}

export async function dispatchToEligibleUsers(message: Message) {
  // Deduplicate repeated engine events for 5 minutes.
  const recent = await db.select({ id: notificationLogs.id }).from(notificationLogs)
    .where(and(eq(notificationLogs.category, message.category), eq(notificationLogs.title, message.title), gte(notificationLogs.createdAt, new Date(Date.now() - 5 * 60_000)))).limit(1);
  if (recent.length) return { deduplicated: true, users: 0 };
  const rows = await db.select({ id: users.id }).from(users);
  const results = await Promise.allSettled(rows.map((u) => dispatchToUser(u.id, message)));
  logger.info("notification_event_dispatched", { category: message.category, users: rows.length, failures: results.filter((x) => x.status === "rejected").length });
  return { deduplicated: false, users: rows.length };
}

export function notificationConfig() {
  return {
    vapidConfigured: vapidConfigured(),
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
    googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI && (process.env.NOTIFICATION_ENCRYPTION_KEY || process.env.JWT_SECRET)),
  };
}

"use client";

import { useEffect, useState } from "react";

interface Props { notify: (message: string) => void }
interface Config { vapidConfigured?: boolean; vapidPublicKey?: string | null; googleConfigured?: boolean }
interface EmailStatus { connected?: boolean; emailAddress?: string | null; configured?: boolean }
interface History { id: string; type: string; status: string; title: string; body: string; createdAt: string }

const KEYS = [
  ["pushPriceAlerts", "Push · Biến động giá mạnh"],
  ["pushBreakingNews", "Push · Tin quan trọng"],
  ["pushReports", "Push · Báo cáo mới"],
  ["emailMorning", "Email · Morning Brief"],
  ["emailSummary", "Email · Market Summary"],
  ["emailPriceAlerts", "Email · Biến động giá"],
  ["emailBreakingNews", "Email · Tin quan trọng"],
] as const;

function toUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function NotificationSettings({ notify }: Props) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [config, setConfig] = useState<Config>({});
  const [email, setEmail] = useState<EmailStatus>({});
  const [history, setHistory] = useState<History[]>([]);
  const [busy, setBusy] = useState(false);

  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "Có lỗi xảy ra");
    return json.data;
  };

  const load = async () => {
    const [preferenceData, emailData, historyData] = await Promise.all([
      request("/api/v1/notifications/preferences"),
      request("/api/v1/notifications/email/status"),
      request("/api/v1/notifications/history"),
    ]);
    setPrefs(preferenceData.preferences ?? {});
    setConfig(preferenceData.config ?? {});
    setEmail(emailData);
    setHistory(historyData.notifications ?? []);
  };

  useEffect(() => { void load().catch(() => undefined); }, []);

  const save = async (patch: Record<string, boolean>) => {
    setPrefs((current) => ({ ...current, ...patch }));
    try {
      const data = await request("/api/v1/notifications/preferences", {
        method: "PUT", body: JSON.stringify(patch),
      });
      setPrefs(data.preferences);
      notify("Đã lưu thiết lập thông báo");
    } catch (err) { notify(err instanceof Error ? err.message : String(err)); }
  };

  const enablePush = async () => {
    setBusy(true);
    try {
      if (!config.vapidConfigured || !config.vapidPublicKey) throw new Error("Server chưa cấu hình VAPID keys");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Trình duyệt không hỗ trợ Web Push");
      if (await Notification.requestPermission() !== "granted") throw new Error("Bạn chưa cấp quyền thông báo");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toUint8Array(config.vapidPublicKey) as BufferSource,
        });
      }
      await request("/api/v1/notifications/subscribe", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
      setPrefs((p) => ({ ...p, pushEnabled: true }));
      notify("Đã bật thông báo web");
    } catch (err) { notify(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const disablePush = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      await request("/api/v1/notifications/subscribe", {
        method: "DELETE", body: JSON.stringify({ endpoint: subscription?.endpoint }),
      });
      await subscription?.unsubscribe();
      setPrefs((p) => ({ ...p, pushEnabled: false }));
      notify("Đã tắt thông báo web");
    } catch (err) { notify(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const connectGoogle = async () => {
    try {
      const data = await request("/api/v1/notifications/email/connect", { method: "POST" });
      window.location.href = data.url;
    } catch (err) { notify(err instanceof Error ? err.message : String(err)); }
  };
  const disconnectGoogle = async () => {
    await request("/api/v1/notifications/email/disconnect", { method: "DELETE" });
    setEmail({ connected: false, configured: config.googleConfigured });
    notify("Đã ngắt liên kết Google");
  };
  const test = async () => {
    try {
      await request("/api/v1/notifications/test", { method: "POST" });
      notify("Đã gửi thông báo thử");
      await load();
    } catch (err) { notify(err instanceof Error ? err.message : String(err)); }
  };

  return <div className="space-y-5">
    <div><h2 className="text-xl font-bold text-white">Thông báo</h2><p className="text-xs text-slate-500 mt-1">Kết nối Web Push và Gmail với sự kiện thực từ Data Engine, News và Reports.</p></div>
    <div className="rounded-lg border border-[#1a3558] p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div><div className="font-semibold text-white">Web Push</div><div className="text-xs text-slate-500 mt-1">{config.vapidConfigured ? "Server đã cấu hình VAPID" : "Chưa cấu hình VAPID public/private keys"}</div></div>
        <button disabled={busy} onClick={() => prefs.pushEnabled ? disablePush() : enablePush()} className={`${prefs.pushEnabled ? "btn-orca-outline" : "btn-orca"} min-h-11`}>{busy ? "Đang xử lý…" : prefs.pushEnabled ? "Tắt Push" : "Bật Push"}</button>
      </div>
    </div>
    <div className="rounded-lg border border-[#1a3558] p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div><div className="font-semibold text-white">Email Google</div><div className="text-xs text-slate-500 mt-1">{email.connected ? `Đã xác thực: ${email.emailAddress}` : config.googleConfigured ? "Sẵn sàng kết nối Gmail OAuth" : "Server chưa cấu hình Google OAuth"}</div></div>
        {email.connected ? <button onClick={disconnectGoogle} className="btn-orca-ghost min-h-11">Ngắt kết nối</button> : <button onClick={connectGoogle} className="btn-orca-outline min-h-11">Kết nối Google</button>}
      </div>
    </div>
    <div className="grid sm:grid-cols-2 gap-2">
      {KEYS.map(([key, label]) => <NotificationToggle key={key} label={label} checked={!!prefs[key]} disabled={(key.startsWith("push") && !prefs.pushEnabled) || (key.startsWith("email") && !email.connected)} onChange={(value) => save({ [key]: value })} />)}
    </div>
    <button onClick={test} className="btn-orca-outline min-h-11">Gửi thông báo thử</button>
    <div><h3 className="font-semibold text-white mb-2">Lịch sử thông báo</h3><div className="space-y-2 max-h-72 overflow-auto">
      {history.length ? history.map((n) => <div key={n.id} className="rounded border border-slate-800 p-3"><div className="flex justify-between gap-2"><span className="text-sm text-white">{n.title}</span><span className={`text-[10px] ${n.status === "sent" ? "text-emerald-400" : "text-rose-400"}`}>{n.type} · {n.status}</span></div><div className="text-xs text-slate-500 mt-1">{n.body}</div><div className="text-[10px] text-slate-600 mt-1">{new Date(n.createdAt).toLocaleString("vi-VN")}</div></div>) : <div className="text-xs text-slate-500">Chưa có thông báo.</div>}
    </div></div>
  </div>;
}

function NotificationToggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <div className={`flex items-center justify-between rounded-lg border border-[#1a3558] p-3 ${disabled ? "opacity-40" : ""}`}><span className="text-sm text-slate-300">{label}</span><button disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full ${checked ? "bg-[#00d4ff]" : "bg-slate-700"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-6" : "left-1"}`}/></button></div>;
}

"use client";

import { useEffect, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { useAuth } from "@/lib/auth/context";
import { NotificationSettings } from "@/components/settings/NotificationSettings";

const TABS = [
  ["appearance", "🎨", "Giao diện"], ["account", "👤", "Tài khoản"],
  ["security", "🛡️", "Bảo mật"], ["notifications", "🔔", "Thông báo"],
  ["sessions", "💻", "Phiên đăng nhập"], ["data", "🗂️", "Quản lý dữ liệu"],
  ["support", "❓", "Trợ giúp"],
] as const;

type Tab = typeof TABS[number][0];
type Prefs = Record<string, any>;

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("appearance");
  const [prefs, setPrefs] = useState<Prefs>({});
  const [sessions, setSessions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", phoneNumber: "", avatarUrl: "" });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };
  const jsonFetch = async (url: string, init?: RequestInit) => {
    const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Có lỗi xảy ra"); return j.data;
  };

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (requested && TABS.some(([id]) => id === requested)) setTab(requested);
  }, []);

  useEffect(() => {
    if (!user) return;
    setForm({ name: user.name ?? "", phoneNumber: (user as any).phoneNumber ?? "", avatarUrl: user.avatarUrl ?? "" });
    void jsonFetch("/api/v1/users/preferences").then((d) => setPrefs(d.preferences)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (tab === "sessions") void jsonFetch("/api/v1/users/sessions").then((d) => setSessions(d.sessions));
    if (tab === "security") void jsonFetch("/api/v1/users/audit-logs").then((d) => setLogs(d.logs));
  }, [tab]);

  const savePrefs = async (patch: Prefs) => {
    const next = { ...prefs, ...patch }; setPrefs(next); setSaving(true);
    try { const d = await jsonFetch("/api/v1/users/preferences", { method: "PUT", body: JSON.stringify(patch) }); setPrefs(d.preferences); notify("Đã lưu cài đặt");
      if (patch.theme) document.documentElement.dataset.theme = patch.theme;
      if (patch.accentColor) document.documentElement.style.setProperty("--orca-cyan", patch.accentColor);
    } catch (e) { notify(e instanceof Error ? e.message : "Lưu thất bại"); } finally { setSaving(false); }
  };

  return <ProtectedPage featureName="trung tâm cài đặt">
    <div className="space-y-5">
      {toast && <div className="fixed right-4 top-20 z-[100] rounded-lg border border-emerald-700 bg-emerald-950 px-4 py-3 text-sm text-emerald-200 shadow-xl">✓ {toast}</div>}
      <div><div className="text-[10px] tracking-[.3em] text-[#00d4ff] uppercase font-mono">Personal Control Center</div><h1 className="text-3xl font-black text-white mt-1">Cài đặt</h1><p className="text-sm text-slate-400 mt-1">Quản lý tài khoản, bảo mật, thông báo và trải nghiệm ORCA của bạn.</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5">
        <aside className="panel p-2 lg:sticky lg:top-24 lg:self-start">
          <div className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-hide">
            {TABS.map(([id, icon, label]) => <button key={id} onClick={() => setTab(id)} className={`shrink-0 min-h-11 rounded-lg px-3 py-2.5 text-left text-sm transition flex items-center gap-2 ${tab === id ? "bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30" : "text-slate-400 hover:bg-slate-800/50"}`}><span>{icon}</span>{label}</button>)}
          </div>
          <button onClick={() => void logout()} className="mt-2 w-full min-h-11 rounded-lg border border-rose-800 text-rose-300 text-sm">Đăng xuất</button>
        </aside>

        <section className="panel p-4 md:p-6 min-w-0">
          {tab === "appearance" && <div className="space-y-6"><Title t="Giao diện" d="Thay đổi được áp dụng ngay lập tức." />
            <Setting label="Theme"><div className="flex gap-2 flex-wrap">{["dark","light","system"].map(v => <Choice key={v} active={prefs.theme===v} onClick={() => savePrefs({theme:v})}>{v}</Choice>)}</div></Setting>
            <Setting label="Màu chủ đạo"><div className="flex gap-3">{["#00d4ff","#22c55e","#8b5cf6","#ef4444","#f59e0b"].map(c => <button key={c} aria-label={c} onClick={() => savePrefs({accentColor:c})} className={`h-11 w-11 rounded-full border-4 ${prefs.accentColor===c ? "border-white" : "border-transparent"}`} style={{background:c}} />)}</div></Setting>
            <Setting label="Ngôn ngữ"><select value={prefs.language??"vi"} onChange={e=>savePrefs({language:e.target.value})} className="Input"><option value="vi">Tiếng Việt</option><option value="en">English</option></select></Setting>
            <Setting label="Font chữ"><select value={prefs.fontFamily??"inter"} onChange={e=>savePrefs({fontFamily:e.target.value})} className="Input"><option value="inter">Inter</option><option value="system">System</option><option value="mono">JetBrains Mono</option></select></Setting>
          </div>}

          {tab === "account" && <div className="space-y-5"><Title t="Tài khoản" d="Thông tin hồ sơ cá nhân." />
            <div className="grid sm:grid-cols-2 gap-4"><Field l="Họ tên" v={form.name} set={v=>setForm({...form,name:v})}/><Field l="Số điện thoại" v={form.phoneNumber} set={v=>setForm({...form,phoneNumber:v})}/><Field l="Avatar URL" v={form.avatarUrl} set={v=>setForm({...form,avatarUrl:v})}/><Field l="Email" v={user?.email??""} disabled /></div>
            <button className="btn-orca min-h-11" onClick={async()=>{setSaving(true);try{await jsonFetch("/api/v1/users/me",{method:"PATCH",body:JSON.stringify(form)});await refreshUser();notify("Đã cập nhật hồ sơ");}catch(e){notify(String(e))}finally{setSaving(false)}}}>{saving?"Đang lưu...":"Lưu thông tin"}</button>
          </div>}

          {tab === "security" && <div className="space-y-6"><Title t="Bảo mật" d="Mật khẩu, 2FA và nhật ký hoạt động." />
            <div className="grid sm:grid-cols-3 gap-3"><Field l="Mật khẩu hiện tại" type="password" v={passwords.currentPassword} set={v=>setPasswords({...passwords,currentPassword:v})}/><Field l="Mật khẩu mới" type="password" v={passwords.newPassword} set={v=>setPasswords({...passwords,newPassword:v})}/><Field l="Xác nhận" type="password" v={passwords.confirm} set={v=>setPasswords({...passwords,confirm:v})}/></div>
            <button className="btn-orca min-h-11" onClick={async()=>{if(passwords.newPassword!==passwords.confirm)return notify("Mật khẩu xác nhận không khớp");try{await jsonFetch("/api/v1/users/change-password",{method:"POST",body:JSON.stringify(passwords)});setPasswords({currentPassword:"",newPassword:"",confirm:""});notify("Đổi mật khẩu thành công")}catch(e){notify(e instanceof Error?e.message:String(e))}}}>Đổi mật khẩu</button>
            <div className="rounded-lg border border-[#1a3558] p-4"><div className="font-semibold text-white">Xác thực hai lớp</div><p className="text-xs text-slate-500 mt-1">2FA Authenticator đang trong trạng thái: {user?.twoFactorEnabled ? "Đã bật" : "Chưa bật"}.</p><button className="btn-orca-outline mt-3 min-h-11" disabled>Thiết lập 2FA (sắp ra mắt)</button></div>
            <div><h3 className="font-semibold text-white mb-2">Nhật ký hoạt động</h3><div className="space-y-2 max-h-64 overflow-auto">{logs.map(l=><div key={l.id} className="rounded bg-slate-900/30 p-2 text-xs flex justify-between"><span>{l.action}</span><span className="text-slate-500">{new Date(l.createdAt).toLocaleString("vi-VN")}</span></div>)}</div></div>
          </div>}

          {tab === "notifications" && <NotificationSettings notify={notify} />}

          {tab === "sessions" && <div className="space-y-4"><Title t="Phiên đăng nhập" d="Quản lý thiết bị đang đăng nhập." />{sessions.map(s=><div key={s.id} className="rounded-lg border border-[#1a3558] p-3 flex flex-wrap justify-between gap-3"><div><div className="text-sm text-white">{s.userAgent?.slice(0,80)??"Thiết bị không xác định"} {s.current&&<span className="text-emerald-400">· Hiện tại</span>}</div><div className="text-xs text-slate-500 mt-1">IP {s.ipAddress} · {new Date(s.createdAt).toLocaleString("vi-VN")}</div></div>{!s.current&&<button onClick={async()=>{await fetch(`/api/v1/users/sessions/${s.id}`,{method:"DELETE"});setSessions(sessions.filter(x=>x.id!==s.id));notify("Đã đăng xuất phiên")}} className="btn-orca-ghost min-h-11">Đăng xuất</button>}</div>)}<button onClick={async()=>{await fetch("/api/v1/users/sessions",{method:"DELETE"});setSessions(sessions.filter(s=>s.current));notify("Đã đăng xuất các phiên khác")}} className="btn-orca-outline min-h-11">Đăng xuất tất cả phiên khác</button></div>}

          {tab === "data" && <div className="space-y-6"><Title t="Quản lý dữ liệu" d="Xuất hoặc xóa dữ liệu cá nhân." /><div className="rounded-lg border border-[#1a3558] p-4"><h3 className="font-semibold text-white">Xuất dữ liệu JSON</h3><p className="text-xs text-slate-500 mt-1">Bao gồm hồ sơ, preferences, sessions và audit logs.</p><button className="btn-orca-outline mt-3 min-h-11" onClick={async()=>{const d=await jsonFetch("/api/v1/users/export-data",{method:"POST"});const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:"application/json"}));a.download="orca-personal-data.json";a.click()}}>Tải dữ liệu</button></div><DeleteAccount jsonFetch={jsonFetch}/></div>}

          {tab === "support" && <div className="space-y-5"><Title t="Trợ giúp & Hỗ trợ" d="Chúng tôi luôn sẵn sàng hỗ trợ." /><div className="grid sm:grid-cols-2 gap-3">{[["FAQ","Câu hỏi thường gặp"],["Email","support@orcafinancial.vn"],["Tài liệu","Hướng dẫn sử dụng nền tảng"],["Cộng đồng","Discord / Telegram"]].map(x=><div key={x[0]} className="rounded-lg border border-[#1a3558] p-4"><div className="font-semibold text-white">{x[0]}</div><div className="text-xs text-slate-500 mt-1">{x[1]}</div></div>)}</div><textarea className="Input w-full min-h-32" placeholder="Mô tả lỗi hoặc góp ý của bạn..."/><button className="btn-orca min-h-11" onClick={()=>notify("Cảm ơn phản hồi của bạn")}>Gửi phản hồi</button></div>}
        </section>
      </div>
    </div>
  </ProtectedPage>;
}

function Title({t,d}:{t:string;d:string}){return <div><h2 className="text-xl font-bold text-white">{t}</h2><p className="text-xs text-slate-500 mt-1">{d}</p></div>}
function Setting({label,children}:{label:string;children:React.ReactNode}){return <div><div className="text-sm text-slate-300 mb-2">{label}</div>{children}</div>}
function Choice({active,onClick,children}:{active:boolean;onClick:()=>void;children:React.ReactNode}){return <button onClick={onClick} className={`min-h-11 rounded-lg border px-4 capitalize ${active?"border-[#00d4ff] bg-[#00d4ff]/15 text-[#00d4ff]":"border-slate-700 text-slate-400"}`}>{children}</button>}
function Field({l,v,set=()=>{},disabled=false,type="text"}:{l:string;v:string;set?:(x:string)=>void;disabled?:boolean;type?:string}){return <label className="text-sm text-slate-300">{l}<input type={type} value={v} onChange={e=>set(e.target.value)} disabled={disabled} className="Input mt-1 w-full disabled:opacity-50"/></label>}
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}){return <div className="flex items-center justify-between gap-3 rounded-lg border border-[#1a3558] p-3"><span className="text-sm text-slate-300">{label}</span><button onClick={()=>onChange(!checked)} className={`relative h-7 w-12 rounded-full transition ${checked?"bg-[#00d4ff]":"bg-slate-700"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked?"left-6":"left-1"}`}/></button></div>}
function DeleteAccount({jsonFetch}:{jsonFetch:(u:string,i?:RequestInit)=>Promise<any>}){const[c,setC]=useState("");return <div className="rounded-lg border border-rose-800 bg-rose-950/20 p-4"><h3 className="font-semibold text-rose-300">Xóa tài khoản</h3><p className="text-xs text-slate-500 mt-1">Nhập DELETE để xác nhận. Thao tác không thể hoàn tác.</p><div className="flex flex-col sm:flex-row gap-2 mt-3"><input value={c} onChange={e=>setC(e.target.value)} className="Input flex-1" placeholder="DELETE"/><button disabled={c!=="DELETE"} onClick={async()=>{await jsonFetch("/api/v1/users/me",{method:"DELETE",body:JSON.stringify({confirmation:c})});window.location.href="/"}} className="min-h-11 rounded-lg bg-rose-600 px-4 font-semibold text-white disabled:opacity-40">Xóa vĩnh viễn</button></div></div>}

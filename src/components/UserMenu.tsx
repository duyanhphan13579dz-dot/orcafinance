"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth/context";

export function UserMenu() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (loading) return <div className="h-10 w-20 rounded bg-slate-800/40 animate-pulse" />;
  if (!user) return <div className="flex gap-2"><Link href="/auth/login" className="btn-orca-ghost min-h-10">Đăng nhập</Link><Link href="/auth/register" className="btn-orca text-xs min-h-10">Đăng ký</Link></div>;
  return <div className="relative">
    <button onClick={()=>setOpen(!open)} className="flex min-h-11 items-center gap-2 rounded-lg border border-[#1a3558] px-2.5 text-sm text-white">
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover"/> : <span className="h-7 w-7 rounded-full bg-[#00d4ff]/20 text-[#00d4ff] flex items-center justify-center font-bold">{(user.name||user.email)[0].toUpperCase()}</span>}
      <span className="hidden xl:inline max-w-28 truncate">{user.name || user.email}</span>
    </button>
    {open && <div className="absolute right-0 mt-2 w-52 rounded-lg border border-[#1a3558] bg-[#0A2540] p-2 shadow-2xl z-50">
      <Link onClick={()=>setOpen(false)} href="/settings" className="block rounded px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800">⚙️ Cài đặt</Link>
      <button onClick={()=>void logout()} className="w-full text-left rounded px-3 py-2.5 text-sm text-rose-300 hover:bg-rose-950/30">Đăng xuất</button>
    </div>}
  </div>;
}

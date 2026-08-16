"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fmtNum, fmtPct, fmtVol, usePoll } from "@/lib/client";

type Shape = "circle" | "square";
interface Item {
  symbol: string; name: string; exchange: string; price: number | null;
  changePercent: number | null; volume: number | null;
  status: "up" | "down" | "unchanged" | "no-data";
  color: "green" | "red" | "yellow"; intensity: number;
  source: string | null; updatedAt: string | null;
}
interface Stats { up: number; down: number; unchanged: number; noData: number; total: number }

function cellColor(item: Item) {
  if (item.color === "yellow") return item.status === "no-data" ? "rgba(148,163,184,.18)" : "rgba(245,158,11,.56)";
  const alpha = 0.30 + item.intensity * 0.7;
  return item.color === "green" ? `rgba(16,185,129,${alpha})` : `rgba(244,63,94,${alpha})`;
}

const STATUS_LABEL: Record<string, string> = {
  "pre-market": "Trước phiên", trading: "Đang giao dịch", "lunch-break": "Nghỉ trưa",
  "post-market": "Đã đóng cửa", closed: "Thị trường nghỉ",
};

export function StockHeatmap({ compact = false }: { compact?: boolean }) {
  const { data, meta, error, loading } = usePoll<Item[]>("/market/heatmap", 5000);
  const [shape, setShape] = useState<Shape>("square");
  const [selected, setSelected] = useState<string | null>(null);
  const marketStatus = String(meta?.marketStatus ?? "pre-market");
  const stats = meta?.stats as unknown as Stats | undefined;

  useEffect(() => {
    const saved = localStorage.getItem("orca_heatmap_shape");
    if (saved === "circle" || saved === "square") setShape(saved);
  }, []);
  const changeShape = (next: Shape) => {
    setShape(next); localStorage.setItem("orca_heatmap_shape", next);
  };

  const items = useMemo(() => compact ? (data ?? []).slice(0, 48) : (data ?? []), [data, compact]);

  return <section className="panel p-3 md:p-5 relative">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <div className="flex items-center gap-2"><h2 className="text-base md:text-lg font-bold text-white">Heatmap biến động cổ phiếu</h2><span className={`h-2 w-2 rounded-full ${marketStatus === "trading" ? "bg-emerald-400 live-dot" : "bg-amber-400"}`}/></div>
        <div className="text-[11px] text-slate-500 mt-1">{STATUS_LABEL[marketStatus] ?? marketStatus} · cập nhật mỗi 5 giây · {items.length}/{stats?.total ?? items.length} mã</div>
      </div>
      <div className="flex rounded-lg border border-[#1a3558] bg-[#0a1d33] p-1" aria-label="Chọn hình dạng heatmap">
        <button onClick={()=>changeShape("circle")} className={`min-h-9 px-3 rounded-md text-xs ${shape==="circle"?"bg-[#00d4ff]/15 text-[#00d4ff]":"text-slate-500"}`}>● Tròn</button>
        <button onClick={()=>changeShape("square")} className={`min-h-9 px-3 rounded-md text-xs ${shape==="square"?"bg-[#00d4ff]/15 text-[#00d4ff]":"text-slate-500"}`}>■ Vuông</button>
      </div>
    </div>

    {stats && <div className="flex flex-wrap gap-3 text-[11px] mb-3"><span className="text-emerald-400">▲ {stats.up} tăng</span><span className="text-rose-400">▼ {stats.down} giảm</span><span className="text-amber-400">■ {stats.unchanged} đứng</span><span className="text-slate-500">○ {stats.noData} chờ dữ liệu</span></div>}
    {error && <div className="rounded border border-rose-800 bg-rose-950/20 p-3 text-sm text-rose-300 mb-3">{error}</div>}
    {loading && !data && <div className="py-12 text-center text-sm text-slate-500">Đang dựng heatmap từ Data Engine…</div>}

    <div className={`grid gap-1.5 ${compact ? "grid-cols-[repeat(auto-fill,minmax(52px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(58px,1fr))]"}`}>
      {items.map((item) => {
        const open = selected === item.symbol;
        return <div key={item.symbol} className="relative">
          <button
            onClick={() => setSelected(open ? null : item.symbol)}
            onBlur={() => setTimeout(()=>setSelected(null),150)}
            className={`w-full aspect-square relative flex flex-col items-center justify-center border border-white/5 active:scale-95 transition-transform ${shape === "circle" ? "rounded-full" : "rounded-md"}`}
            style={{ backgroundColor: cellColor(item) }}
            aria-label={`${item.symbol}: ${fmtPct(item.changePercent)}`}
          >
            <span className="text-[11px] md:text-xs font-black text-white drop-shadow">{item.symbol}</span>
            <span className="text-[8px] md:text-[9px] font-mono text-white/80">{marketStatus === "pre-market" || marketStatus === "closed" ? "—" : fmtPct(item.changePercent)}</span>
          </button>
          {open && <div className="absolute z-30 left-1/2 -translate-x-1/2 bottom-[calc(100%+6px)] w-52 rounded-lg border border-[#2a4a75] bg-[#071a2d] p-3 shadow-2xl text-left">
            <div className="flex justify-between"><span className="font-bold text-white">{item.symbol}</span><span className={item.color==="green"?"text-emerald-400":item.color==="red"?"text-rose-400":"text-amber-400"}>{fmtPct(item.changePercent)}</span></div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">{item.name} · {item.exchange || "—"}</div>
            <div className="grid grid-cols-2 gap-1 mt-2 text-[10px]"><span className="text-slate-500">Giá</span><span className="text-right text-white">{fmtNum(item.price)}</span><span className="text-slate-500">Khối lượng</span><span className="text-right text-white">{fmtVol(item.volume)}</span></div>
            <Link href={`/stocks/${item.symbol}`} className="mt-2 min-h-9 flex items-center justify-center rounded bg-[#00d4ff] text-[#0A2540] text-xs font-semibold">Xem cổ phiếu →</Link>
          </div>}
        </div>;
      })}
    </div>
    {compact && (data?.length ?? 0) > items.length && <Link href="/heatmap" className="mt-4 min-h-11 flex items-center justify-center rounded-lg border border-[#00d4ff]/40 text-[#00d4ff] text-sm">Mở heatmap toàn thị trường →</Link>}
  </section>;
}

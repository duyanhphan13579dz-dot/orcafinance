"use client";

import Link from "next/link";
import { ProtectedPage } from "@/components/ProtectedPage";
import { changeColor, fmtNum, fmtPct, fmtVol, timeAgo, usePoll } from "@/lib/client";
import { StockHeatmap } from "@/components/heatmap/StockHeatmap";

interface Quote { symbol: string; close: number; volume: number; changePct: number | null; source: string; }
interface IndexQuote extends Quote { code: string; name: string; }
interface Overview {
  indices: IndexQuote[];
  breadth: { advancers: number; decliners: number; unchanged: number; sample: number };
  quotes: Quote[];
  topGainers: Quote[];
  topLosers: Quote[];
  crypto: Array<{ symbol: string; priceUsd: number; change24hPct: number }>;
}
interface NewsItem { id: number; title: string; link: string; sourceName: string; publishedAt: string; }

export default function DashboardPage() {
  const market = usePoll<Overview>("/market/overview", 15000);
  const news = usePoll<{ items: NewsItem[] }>("/news?limit=6", 60000);
  const data = market.data;
  return <ProtectedPage featureName="tổng quan thị trường">
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="font-mono text-[10px] tracking-[.3em] uppercase text-[#00d4ff]">ORCA Market Intelligence</div><h1 className="text-3xl font-black text-white mt-1">Tổng quan thị trường</h1><p className="text-sm text-slate-400 mt-1">Dữ liệu cập nhật tự động từ Data Engine.</p></div>
        <div className="flex gap-2"><Link href="/screener" className="btn-orca-outline min-h-11">Chạy bộ lọc</Link><Link href="/agent" className="btn-orca min-h-11">Hỏi AI Agent</Link></div>
      </div>

      {market.error && <div className="panel border-rose-800 p-4 text-sm text-rose-300">{market.error}</div>}
      {!data && <div className="panel p-10 text-center text-slate-500">Đang tải dữ liệu thị trường...</div>}
      {data && <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.indices.map(i=><div key={i.code} className="panel p-4"><div className="text-xs text-slate-500">{i.name}</div><div className="text-2xl font-bold text-white mt-1">{fmtNum(i.close)}</div><div className={`text-sm mt-1 ${changeColor(i.changePct)}`}>{fmtPct(i.changePct)}</div><div className="text-[10px] text-slate-600 mt-1">KL {fmtVol(i.volume)} · {i.source}</div></div>)}
          <div className="panel p-4"><div className="text-xs text-slate-500">Độ rộng</div><div className="mt-3 flex justify-between text-sm"><span className="text-emerald-400">▲ {data.breadth.advancers}</span><span className="text-amber-400">■ {data.breadth.unchanged}</span><span className="text-rose-400">▼ {data.breadth.decliners}</span></div><div className="mt-3 h-2 flex overflow-hidden rounded-full bg-slate-800"><div className="bg-emerald-500" style={{width:`${data.breadth.sample?data.breadth.advancers/data.breadth.sample*100:0}%`}}/><div className="bg-rose-500 flex-1"/></div></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="panel p-4 lg:col-span-2 overflow-x-auto"><h2 className="font-semibold text-white mb-3">Bảng giá vốn hóa lớn</h2><table className="w-full min-w-[520px] text-sm"><thead><tr className="text-xs text-slate-500 border-b border-slate-700"><th className="text-left py-2">Mã</th><th className="text-right">Giá</th><th className="text-right">Thay đổi</th><th className="text-right">Khối lượng</th></tr></thead><tbody>{data.quotes.map(q=><tr key={q.symbol} className="border-b border-slate-800/60"><td className="py-2"><Link href={`/stocks/${q.symbol}`} className="font-bold text-[#00d4ff]">{q.symbol}</Link></td><td className="text-right">{fmtNum(q.close)}</td><td className={`text-right ${changeColor(q.changePct)}`}>{fmtPct(q.changePct)}</td><td className="text-right text-slate-400">{fmtVol(q.volume)}</td></tr>)}</tbody></table></div>
          <div className="space-y-4"><div className="panel p-4"><h2 className="font-semibold text-white mb-3">Crypto</h2>{data.crypto.map(c=><div key={c.symbol} className="flex justify-between py-1.5 text-sm"><span>{c.symbol}</span><span>${c.priceUsd.toLocaleString()}</span><span className={changeColor(c.change24hPct)}>{fmtPct(c.change24hPct)}</span></div>)}</div><div className="panel p-4"><h2 className="font-semibold text-white mb-3">Truy cập nhanh</h2><div className="grid grid-cols-2 gap-2 text-xs">{[["Hàng hóa","/commodities"],["Báo cáo","/reports"],["Theo dõi","/watchlist"],["Cài đặt","/settings"]].map(x=><Link key={x[0]} href={x[1]} className="min-h-11 rounded border border-slate-700 flex items-center justify-center hover:border-[#00d4ff]">{x[0]}</Link>)}</div></div></div>
        </div>
      </>}

      <StockHeatmap compact />

      <div className="panel p-4"><div className="flex justify-between mb-3"><h2 className="font-semibold text-white">Tin mới nhất</h2><Link href="/news" className="text-xs text-[#00d4ff]">Xem tất cả →</Link></div><div className="grid md:grid-cols-2 gap-2">{(news.data?.items??[]).map(n=><a key={n.id} href={n.link} target="_blank" rel="noreferrer" className="rounded border border-slate-800 p-3 hover:border-slate-600"><div className="text-sm text-slate-200 line-clamp-2">{n.title}</div><div className="text-[10px] text-slate-500 mt-1">{n.sourceName} · {timeAgo(n.publishedAt)}</div></a>)}</div></div>
    </div>
  </ProtectedPage>;
}

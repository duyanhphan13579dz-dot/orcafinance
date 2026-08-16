import { asc, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { companies, priceSnapshots } from "@/db/schema";
import { FEATURED_SYMBOLS, getQuotes } from "@/lib/market";
import { cached } from "@/lib/connectors/core";
import { logger } from "@/lib/logger";

export type MarketStatus = "pre-market" | "trading" | "lunch-break" | "post-market" | "closed";

export interface HeatmapItem {
  symbol: string;
  name: string;
  exchange: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  status: "up" | "down" | "unchanged" | "no-data";
  color: "green" | "red" | "yellow";
  intensity: number;
  source: string | null;
  updatedAt: string | null;
}

export function vietnamMarketStatus(now = new Date()): MarketStatus {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = part("weekday");
  if (["Sat", "Sun"].includes(weekday)) return "closed";
  const mins = Number(part("hour")) * 60 + Number(part("minute"));
  if (mins < 9 * 60) return "pre-market";
  if (mins >= 9 * 60 && mins <= 11 * 60 + 30) return "trading";
  if (mins > 11 * 60 + 30 && mins < 13 * 60) return "lunch-break";
  if (mins >= 13 * 60 && mins <= 15 * 60) return "trading";
  return "post-market";
}

function classify(change: number | null, forceNeutral: boolean) {
  if (forceNeutral || change === null || !Number.isFinite(change)) {
    return { status: change === null ? "no-data" as const : "unchanged" as const, color: "yellow" as const, intensity: 0 };
  }
  if (Math.abs(change) < 0.005) return { status: "unchanged" as const, color: "yellow" as const, intensity: 0 };
  return {
    status: change > 0 ? "up" as const : "down" as const,
    color: change > 0 ? "green" as const : "red" as const,
    intensity: Math.min(1, Math.abs(change) / 7),
  };
}

/**
 * Refreshes the liquid featured universe without blocking the heatmap if an
 * upstream provider is slow. The complete grid always comes from DB companies;
 * companies without a real snapshot are shown as yellow/no-data, never mocked.
 */
async function warmFeaturedSnapshots() {
  try {
    await getQuotes(FEATURED_SYMBOLS);
  } catch (err) {
    logger.warn("heatmap_warm_failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

export async function getMarketHeatmap(): Promise<{
  items: HeatmapItem[];
  marketStatus: MarketStatus;
  timestamp: string;
  stats: { up: number; down: number; unchanged: number; noData: number; total: number };
}> {
  return cached("market:heatmap", 5_000, async () => {
    // Warm in the background, while returning DB snapshots immediately.
    void warmFeaturedSnapshots();
    const [companyRows, snapshots] = await Promise.all([
      db.select({ symbol: companies.symbol, name: companies.name, exchange: companies.exchange })
        .from(companies).orderBy(asc(companies.symbol)),
      db.select().from(priceSnapshots).orderBy(desc(priceSnapshots.updatedAt)),
    ]);

    const universe = new Map<string, { symbol: string; name: string; exchange: string }>();
    for (const s of FEATURED_SYMBOLS) universe.set(s, { symbol: s, name: s, exchange: "" });
    for (const c of companyRows) {
      // Stock-like symbols only; exclude indices/derivatives from the equity map.
      if (/^[A-Z]{3}$/.test(c.symbol)) universe.set(c.symbol, c);
    }
    const latest = new Map<string, typeof snapshots[number]>();
    for (const s of snapshots) if (!latest.has(s.symbol)) latest.set(s.symbol, s);

    const marketStatus = vietnamMarketStatus();
    const forceNeutral = marketStatus === "pre-market" || marketStatus === "closed";
    const items: HeatmapItem[] = [...universe.values()].map((c) => {
      const snap = latest.get(c.symbol);
      const state = classify(snap?.changePct ?? null, forceNeutral);
      return {
        symbol: c.symbol,
        name: c.name,
        exchange: c.exchange,
        price: snap?.close ?? null,
        changePercent: snap?.changePct ?? null,
        volume: snap?.volume ?? null,
        ...state,
        source: snap?.source ?? null,
        updatedAt: snap?.updatedAt?.toISOString() ?? null,
      };
    }).sort((a, b) => {
      // Put available, liquid symbols first; no-data stays visible after them.
      if (a.price === null && b.price !== null) return 1;
      if (a.price !== null && b.price === null) return -1;
      return (b.volume ?? 0) - (a.volume ?? 0);
    });

    return {
      items,
      marketStatus,
      timestamp: new Date().toISOString(),
      stats: {
        up: items.filter((x) => x.status === "up").length,
        down: items.filter((x) => x.status === "down").length,
        unchanged: items.filter((x) => x.status === "unchanged").length,
        noData: items.filter((x) => x.status === "no-data").length,
        total: items.length,
      },
    };
  });
}

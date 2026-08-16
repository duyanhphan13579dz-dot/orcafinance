/**
 * Real commodity connectors.
 *
 * Primary source:   https://simplize.vn/hang-hoa
 * Secondary source: https://data.vietnambiz.vn/goods
 * FX source:        https://open.er-api.com/v6/latest/USD
 *
 * No fabricated data: if every provider is unavailable or its HTML format
 * changes, this module returns no records plus detailed errors. The service
 * layer keeps the last-known-good database values and the UI labels them stale.
 */

import { cachedWithStaleFallback, fetchWithRetry, getBreaker, markStale, readJsonSafe, readTextSafe } from "@/lib/connectors/core";
import { forProvider } from "@/lib/logger";
import { COMMODITIES_LIST } from "./data";

export interface CommodityPriceData {
  symbol: string;
  price: number;
  currency: string;
  unit: string;
  timestamp: Date;
  source: string;
}

export interface ExchangeRateData {
  currency: string;
  rate: number;
  timestamp: Date;
  source: string;
}

const log = forProvider("commodities-connectors");
const SIMPLIZE = "simplize-commodities";
const VIETNAMBIZ = "vietnambiz-goods";
const FX_PROVIDER = "open-er-api";

interface CommodityMap {
  symbol: string;
  aliases: string[];
  // Normalize the source's displayed value into the canonical unit in data.ts.
  normalize?: (n: number) => number;
}

const LB_PER_METRIC_TON = 2204.62262185;
const CWT_PER_METRIC_TON = 22.0462262185;

const SIMPLIZE_MAP: CommodityMap[] = [
  { symbol: "GOLD_SJC_BUY", aliases: ["Vàng SJC (mua vào)"], normalize: (n) => n * 1000 },
  { symbol: "GOLD_SJC_SELL", aliases: ["Vàng SJC (bán ra)"], normalize: (n) => n * 1000 },
  { symbol: "STEEL_D10", aliases: ["Thép D10"], normalize: (n) => n * 1000 },
  { symbol: "GAS_RON95", aliases: ["Xăng RON95"], normalize: (n) => n * 1000 },
  { symbol: "GAS_RON92", aliases: ["Xăng RON92"], normalize: (n) => n * 1000 },
  { symbol: "DIESEL_DO", aliases: ["Dầu DO"], normalize: (n) => n * 1000 },
  { symbol: "PIG_NORTH", aliases: ["Heo hơi miền Bắc"] },
  { symbol: "SHRIMP_CARD", aliases: ["Tôm thẻ (tại ao)", "Tôm thẻ"], normalize: (n) => n < 1000 ? n * 1000 : n },
  { symbol: "CATFISH_TRA", aliases: ["Cá tra (tại ao)", "Cá tra"], normalize: (n) => n < 1000 ? n * 1000 : n },
  { symbol: "WTI_CRUDE", aliases: ["Dầu thô (WTI)"] },
  { symbol: "GAS_NATURAL", aliases: ["Khí thiên nhiên"] },
  { symbol: "COAL_COKING", aliases: ["Than cốc"] },
  { symbol: "GOLD_WORLD", aliases: ["Vàng"] },
  { symbol: "SILVER", aliases: ["Bạc"] },
  // Simplize quotes copper in USD/lb; canonical storage is USD/metric ton.
  { symbol: "COPPER", aliases: ["Đồng"], normalize: (n) => n * LB_PER_METRIC_TON },
  { symbol: "NICKEL", aliases: ["Nickel"] },
  { symbol: "IRON_ORE", aliases: ["Quặng sắt"] },
  { symbol: "STEEL_HRC", aliases: ["Thép HRC"] },
  { symbol: "CORN", aliases: ["Ngô"] },
  { symbol: "SOYBEAN", aliases: ["Đậu nành"] },
  // Simplize quotes rough rice in USD/cwt; canonical storage is USD/metric ton.
  { symbol: "RICE", aliases: ["Gạo"], normalize: (n) => n * CWT_PER_METRIC_TON },
  { symbol: "FERTILIZER_UREA", aliases: ["Phân URE"] },
  { symbol: "COFFEE_ARABICA", aliases: ["Cà phê Arabica"] },
  { symbol: "COFFEE_ROBUSTA", aliases: ["Cà phê Robusta"] },
  { symbol: "COTTON", aliases: ["Bông"] },
  // Simplize quotes sugar in US cents/lb; canonical storage is USD/metric ton.
  { symbol: "SUGAR", aliases: ["Đường"], normalize: (n) => (n / 100) * LB_PER_METRIC_TON },
  { symbol: "MILK_WMP", aliases: ["Sữa bột nguyên kem nguyên liệu"] },
  { symbol: "MILK_SMP", aliases: ["Sữa bột tách béo nguyên liệu"] },
  { symbol: "RUBBER_TSR20", aliases: ["Cao su TSR20 Tokyo"] },
  { symbol: "RUBBER_RSS3", aliases: ["Cao su RSS3 Tokyo"] },
  { symbol: "PIG_CHINA", aliases: ["Heo hơi Trung Quốc"] },
];

// VietnamBiz supplements domestic/fertilizer data if Simplize is missing.
const VIETNAMBIZ_MAP: CommodityMap[] = [
  { symbol: "PIG_NORTH", aliases: ["Giá heo hơi trong nước", "Heo hơi trong nước"] },
  { symbol: "SHRIMP_CARD", aliases: ["Tôm thẻ"] },
  { symbol: "SUGAR", aliases: ["Đường"] },
  { symbol: "FERTILIZER_UREA", aliases: ["Ure Trung Đông", "Phân Ure Phú Mỹ", "Phân Ure Cà Mau"] },
  { symbol: "COTTON", aliases: ["Vải cotton Mỹ"] },
  { symbol: "COFFEE_ROBUSTA", aliases: ["Cà phê"] },
];

function decodeHtml(s: string): string {
  return s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function textOf(html: string): string {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractRows(html: string): string[] {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
}

function extractCells(row: string): string[] {
  return [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
}

function findMapping(text: string, mappings: CommodityMap[]): CommodityMap | null {
  // Sort aliases by length so "Vàng SJC" wins over generic "Vàng".
  const candidates = mappings.flatMap((m) => m.aliases.map((a) => ({ m, alias: a })))
    .sort((a, b) => b.alias.length - a.alias.length);
  return candidates.find(({ alias }) => text.toLocaleLowerCase("vi").includes(alias.toLocaleLowerCase("vi")))?.m ?? null;
}

function definition(symbol: string) {
  return COMMODITIES_LIST.find((c) => c.symbol === symbol);
}

/** Exported for parser regression tests against captured provider HTML. */
export function parseSimplizeHtml(html: string, fetchedAt = new Date()): CommodityPriceData[] {
  const bySymbol = new Map<string, CommodityPriceData>();
  for (const row of extractRows(html)) {
    const cells = extractCells(row);
    // Desktop table has 9 cells. Mobile duplicate has only 3 — ignore it.
    if (cells.length < 5) continue;
    const labelText = textOf(cells[0]);
    const mapping = findMapping(labelText, SIMPLIZE_MAP);
    if (!mapping || bySymbol.has(mapping.symbol)) continue;
    const rawPrice = parseNumber(textOf(cells[2]));
    const def = definition(mapping.symbol);
    if (rawPrice === null || !def) continue;
    const normalized = mapping.normalize ? mapping.normalize(rawPrice) : rawPrice;
    if (!Number.isFinite(normalized) || normalized <= 0) continue;
    bySymbol.set(mapping.symbol, {
      symbol: mapping.symbol,
      price: Number(normalized.toFixed(6)),
      currency: def.currency,
      unit: def.unit,
      timestamp: fetchedAt,
      source: "simplize.vn/hang-hoa",
    });
  }
  return [...bySymbol.values()];
}

function parseVnDate(raw: string, fallback: Date): Date {
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return fallback;
  // Store 00:00 Asia/Ho_Chi_Minh as 17:00 UTC of the previous calendar day.
  return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), -7, 0, 0));
}

/** Exported for parser regression tests against captured provider HTML. */
export function parseVietnamBizHtml(html: string, fetchedAt = new Date()): CommodityPriceData[] {
  const bySymbol = new Map<string, CommodityPriceData>();
  for (const row of extractRows(html)) {
    const cells = extractCells(row);
    if (cells.length < 6) continue;
    const labelText = textOf(cells[0]);
    const mapping = findMapping(labelText, VIETNAMBIZ_MAP);
    if (!mapping || bySymbol.has(mapping.symbol)) continue;
    const rawPrice = parseNumber(textOf(cells[1]));
    const def = definition(mapping.symbol);
    if (rawPrice === null || !def) continue;
    let normalized = mapping.normalize ? mapping.normalize(rawPrice) : rawPrice;
    // VietnamBiz sugar is already USD/ton; cotton is displayed as an index
    // labelled USD/ton. Both match our canonical definitions after mapping.
    if (!Number.isFinite(normalized) || normalized <= 0) continue;
    bySymbol.set(mapping.symbol, {
      symbol: mapping.symbol,
      price: Number(normalized.toFixed(6)),
      currency: def.currency,
      unit: def.unit,
      timestamp: parseVnDate(textOf(cells[5]), fetchedAt),
      source: "data.vietnambiz.vn/goods",
    });
  }
  return [...bySymbol.values()];
}

async function fetchHtmlProvider(
  name: string,
  url: string,
  parser: (html: string, fetchedAt?: Date) => CommodityPriceData[],
): Promise<CommodityPriceData[]> {
  return getBreaker(name).exec(async () => {
    const res = await fetchWithRetry(url, {
      provider: name,
      timeoutMs: 15_000,
      retries: 3,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
      },
    });
    const html = await readTextSafe(res, name, url);
    const records = parser(html, new Date());
    if (!records.length) {
      log.error("commodity_html_parse_empty", { provider: name, url, rawSnippet: html.slice(0, 500) });
      throw new Error(`${name} returned HTML but no commodity rows could be parsed`);
    }
    log.info("commodity_provider_parsed", { provider: name, records: records.length });
    return records;
  });
}

export async function fetchSimplizeCommodities(): Promise<CommodityPriceData[]> {
  return fetchHtmlProvider(SIMPLIZE, "https://simplize.vn/hang-hoa", parseSimplizeHtml);
}

export async function fetchVietnamBizCommodities(): Promise<CommodityPriceData[]> {
  return fetchHtmlProvider(VIETNAMBIZ, "https://data.vietnambiz.vn/goods", parseVietnamBizHtml);
}

interface OpenErPayload {
  result: string;
  time_last_update_unix: number;
  rates: Record<string, number>;
}

export async function fetchExchangeRates(): Promise<ExchangeRateData[]> {
  return getBreaker(FX_PROVIDER).exec(async () => {
    const url = "https://open.er-api.com/v6/latest/USD";
    const res = await fetchWithRetry(url, { provider: FX_PROVIDER, timeoutMs: 10_000, retries: 3 });
    const data = await readJsonSafe<OpenErPayload>(res, FX_PROVIDER, url);
    const vndPerUsd = data.rates?.VND;
    if (data.result !== "success" || !Number.isFinite(vndPerUsd) || vndPerUsd <= 0) {
      throw new Error("FX provider payload missing VND rate");
    }
    const timestamp = new Date((data.time_last_update_unix || Date.now() / 1000) * 1000);
    const wanted = ["USD", "JPY", "CNY"];
    const rates: ExchangeRateData[] = [];
    for (const currency of wanted) {
      const perUsd = data.rates[currency];
      if (!Number.isFinite(perUsd) || perUsd <= 0) continue;
      rates.push({
        currency,
        rate: currency === "USD" ? vndPerUsd : vndPerUsd / perUsd,
        timestamp,
        source: "open.er-api.com",
      });
    }
    if (rates.length !== wanted.length) throw new Error("FX provider missing one or more required currencies");
    return rates;
  });
}

/**
 * Fetch both real providers in parallel. Simplize wins per symbol; VietnamBiz
 * only fills missing symbols. A stale cached snapshot is returned if both
 * providers become temporarily unavailable.
 */
export async function fetchAllCommoditiesData(): Promise<{
  prices: CommodityPriceData[];
  exchangeRates: ExchangeRateData[];
  errors: string[];
  stale?: boolean;
}> {
  const errors: string[] = [];

  const priceResult = await cachedWithStaleFallback("commodities:real-sources", 5 * 60_000, async () => {
    const [simplize, vietnamBiz] = await Promise.allSettled([
      fetchSimplizeCommodities(),
      fetchVietnamBizCommodities(),
    ]);
    const primary = simplize.status === "fulfilled" ? simplize.value : [];
    const secondary = vietnamBiz.status === "fulfilled" ? vietnamBiz.value : [];
    if (simplize.status === "rejected") errors.push(`Simplize: ${String(simplize.reason)}`);
    if (vietnamBiz.status === "rejected") errors.push(`VietnamBiz: ${String(vietnamBiz.reason)}`);
    if (!primary.length && !secondary.length) {
      markStale("commodities", null, errors.join("; ") || "Both HTML providers returned no data");
      throw new Error("All commodity providers unavailable");
    }
    const merged = new Map<string, CommodityPriceData>();
    for (const row of primary) merged.set(row.symbol, row);
    for (const row of secondary) if (!merged.has(row.symbol)) merged.set(row.symbol, row);
    return [...merged.values()];
  });

  let exchangeRates: ExchangeRateData[] = [];
  try {
    const fx = await cachedWithStaleFallback("commodities:fx", 6 * 60 * 60_000, fetchExchangeRates);
    exchangeRates = fx.value;
  } catch (err) {
    errors.push(`FX: ${err instanceof Error ? err.message : String(err)}`);
    // No fabricated FX fallback. The service will use the latest DB rate;
    // foreign-price rows are skipped only if DB has never stored a real rate.
  }

  log.info("commodities_fetch_complete", {
    records: priceResult.value.length,
    fxRates: exchangeRates.length,
    stale: priceResult.stale,
    errors,
  });
  return { prices: priceResult.value, exchangeRates, errors, stale: priceResult.stale };
}

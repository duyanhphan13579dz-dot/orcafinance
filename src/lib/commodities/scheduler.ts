/**
 * Commodity updater. Polls Simplize + VietnamBiz continuously (default 5 minutes).
 * Both providers are scanned; individual source values are never averaged.
 */

import { forProvider } from "@/lib/logger";
import { refreshCommoditiesFromRealSources } from "./service";

const log = forProvider("commodities-scheduler");
const INTERVAL_MS = Math.max(60_000, Number(process.env.COMMODITIES_REFRESH_INTERVAL_MS ?? 5 * 60_000));

const globalForScheduler = globalThis as typeof globalThis & { __orcaCommoditiesScheduler?: boolean };

async function run() {
  try {
    const result = await refreshCommoditiesFromRealSources();
    log.info("scheduled_real_sources_refresh_complete", result);
  } catch (err) {
    log.error("scheduled_real_sources_refresh_failed", {
      error: err instanceof Error ? err.message : String(err),
      nextRetryInMs: INTERVAL_MS,
    });
  }
}

export function startCommoditiesScheduler() {
  if (globalForScheduler.__orcaCommoditiesScheduler) return;
  globalForScheduler.__orcaCommoditiesScheduler = true;
  log.info("scheduler_started", {
    intervalMs: INTERVAL_MS,
    sources: ["simplize.vn/hang-hoa", "data.vietnambiz.vn/goods"],
  });
  // Warm shortly after server boot; don't delay health readiness.
  setTimeout(() => void run(), 10_000);
  setInterval(() => void run(), INTERVAL_MS);
}

/**
 * Commodity updater. Polls Simplize + VietnamBiz every 15 minutes.
 * Provider calls are cached for 5 minutes and protected by retry/circuit breakers.
 */

import { forProvider } from "@/lib/logger";
import { refreshCommoditiesFromRealSources } from "./service";

const log = forProvider("commodities-scheduler");
const INTERVAL_MS = Number(process.env.COMMODITIES_REFRESH_INTERVAL_MS ?? 15 * 60_000);

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

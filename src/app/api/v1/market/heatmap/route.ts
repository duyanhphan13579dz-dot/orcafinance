import { NextRequest } from "next/server";
import { checkRateLimit, handleError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";
import { getMarketHeatmap } from "@/lib/heatmap/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const limited = checkRateLimit(req, 180);
  if (limited) return limited;
  try {
    const heatmap = await getMarketHeatmap();
    return ok(heatmap.items, {
      marketStatus: heatmap.marketStatus,
      timestamp: heatmap.timestamp,
      stats: heatmap.stats,
      sectors: heatmap.sectors,
      source: "data-engine+price_snapshots",
    });
  } catch (err) {
    return handleError(err, "market_heatmap");
  }
}

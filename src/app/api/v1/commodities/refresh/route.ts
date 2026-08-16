import { NextRequest } from "next/server";
import { checkRateLimit, handleError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";
import { refreshCommoditiesFromRealSources } from "@/lib/commodities/service";
import { forProvider } from "@/lib/logger";

export const dynamic = "force-dynamic";
const log = forProvider("commodities-refresh-api");

/** Manual refresh. Only authenticated users may trigger an upstream scrape. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const limited = checkRateLimit(req, 6);
  if (limited) return limited;
  try {
    const result = await refreshCommoditiesFromRealSources();
    log.info("manual_real_sources_refresh_complete", { userId: auth.user.userId, ...result });
    return ok({ success: result.pricesSaved > 0, ...result, timestamp: new Date().toISOString() }, {
      sources: ["https://simplize.vn/hang-hoa", "https://data.vietnambiz.vn/goods"],
    });
  } catch (err) {
    return handleError(err, "commodities_refresh");
  }
}

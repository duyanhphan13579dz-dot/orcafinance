import { NextRequest } from "next/server";
import { checkRateLimit, handleError, ok } from "@/lib/api";
import { listRecentReports } from "@/lib/reports/generator";
import { startReportScheduler } from "@/lib/reports/scheduler";
import { requireAuth } from "@/lib/auth/request";

export const dynamic = "force-dynamic";
startReportScheduler();

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const limited = checkRateLimit(req, 60);
  if (limited) return limited;
  try {
    const url = new URL(req.url);
    const limit = Math.min(30, Number(url.searchParams.get("limit") ?? "14"));
    const reports = await listRecentReports(limit);
    return ok({ reports }, { source: "db" });
  } catch (err) {
    return handleError(err, "list-reports");
  }
}

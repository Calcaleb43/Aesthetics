import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { getSettings } from "@/lib/content/queries";
import {
  buildStudioReport,
  reportFilename,
  resolveRevenueRange,
  studioReportToCsv,
  type ReportRangePreset,
} from "@/lib/reporting/studio-report";

function parsePreset(value: string | null): ReportRangePreset {
  if (
    value === "today" ||
    value === "7d" ||
    value === "30d" ||
    value === "mtd" ||
    value === "ytd" ||
    value === "custom"
  ) {
    return value;
  }
  return "30d";
}

export async function GET(req: Request) {
  const gate = await requireAdminApi({ permission: "cms" });
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const preset = parsePreset(url.searchParams.get("preset"));
  const format = url.searchParams.get("format");
  const settings = await getSettings();
  const { from, to } = resolveRevenueRange(
    preset,
    url.searchParams.get("from"),
    url.searchParams.get("to"),
  );

  const report = await buildStudioReport(gate.db, {
    from,
    to,
    timezone: settings.timezone,
  });

  if (format === "csv") {
    const csv = studioReportToCsv(report);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${reportFilename(report)}"`,
      },
    });
  }

  return NextResponse.json({ report });
}

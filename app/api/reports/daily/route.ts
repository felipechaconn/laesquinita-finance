import { NextResponse } from "next/server";

import { AuthRequiredError, requireAuth } from "@/lib/auth";
import { dateKey } from "@/lib/date-ranges";
import { REPORT_TYPES, type ReportType } from "@/lib/finance-types";
import { getDailyReport } from "@/lib/reports";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? dateKey(new Date());
    const type = searchParams.get("type") as ReportType | null;
    const safeType = type && REPORT_TYPES.includes(type) ? type : "all";

    return NextResponse.json(await getDailyReport(date, safeType));
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "No se pudo cargar el reporte.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

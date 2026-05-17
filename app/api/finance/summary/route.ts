import { NextResponse } from "next/server";

import { AuthRequiredError, requireAuth } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/finance-analytics";
import { RANGE_KEYS, type RangeKey } from "@/lib/finance-types";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") as RangeKey | null;
    const safeRange = range && RANGE_KEYS.includes(range) ? range : "today";
    const summary = await getDashboardSummary({
      range: safeRange,
      start: searchParams.get("start"),
      end: searchParams.get("end")
    });

    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "No se pudo cargar el resumen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

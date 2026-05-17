import { NextResponse } from "next/server";

import { AuthRequiredError, requireAuth } from "@/lib/auth";
import { getCollections } from "@/lib/collections";

export async function GET() {
  try {
    await requireAuth();
    const { orders } = await getCollections();
    const latest = await orders.find({}).sort({ orderNumber: -1 }).limit(1).next();
    return NextResponse.json({ nextOrderNumber: (latest?.orderNumber ?? 0) + 1 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "No se pudo calcular el consecutivo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

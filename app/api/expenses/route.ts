import { NextResponse } from "next/server";

import { AuthRequiredError, requireAuth } from "@/lib/auth";
import { getCollections } from "@/lib/collections";
import { upsertProvider } from "@/lib/providers";
import { expenseSchema, cleanOptional } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 50);
    const { expenses } = await getCollections();
    const data = await expenses
      .find({ deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 200))
      .toArray();

    return NextResponse.json(data.map((expense) => ({ ...expense, _id: expense._id?.toString() })));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const payload = expenseSchema.parse(await request.json());
    const { expenses, providers } = await getCollections();
    const now = new Date();
    const createdAt = payload.createdAt ?? now;
    const vendorName = cleanOptional(payload.vendorName);
    await upsertProvider(providers, vendorName);
    const result = await expenses.insertOne({
      amount: payload.amount,
      category: payload.category,
      productId: cleanOptional(payload.productId),
      productName: cleanOptional(payload.productName),
      paymentMethod: payload.paymentMethod,
      receiptNumber: cleanOptional(payload.receiptNumber),
      vendorName,
      note: cleanOptional(payload.note),
      createdAt,
      updatedAt: now
    });
    const expense = await expenses.findOne({ _id: result.insertedId });

    return NextResponse.json({ ...expense, _id: expense?._id?.toString() }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const message = error instanceof Error ? error.message : "No se pudo procesar el gasto.";
  return NextResponse.json({ error: message }, { status: 400 });
}

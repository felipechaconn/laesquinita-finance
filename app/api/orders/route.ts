import { NextResponse } from "next/server";

import { AuthRequiredError, requireAuth } from "@/lib/auth";
import { getCollections, nextOrderNumber } from "@/lib/collections";
import { orderSchema, cleanOptional } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 50);
    const { orders } = await getCollections();
    const data = await orders
      .find({ deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 200))
      .toArray();

    return NextResponse.json(data.map((order) => ({ ...order, _id: order._id?.toString() })));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const payload = orderSchema.parse(await request.json());
    const { orders, counters } = await getCollections();
    const now = new Date();
    const createdAt = payload.createdAt ?? now;
    const orderNumber = await nextOrderNumber(counters);
    const items = payload.items.map((item) => ({
      ...item,
      subtotal: item.quantity * item.unitPrice
    }));
    const totalAmount = items.reduce((total, item) => total + item.subtotal, 0);

    const result = await orders.insertOne({
      orderNumber,
      paymentMethod: payload.paymentMethod,
      items,
      totalAmount,
      note: cleanOptional(payload.note),
      createdAt,
      updatedAt: now
    });
    const order = await orders.findOne({ _id: result.insertedId });

    return NextResponse.json({ ...order, _id: order?._id?.toString() }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const message = error instanceof Error ? error.message : "No se pudo procesar la orden.";
  return NextResponse.json({ error: message }, { status: 400 });
}

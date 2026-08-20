import { NextResponse } from "next/server";

import { AuthForbiddenError, AuthRequiredError, isContractor, requireAuth } from "@/lib/auth";
import { getCollections, nextOrderNumber } from "@/lib/collections";
import { endOfDay, startOfDay } from "@/lib/date-ranges";
import { normalizeOrderItems } from "@/lib/order-items";
import { orderSchema, cleanOptional } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 50);
    const date = searchParams.get("date");
    const rangeFilter =
      isContractor(user) || date === "today"
        ? { createdAt: { $gte: startOfDay(), $lte: endOfDay() } }
        : /^\d{4}-\d{2}-\d{2}$/.test(date ?? "")
          ? { createdAt: { $gte: startOfDay(date ?? ""), $lte: endOfDay(date ?? "") } }
          : {};
    const ownerFilter = isContractor(user) ? { createdBy: user.id } : {};
    const { orders } = await getCollections();
    const data = await orders
      .find({ deletedAt: { $exists: false }, ...rangeFilter, ...ownerFilter })
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
    const user = await requireAuth();
    const payload = orderSchema.parse(await request.json());
    const { orders, counters, products } = await getCollections();
    const now = new Date();
    const createdAt = payload.createdAt ?? now;

    if (isContractor(user) && !isToday(createdAt)) {
      throw new AuthForbiddenError("Los contratistas solo pueden registrar ventas del dia de hoy.");
    }

    const orderNumber = await nextOrderNumber(counters);
    const items = await normalizeOrderItems(payload.items, products, user);
    const totalAmount = items.reduce((total, item) => total + item.subtotal, 0);

    const result = await orders.insertOne({
      orderNumber,
      paymentMethod: payload.paymentMethod,
      items,
      totalAmount,
      note: cleanOptional(payload.note),
      createdAt,
      createdBy: user.id,
      createdByName: user.name,
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

  if (error instanceof AuthForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  const message = error instanceof Error ? error.message : "No se pudo procesar la orden.";
  return NextResponse.json({ error: message }, { status: 400 });
}

function isToday(date: Date | string) {
  const value = new Date(date);
  return value >= startOfDay() && value <= endOfDay();
}

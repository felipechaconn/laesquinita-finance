import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { AuthForbiddenError, AuthRequiredError, isContractor, requireAuth } from "@/lib/auth";
import { getCollections } from "@/lib/collections";
import { endOfDay, startOfDay } from "@/lib/date-ranges";
import { normalizeOrderItems } from "@/lib/order-items";
import { orderSchema, cleanOptional } from "@/lib/validators";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Id invalido." }, { status: 400 });
    }

    const { orders } = await getCollections();
    const order = await orders.findOne({ _id: new ObjectId(id), deletedAt: { $exists: false } });

    if (!order) {
      return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
    }

    if (isContractor(user) && (!isToday(order.createdAt) || order.createdBy !== user.id)) {
      throw new AuthForbiddenError("Los contratistas solo pueden ver ventas del dia de hoy.");
    }

    return NextResponse.json({ ...order, _id: order._id?.toString() });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (error instanceof AuthForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "No se pudo cargar la orden.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const payload = orderSchema.parse(await request.json());

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Id invalido." }, { status: 400 });
    }

    const { orders, products } = await getCollections();
    const now = new Date();
    const existing = await orders.findOne({ _id: new ObjectId(id), deletedAt: { $exists: false } });

    if (!existing) {
      return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
    }

    if (
      isContractor(user) &&
      (!isToday(existing.createdAt) || existing.createdBy !== user.id || (payload.createdAt && !isToday(payload.createdAt)))
    ) {
      throw new AuthForbiddenError("Los contratistas solo pueden modificar ventas del dia de hoy.");
    }

    const items = await normalizeOrderItems(payload.items, products, user);
    const totalAmount = items.reduce((total, item) => total + item.subtotal, 0);

    await orders.updateOne(
      { _id: new ObjectId(id), deletedAt: { $exists: false } },
      {
        $set: {
          paymentMethod: payload.paymentMethod,
          items,
          totalAmount,
          ...(payload.createdAt ? { createdAt: payload.createdAt } : {}),
          note: cleanOptional(payload.note),
          updatedAt: now,
          updatedBy: user.id
        }
      }
    );

    const order = await orders.findOne({ _id: new ObjectId(id), deletedAt: { $exists: false } });
    return NextResponse.json({ ...order, _id: order?._id?.toString() });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (error instanceof AuthForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "No se pudo actualizar la orden.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { orders } = await getCollections();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Id invalido." }, { status: 400 });
    }

    const existing = await orders.findOne({ _id: new ObjectId(id), deletedAt: { $exists: false } });

    if (!existing) {
      return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
    }

    if (isContractor(user) && (!isToday(existing.createdAt) || existing.createdBy !== user.id)) {
      throw new AuthForbiddenError("Los contratistas solo pueden anular ventas del dia de hoy.");
    }

    await orders.updateOne(
      { _id: new ObjectId(id), deletedAt: { $exists: false } },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: user.id,
          voidReason: "Orden anulada desde movimientos recientes"
        }
      }
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (error instanceof AuthForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "No se pudo eliminar la orden.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function isToday(date: Date | string) {
  const value = new Date(date);
  return value >= startOfDay() && value <= endOfDay();
}

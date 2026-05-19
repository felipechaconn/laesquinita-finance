import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { AuthRequiredError, requireAuth } from "@/lib/auth";
import { getCollections } from "@/lib/collections";
import { upsertProvider } from "@/lib/providers";
import { expenseSchema, cleanOptional } from "@/lib/validators";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Id invalido." }, { status: 400 });
    }

    const { expenses } = await getCollections();
    const expense = await expenses.findOne({ _id: new ObjectId(id), deletedAt: { $exists: false } });

    if (!expense) {
      return NextResponse.json({ error: "Gasto no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ...expense, _id: expense._id?.toString() });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "No se pudo cargar el gasto.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const payload = expenseSchema.parse(await request.json());

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Id invalido." }, { status: 400 });
    }

    const { expenses, providers } = await getCollections();
    const now = new Date();
    const vendorName = cleanOptional(payload.vendorName);
    await upsertProvider(providers, vendorName);

    await expenses.updateOne(
      { _id: new ObjectId(id), deletedAt: { $exists: false } },
      {
        $set: {
          amount: payload.amount,
          category: payload.category,
          productId: cleanOptional(payload.productId),
          productName: cleanOptional(payload.productName),
          paymentMethod: payload.paymentMethod,
          receiptNumber: cleanOptional(payload.receiptNumber),
          vendorName,
          note: cleanOptional(payload.note),
          ...(payload.createdAt ? { createdAt: payload.createdAt } : {}),
          updatedAt: now,
          updatedBy: user.id
        }
      }
    );

    const expense = await expenses.findOne({ _id: new ObjectId(id), deletedAt: { $exists: false } });
    return NextResponse.json({ ...expense, _id: expense?._id?.toString() });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "No se pudo actualizar el gasto.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { expenses } = await getCollections();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Id invalido." }, { status: 400 });
    }

    await expenses.updateOne(
      { _id: new ObjectId(id), deletedAt: { $exists: false } },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: user.id,
          voidReason: "Gasto anulado desde movimientos recientes"
        }
      }
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "No se pudo eliminar el gasto.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

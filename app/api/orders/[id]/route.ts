import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { AuthRequiredError, requireAuth } from "@/lib/auth";
import { getCollections } from "@/lib/collections";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { orders } = await getCollections();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Id invalido." }, { status: 400 });
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

    const message = error instanceof Error ? error.message : "No se pudo eliminar la orden.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

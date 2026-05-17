import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { AuthRequiredError, requireAuth } from "@/lib/auth";
import { getCollections } from "@/lib/collections";
import { productSchema } from "@/lib/validators";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const payload = productSchema.parse(await request.json());

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Id invalido." }, { status: 400 });
    }

    const { products } = await getCollections();
    await products.updateOne(
      { _id: new ObjectId(id), deletedAt: { $exists: false } },
      {
        $set: {
          ...payload,
          category: payload.category as never,
          updatedAt: new Date()
        }
      }
    );
    const product = await products.findOne({ _id: new ObjectId(id), deletedAt: { $exists: false } });

    return NextResponse.json({ ...product, _id: product?._id?.toString() });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "No se pudo actualizar el producto.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Id invalido." }, { status: 400 });
    }

    const { products } = await getCollections();
    await products.updateOne(
      { _id: new ObjectId(id), deletedAt: { $exists: false } },
      {
        $set: {
          active: false,
          deletedAt: new Date(),
          deletedBy: user.id,
          voidReason: "Producto archivado desde catalogo"
        }
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "No se pudo eliminar el producto.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

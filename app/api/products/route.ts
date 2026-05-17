import { NextResponse } from "next/server";

import { AuthRequiredError, requireAuth } from "@/lib/auth";
import { getCollections } from "@/lib/collections";
import { seedProductsIfNeeded } from "@/lib/seed-products";
import { productSchema } from "@/lib/validators";

export async function GET() {
  try {
    await requireAuth();
    await seedProductsIfNeeded();
    const { products } = await getCollections();
    const data = await products
      .find({ deletedAt: { $exists: false } })
      .sort({ kind: 1, active: -1, category: 1, name: 1 })
      .toArray();

    return NextResponse.json(
      data.map((product) => ({ ...product, kind: product.kind ?? "sell", _id: product._id?.toString() }))
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const payload = productSchema.parse(await request.json());
    const { products } = await getCollections();
    const now = new Date();
    const result = await products.insertOne({
      ...payload,
      category: payload.category as never,
      createdAt: now,
      updatedAt: now
    });
    const product = await products.findOne({ _id: result.insertedId });

    return NextResponse.json({ ...product, _id: product?._id?.toString() }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const message = error instanceof Error ? error.message : "No se pudo procesar la solicitud.";
  return NextResponse.json({ error: message }, { status: 400 });
}

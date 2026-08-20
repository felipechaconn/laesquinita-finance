import { NextResponse } from "next/server";

import { AuthForbiddenError, AuthRequiredError, requireAdminRole, requireAuth } from "@/lib/auth";
import { getCollections } from "@/lib/collections";
import type { Product } from "@/lib/finance-types";
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
    const user = await requireAuth();
    requireAdminRole(user);
    const payload = productSchema.parse(await request.json());
    const { products } = await getCollections();
    const now = new Date();
    const result = await products.insertOne({
      ...payload,
      category: payload.category as Product["category"],
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

  if (error instanceof AuthForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  const message = error instanceof Error ? error.message : "No se pudo procesar la solicitud.";
  return NextResponse.json({ error: message }, { status: 400 });
}

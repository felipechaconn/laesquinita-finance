import { NextResponse } from "next/server";

import { AuthRequiredError, requireAuth } from "@/lib/auth";
import { getCollections } from "@/lib/collections";
import { normalizeProviderName, upsertProvider } from "@/lib/providers";
import { providerSchema } from "@/lib/validators";

export async function GET() {
  try {
    await requireAuth();
    const { providers } = await getCollections();
    const data = await providers
      .find({ deletedAt: { $exists: false } })
      .sort({ active: -1, normalizedName: 1, name: 1 })
      .toArray();

    return NextResponse.json(data.map((provider) => ({ ...provider, _id: provider._id?.toString() })));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const payload = providerSchema.parse(await request.json());
    const { providers } = await getCollections();
    const provider = payload.active
      ? await upsertProvider(providers, payload.name)
      : await providers.findOneAndUpdate(
          { normalizedName: normalizeProviderName(payload.name) },
          { $set: { name: payload.name.trim(), active: false, updatedAt: new Date() } },
          { upsert: true, returnDocument: "after" }
        );

    return NextResponse.json({ ...provider, _id: provider?._id?.toString() }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const message = error instanceof Error ? error.message : "No se pudo procesar el proveedor.";
  return NextResponse.json({ error: message }, { status: 400 });
}

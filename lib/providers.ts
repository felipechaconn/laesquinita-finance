import type { Collection } from "mongodb";

import type { Provider } from "@/lib/finance-types";

export function normalizeProviderName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function upsertProvider(providers: Collection<Provider>, name?: string) {
  const trimmed = name?.trim().replace(/\s+/g, " ");

  if (!trimmed) {
    return null;
  }

  const now = new Date();
  const normalizedName = normalizeProviderName(trimmed);

  await providers.updateOne(
    { normalizedName },
    {
      $set: {
        name: trimmed,
        normalizedName,
        active: true,
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    { upsert: true }
  );

  return providers.findOne({ normalizedName });
}

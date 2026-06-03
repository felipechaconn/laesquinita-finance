import { readFileSync } from "node:fs";
import { MongoClient, ServerApiVersion } from "mongodb";

loadEnvFile(".env.local");

const dryRun = !process.argv.includes("--write");
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "la_esquinita";

const SIZE_PATTERN = /\b(\d{1,2})\s*o?z\b/i;
const SELL_CATEGORIES = ["Ceviche", "Caldosa"];

if (!uri) {
  throw new Error("Missing MONGODB_URI. Add it to .env.local before running this script.");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true
  }
});

try {
  await client.connect();
  const products = client.db(dbName).collection("products");
  const cursor = products.find({
    kind: "sell",
    category: { $in: SELL_CATEGORIES },
    deletedAt: { $exists: false }
  });

  const updates = [];

  for await (const product of cursor) {
    const parsed = parseProductOptions(product);

    if (!parsed) {
      console.log(`SKIP ${product._id}: cannot parse "${product.name}"`);
      continue;
    }

    const nextName = `${product.category} ${parsed.subcategory} ${parsed.size}`;
    const update = {
      subcategory: parsed.subcategory,
      size: parsed.size,
      name: nextName,
      updatedAt: new Date()
    };

    updates.push({ product, update });
  }

  console.log(`${dryRun ? "Dry run" : "Writing"} ${updates.length} product updates`);

  for (const { product, update } of updates) {
    console.log(`${product.name} -> ${update.name} | subcategory=${update.subcategory} | size=${update.size}`);

    if (!dryRun) {
      await products.updateOne({ _id: product._id }, { $set: update });
    }
  }
} finally {
  await client.close();
}

function parseProductOptions(product) {
  const name = String(product.name ?? "").trim();
  const sizeMatch = name.match(SIZE_PATTERN);

  if (!sizeMatch) {
    return null;
  }

  const size = `${sizeMatch[1]}oz`;
  const withoutCategory = name.replace(new RegExp(`^${escapeRegExp(product.category)}\\s*`, "i"), "");
  const withoutSize = withoutCategory.replace(SIZE_PATTERN, "").replace(/\s+/g, " ").trim();
  const subcategory = titleCase(withoutSize || "Normal");

  return { subcategory, size };
}

function titleCase(value) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadEnvFile(path) {
  try {
    const contents = readFileSync(path, "utf8");

    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Environment variables may already be provided by the shell.
  }
}

import type { ExpenseCategory, IncomeCategory, Product } from "@/lib/finance-types";
import { getCollections } from "@/lib/collections";

type SeedProduct =
  | {
      name: string;
      kind: "sell";
      category: IncomeCategory;
      defaultPrice: number;
      active: boolean;
    }
  | {
      name: string;
      kind: "buy";
      category: ExpenseCategory;
      defaultPrice: number;
      active: boolean;
    };

const DEFAULT_PRODUCTS = [
  { name: "Ceviche pequeno", kind: "sell", category: "Ceviche", defaultPrice: 2500, active: true },
  { name: "Ceviche grande", kind: "sell", category: "Ceviche", defaultPrice: 4500, active: true },
  { name: "Caldosa tradicional", kind: "sell", category: "Caldosa", defaultPrice: 1800, active: true },
  { name: "Caldosa especial", kind: "sell", category: "Caldosa", defaultPrice: 2500, active: true },
  { name: "Refresco natural", kind: "sell", category: "Refrescos", defaultPrice: 1200, active: true },
  { name: "Gaseosa", kind: "sell", category: "Refrescos", defaultPrice: 1000, active: true },
  { name: "Pescado fresco", kind: "buy", category: "Pescado", defaultPrice: 0, active: true },
  { name: "Camaron", kind: "buy", category: "Mariscos", defaultPrice: 0, active: true },
  { name: "Empaque ceviche", kind: "buy", category: "Empaques", defaultPrice: 0, active: true },
  { name: "Hielo", kind: "buy", category: "Hielo", defaultPrice: 0, active: true },
  { name: "Fruta extra", kind: "buy", category: "Frutas / Extras", defaultPrice: 0, active: true },
  { name: "Bolsa express", kind: "buy", category: "Express", defaultPrice: 0, active: true },
  { name: "Utencilio cocina", kind: "buy", category: "Utencilios", defaultPrice: 0, active: true }
] satisfies SeedProduct[];

export async function seedProductsIfNeeded() {
  const { products } = await getCollections();
  await products.updateMany({ kind: { $exists: false } }, { $set: { kind: "sell" } });
  const count = await products.estimatedDocumentCount();

  if (count > 0) {
    return;
  }

  const now = new Date();
  await products.insertMany(
    DEFAULT_PRODUCTS.map((product): Omit<Product, "_id"> => ({ ...product, createdAt: now, updatedAt: now }))
  );
}

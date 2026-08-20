import { ObjectId, type Collection } from "mongodb";

import { AuthForbiddenError, isContractor, type PublicUser } from "@/lib/auth";
import { INCOME_CATEGORIES, type IncomeCategory, type OrderItem, type Product } from "@/lib/finance-types";
import { cleanOptional } from "@/lib/validators";

type DraftOrderItem = Omit<OrderItem, "subtotal"> & { subtotal?: number };

const EXTRA_UNIT_PRICE = 150;
const ORDER_EXTRAS = new Map([
  ["pina", "Pina"],
  ["mango", "Mango"],
  ["chilepanameno", "Chile panameno"]
]);

export async function normalizeOrderItems(
  draftItems: DraftOrderItem[],
  products: Collection<Product>,
  user: PublicUser
) {
  const productIds = Array.from(
    new Set(
      draftItems
        .map((item) => item.productId)
        .filter((id) => !isExtraProductId(id) && ObjectId.isValid(id))
    )
  );
  const productRows = productIds.length
    ? await products
        .find({
          _id: { $in: productIds.map((id) => new ObjectId(id)) },
          active: true,
          deletedAt: { $exists: false },
          $or: [{ kind: "sell" }, { kind: { $exists: false } }]
        })
        .toArray()
    : [];
  const productById = new Map(productRows.map((product) => [String(product._id), product]));

  return draftItems.map((item) => {
    if (isExtraProductId(item.productId)) {
      return normalizeExtraItem(item);
    }

    const product = productById.get(item.productId);

    if (!product) {
      throw new Error(`Producto no disponible: ${item.productName}`);
    }

    const defaultPrice = Number(product.defaultPrice);
    const requestedPrice = Number(item.unitPrice);
    const reason = cleanOptional(item.priceChangeReason);
    const hasPriceOverride = requestedPrice !== defaultPrice;

    if (hasPriceOverride && isContractor(user)) {
      throw new AuthForbiddenError("Los contratistas no pueden cambiar precios de productos.");
    }

    if (hasPriceOverride && !reason) {
      throw new Error("Detalle del cambio del precio es obligatorio.");
    }

    const unitPrice = hasPriceOverride ? requestedPrice : defaultPrice;

    return {
      productId: String(product._id),
      productName: product.name,
      category: asIncomeCategory(product.category),
      quantity: item.quantity,
      unitPrice,
      ...(hasPriceOverride ? { originalUnitPrice: defaultPrice, priceChangeReason: reason } : {}),
      subtotal: item.quantity * unitPrice
    };
  });
}

function normalizeExtraItem(item: DraftOrderItem): OrderItem {
  const extraKey = normalizeExtraKey(item.productId.replace(/^extra:/, ""));
  const extraName = ORDER_EXTRAS.get(extraKey);

  if (!extraName) {
    throw new Error(`Extra no disponible: ${item.productName}`);
  }

  return {
    productId: `extra:${extraKey}`,
    productName: `Extra ${extraName}`,
    category: "Otros",
    quantity: item.quantity,
    unitPrice: EXTRA_UNIT_PRICE,
    originalUnitPrice: EXTRA_UNIT_PRICE,
    subtotal: item.quantity * EXTRA_UNIT_PRICE
  };
}

function isExtraProductId(productId: string) {
  return productId.startsWith("extra:");
}

function asIncomeCategory(category: Product["category"]): IncomeCategory {
  return INCOME_CATEGORIES.includes(category as IncomeCategory) ? (category as IncomeCategory) : "Otros";
}

function normalizeExtraKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

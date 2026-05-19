import { z } from "zod";

import {
  isExpenseCategory,
  isIncomeCategory,
  normalizeExpenseCategory,
  normalizeProductCategory
} from "@/lib/category-normalization";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, PRODUCT_KINDS } from "@/lib/finance-types";

const transactionDateSchema = z.coerce
  .date()
  .refine((date) => date.getTime() <= Date.now() + 60_000, "La fecha no puede ser futura.");

export const productSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    kind: z.enum(PRODUCT_KINDS).default("sell"),
    category: z.string().trim().min(1).max(80),
    defaultPrice: z.coerce.number().min(0).max(10_000_000),
    active: z.boolean().default(true)
  })
  .superRefine((product, context) => {
    const normalizedCategory = normalizeProductCategory(product.kind, product.category);
    const validCategory =
      product.kind === "sell"
        ? isIncomeCategory(String(normalizedCategory))
        : isExpenseCategory(String(normalizedCategory));

    if (!validCategory) {
      context.addIssue({
        code: "custom",
        path: ["category"],
        message: "Categoria invalida para este tipo de producto."
      });
    }

    if (product.kind === "sell" && product.defaultPrice <= 0) {
      context.addIssue({
        code: "custom",
        path: ["defaultPrice"],
        message: "El precio de venta debe ser mayor a cero."
      });
    }
  })
  .transform((product) => ({
    ...product,
    category: normalizeProductCategory(product.kind, product.category)
  }));

export const providerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  active: z.boolean().default(true)
});

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().trim().min(1).max(80),
  category: z.enum(INCOME_CATEGORIES),
  quantity: z.coerce.number().int().positive().max(999),
  unitPrice: z.coerce.number().positive().max(10_000_000),
  originalUnitPrice: z.coerce.number().positive().max(10_000_000).optional(),
  priceChangeReason: z.string().trim().max(180).optional().or(z.literal(""))
}).superRefine((item, context) => {
  if (item.originalUnitPrice && item.unitPrice !== item.originalUnitPrice && !item.priceChangeReason?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["priceChangeReason"],
      message: "Detalle del cambio del precio es obligatorio."
    });
  }
});

export const orderSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
  items: z.array(orderItemSchema).min(1),
  createdAt: transactionDateSchema.optional(),
  note: z.string().trim().max(240).optional().or(z.literal(""))
});

export const expenseSchema = z.object({
  amount: z.coerce.number().positive().max(100_000_000),
  category: z.preprocess((value) => normalizeExpenseCategory(value), z.enum(EXPENSE_CATEGORIES)),
  productId: z.string().trim().max(80).optional().or(z.literal("")),
  productName: z.string().trim().max(80).optional().or(z.literal("")),
  paymentMethod: z.enum(PAYMENT_METHODS),
  receiptNumber: z.string().trim().max(80).optional().or(z.literal("")),
  vendorName: z.string().trim().max(120).optional().or(z.literal("")),
  createdAt: transactionDateSchema.optional(),
  note: z.string().trim().max(240).optional().or(z.literal(""))
});

export const dailyNoteSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(500)
});

export function cleanOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

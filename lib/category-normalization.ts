import type { ExpenseCategory, IncomeCategory, ProductKind } from "@/lib/finance-types";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/finance-types";

const legacyIncomeCategoryMap: Record<string, IncomeCategory> = {
  Drinks: "Refrescos",
  Other: "Otros"
};

const legacyExpenseCategoryMap: Record<string, ExpenseCategory> = {
  Fish: "Pescado",
  Shrimp: "Mariscos",
  Packaging: "Empaques",
  Ice: "Hielo",
  Gas: "Otros",
  Delivery: "Express",
  Utilities: "Patente / Caja",
  Salaries: "Salarios",
  Rent: "Renta",
  Other: "Otros"
};

export function normalizeIncomeCategory(category: unknown): IncomeCategory | string {
  const value = String(category);

  if (isIncomeCategory(value)) {
    return value;
  }

  return legacyIncomeCategoryMap[value] ?? value;
}

export function normalizeExpenseCategory(category: unknown): ExpenseCategory | string {
  const value = String(category);

  if (isExpenseCategory(value)) {
    return value;
  }

  return legacyExpenseCategoryMap[value] ?? value;
}

export function normalizeProductCategory(kind: ProductKind, category: unknown) {
  return kind === "sell" ? normalizeIncomeCategory(category) : normalizeExpenseCategory(category);
}

export function isIncomeCategory(category: string): category is IncomeCategory {
  return INCOME_CATEGORIES.includes(category as IncomeCategory);
}

export function isExpenseCategory(category: string): category is ExpenseCategory {
  return EXPENSE_CATEGORIES.includes(category as ExpenseCategory);
}

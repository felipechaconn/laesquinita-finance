import type { ObjectId } from "mongodb";

export const INCOME_CATEGORIES = ["Ceviche", "Caldosa", "Refrescos", "Otros"] as const;
export const EXPENSE_CATEGORIES = [
  "Pescado",
  "Mariscos",
  "Vegetables",
  "Empaques",
  "Hielo",
  "Frutas / Extras",
  "Express",
  "Utencilios",
  "Salarios",
  "Patente / Caja",
  "Renta",
  "Marketing",
  "Otros"
] as const;
export const PAYMENT_METHODS = ["SINPE", "Efectivo", "Transferencia", "Tarjeta"] as const;
export const RANGE_KEYS = ["today", "week", "month", "custom"] as const;
export const PRODUCT_KINDS = ["sell", "buy"] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type RangeKey = (typeof RANGE_KEYS)[number];
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export type Product = {
  _id?: ObjectId | string;
  name: string;
  kind?: ProductKind;
  category: IncomeCategory | ExpenseCategory;
  defaultPrice: number;
  active: boolean;
  createdAt: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string;
  deletedBy?: string;
  voidReason?: string;
};

export type OrderItem = {
  productId: string;
  productName: string;
  category: IncomeCategory;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  originalUnitPrice?: number;
  priceChangeReason?: string;
};

export type Order = {
  _id?: ObjectId | string;
  orderNumber: number;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
  totalAmount: number;
  note?: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string;
  deletedBy?: string;
  voidReason?: string;
};

export type Expense = {
  _id?: ObjectId | string;
  amount: number;
  category: ExpenseCategory;
  productId?: string;
  productName?: string;
  paymentMethod: PaymentMethod;
  receiptNumber?: string;
  vendorName?: string;
  note?: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string;
  deletedBy?: string;
  voidReason?: string;
};

export type DailyNote = {
  _id?: ObjectId | string;
  dateKey: string;
  note: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type DashboardSummary = {
  range: {
    start: string;
    end: string;
  };
  topCards: {
    todayIncome: number;
    todayExpenses: number;
    todayProfit: number;
    monthProfit: number;
  };
  totals: {
    income: number;
    expenses: number;
    profit: number;
    margin: number;
    orders: number;
    averageTicket: number;
  };
  series: Array<{ date: string; income: number; expenses: number; profit: number }>;
  expenseCategories: Array<{ category: ExpenseCategory; amount: number }>;
  weeklyProfit: Array<{ week: string; profit: number }>;
  topProducts: Array<{ productName: string; category: IncomeCategory; quantity: number; revenue: number }>;
  paymentMethods: Array<{ paymentMethod: PaymentMethod; total: number; count: number }>;
  recentTransactions: Array<{
    id: string;
    type: "order" | "expense";
    title: string;
    subtitle: string;
    amount: number;
    createdAt: string;
    order?: {
      orderNumber: number;
      items: OrderItem[];
      paymentMethod: PaymentMethod;
      note?: string;
    };
  }>;
  insights: string[];
  dailyNote?: DailyNote | null;
};

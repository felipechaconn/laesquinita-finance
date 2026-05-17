import { getCollections } from "@/lib/collections";
import type {
  DashboardSummary,
  Expense,
  ExpenseCategory,
  IncomeCategory,
  Order,
  PaymentMethod,
  RangeKey
} from "@/lib/finance-types";
import { dateKey, endOfDay, getRange, startOfDay, startOfMonth, startOfWeek } from "@/lib/date-ranges";

type RangeInput = {
  range: RangeKey;
  start?: string | null;
  end?: string | null;
};

export async function getDashboardSummary(input: RangeInput): Promise<DashboardSummary> {
  const { orders, expenses, dailyNotes } = await getCollections();
  const visible = { deletedAt: { $exists: false } };
  const selected = getRange(input.range, input.start, input.end);
  const today = { start: startOfDay(), end: endOfDay() };
  const month = { start: startOfMonth(), end: endOfDay() };
  const week = { start: startOfWeek(), end: endOfDay() };

  const [
    selectedOrders,
    selectedExpenses,
    todayOrders,
    todayExpenses,
    monthOrders,
    monthExpenses,
    weekOrders,
    lastWeekOrders,
    weekExpenses,
    lastWeekExpenses,
    note
  ] = await Promise.all([
    orders.find({ ...visible, createdAt: { $gte: selected.start, $lte: selected.end } }).sort({ createdAt: -1 }).toArray(),
    expenses.find({ ...visible, createdAt: { $gte: selected.start, $lte: selected.end } }).sort({ createdAt: -1 }).toArray(),
    orders.find({ ...visible, createdAt: { $gte: today.start, $lte: today.end } }).toArray(),
    expenses.find({ ...visible, createdAt: { $gte: today.start, $lte: today.end } }).toArray(),
    orders.find({ ...visible, createdAt: { $gte: month.start, $lte: month.end } }).toArray(),
    expenses.find({ ...visible, createdAt: { $gte: month.start, $lte: month.end } }).toArray(),
    orders.find({ ...visible, createdAt: { $gte: week.start, $lte: week.end } }).toArray(),
    orders
      .find({
        ...visible,
        createdAt: {
          $gte: addDays(week.start, -7),
          $lt: week.start
        }
      })
      .toArray(),
    expenses.find({ ...visible, createdAt: { $gte: week.start, $lte: week.end } }).toArray(),
    expenses
      .find({
        ...visible,
        createdAt: {
          $gte: addDays(week.start, -7),
          $lt: week.start
        }
      })
      .toArray(),
    dailyNotes.findOne({ dateKey: dateKey(new Date()) })
  ]);

  const selectedIncome = sumOrders(selectedOrders);
  const selectedExpenseTotal = sumExpenses(selectedExpenses);
  const profit = selectedIncome - selectedExpenseTotal;
  const margin = selectedIncome > 0 ? (profit / selectedIncome) * 100 : 0;

  const todayIncome = sumOrders(todayOrders);
  const todayExpenseTotal = sumExpenses(todayExpenses);
  const monthProfit = sumOrders(monthOrders) - sumExpenses(monthExpenses);

  const series = buildSeries(selected.start, selected.end, selectedOrders, selectedExpenses);
  const expenseCategories = buildExpenseCategories(selectedExpenses);
  const weeklyProfit = buildWeeklyProfit(selectedOrders, selectedExpenses);
  const topProducts = buildTopProducts(selectedOrders);
  const paymentMethods = buildPaymentMethods(selectedOrders);
  const recentTransactions = buildRecentTransactions(selectedOrders, selectedExpenses);
  const insights = buildInsights({
    selectedOrders,
    selectedExpenses,
    topProducts,
    expenseCategories,
    weekProfit: sumOrders(weekOrders) - sumExpenses(weekExpenses),
    lastWeekProfit: sumOrders(lastWeekOrders) - sumExpenses(lastWeekExpenses)
  });

  return {
    range: {
      start: selected.start.toISOString(),
      end: selected.end.toISOString()
    },
    topCards: {
      todayIncome,
      todayExpenses: todayExpenseTotal,
      todayProfit: todayIncome - todayExpenseTotal,
      monthProfit
    },
    totals: {
      income: selectedIncome,
      expenses: selectedExpenseTotal,
      profit,
      margin,
      orders: selectedOrders.length,
      averageTicket: selectedOrders.length ? selectedIncome / selectedOrders.length : 0
    },
    series,
    expenseCategories,
    weeklyProfit,
    topProducts,
    paymentMethods,
    recentTransactions,
    insights,
    dailyNote: note
      ? {
          ...note,
          _id: note._id?.toString()
        }
      : null
  };
}

function sumOrders(orders: Order[]) {
  return orders.reduce((total, order) => total + order.totalAmount, 0);
}

function sumExpenses(expenses: Expense[]) {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

function buildSeries(start: Date, end: Date, orders: Order[], expenses: Expense[]) {
  const map = new Map<string, { date: string; income: number; expenses: number; profit: number }>();

  for (let cursor = startOfDay(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const key = dateKey(cursor);
    map.set(key, { date: key, income: 0, expenses: 0, profit: 0 });
  }

  orders.forEach((order) => {
    const key = dateKey(new Date(order.createdAt));
    const row = map.get(key) ?? { date: key, income: 0, expenses: 0, profit: 0 };
    row.income += order.totalAmount;
    row.profit = row.income - row.expenses;
    map.set(key, row);
  });

  expenses.forEach((expense) => {
    const key = dateKey(new Date(expense.createdAt));
    const row = map.get(key) ?? { date: key, income: 0, expenses: 0, profit: 0 };
    row.expenses += expense.amount;
    row.profit = row.income - row.expenses;
    map.set(key, row);
  });

  return Array.from(map.values());
}

function buildExpenseCategories(expenses: Expense[]) {
  const map = new Map<ExpenseCategory, number>();

  expenses.forEach((expense) => {
    map.set(expense.category, (map.get(expense.category) ?? 0) + expense.amount);
  });

  return Array.from(map, ([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

function buildWeeklyProfit(orders: Order[], expenses: Expense[]) {
  const map = new Map<string, { week: string; profit: number }>();

  orders.forEach((order) => {
    const week = weekLabel(new Date(order.createdAt));
    const row = map.get(week) ?? { week, profit: 0 };
    row.profit += order.totalAmount;
    map.set(week, row);
  });

  expenses.forEach((expense) => {
    const week = weekLabel(new Date(expense.createdAt));
    const row = map.get(week) ?? { week, profit: 0 };
    row.profit -= expense.amount;
    map.set(week, row);
  });

  return Array.from(map.values()).slice(-8);
}

function buildTopProducts(orders: Order[]) {
  const map = new Map<string, { productName: string; category: IncomeCategory; quantity: number; revenue: number }>();

  orders.flatMap((order) => order.items).forEach((item) => {
    const row = map.get(item.productId) ?? {
      productName: item.productName,
      category: item.category,
      quantity: 0,
      revenue: 0
    };
    row.quantity += item.quantity;
    row.revenue += item.subtotal;
    map.set(item.productId, row);
  });

  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}

function buildPaymentMethods(orders: Order[]) {
  const map = new Map<PaymentMethod, { paymentMethod: PaymentMethod; total: number; count: number }>();

  orders.forEach((order) => {
    const row = map.get(order.paymentMethod) ?? { paymentMethod: order.paymentMethod, total: 0, count: 0 };
    row.total += order.totalAmount;
    row.count += 1;
    map.set(order.paymentMethod, row);
  });

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function buildRecentTransactions(orders: Order[], expenses: Expense[]) {
  return [
    ...orders.map((order) => ({
      id: order._id?.toString() ?? String(order.orderNumber),
      type: "order" as const,
      title: `Orden #${order.orderNumber}`,
      subtitle: `${formatOrderQuantity(order)} · ${order.paymentMethod}`,
      amount: order.totalAmount,
      createdAt: new Date(order.createdAt).toISOString(),
      order: {
        orderNumber: order.orderNumber,
        items: order.items,
        paymentMethod: order.paymentMethod,
        note: order.note
      }
    })),
    ...expenses.map((expense) => ({
      id: expense._id?.toString() ?? `${expense.category}-${expense.createdAt}`,
      type: "expense" as const,
      title: expense.productName ?? expense.category,
      subtitle: `${expense.vendorName ?? "Gasto"} · ${expense.paymentMethod}`,
      amount: -expense.amount,
      createdAt: new Date(expense.createdAt).toISOString()
    }))
  ]
    .sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)))
    .slice(0, 12);
}

function formatOrderQuantity(order: Order) {
  const productCount = order.items.length;
  const units = order.items.reduce((total, item) => total + item.quantity, 0);
  const productLabel = productCount === 1 ? "1 producto" : `${productCount} productos`;
  const unitLabel = units === 1 ? "1 unidad" : `${units} unidades`;

  return `${productLabel}, ${unitLabel}`;
}

function buildInsights(input: {
  selectedOrders: Order[];
  selectedExpenses: Expense[];
  topProducts: ReturnType<typeof buildTopProducts>;
  expenseCategories: ReturnType<typeof buildExpenseCategories>;
  weekProfit: number;
  lastWeekProfit: number;
}) {
  const insights: string[] = [];
  const { selectedOrders, selectedExpenses, topProducts, expenseCategories, weekProfit, lastWeekProfit } = input;

  if (lastWeekProfit !== 0) {
    const change = ((weekProfit - lastWeekProfit) / Math.abs(lastWeekProfit)) * 100;
    insights.push(`Esta semana la utilidad ${change >= 0 ? "subio" : "bajo"} ${Math.abs(change).toFixed(0)}%.`);
  }

  const packaging = expenseCategories.find((item) => item.category === "Empaques");
  const expenseTotal = sumExpenses(selectedExpenses);
  if (packaging && expenseTotal > 0 && packaging.amount / expenseTotal > 0.22) {
    insights.push("Los costos de empaques estan mas altos de lo normal.");
  }

  const bestDay = strongestSalesDay(selectedOrders);
  if (bestDay) {
    insights.push(`${bestDay} es el dia mas fuerte de ventas.`);
  }

  if (topProducts.length >= 2) {
    insights.push(`${topProducts[0].productName} genera mas ingresos que ${topProducts[1].productName}.`);
  }

  if (!insights.length) {
    insights.push("Registra ventas y gastos para ver alertas simples de rentabilidad.");
  }

  return insights.slice(0, 4);
}

function strongestSalesDay(orders: Order[]) {
  if (!orders.length) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat("es-CR", { weekday: "long" });
  const map = new Map<string, number>();

  orders.forEach((order) => {
    const day = formatter.format(new Date(order.createdAt));
    map.set(day, (map.get(day) ?? 0) + order.totalAmount);
  });

  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function weekLabel(date: Date) {
  const start = startOfWeek(date);
  return `${start.getDate()}/${start.getMonth() + 1}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

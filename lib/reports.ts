import { getCollections } from "@/lib/collections";
import { dateKey, endOfDay, startOfDay } from "@/lib/date-ranges";
import type { DailyReport, DailyReportRow, Expense, Order, ReportType } from "@/lib/finance-types";

export async function getDailyReport(date: string, type: ReportType): Promise<DailyReport> {
  const { orders, expenses } = await getCollections();
  const day = parseReportDate(date);
  const range = { $gte: startOfDay(day), $lte: endOfDay(day) };
  const visible = { deletedAt: { $exists: false } };

  const [orderRows, expenseRows] = await Promise.all([
    type === "expenses"
      ? Promise.resolve([] as Order[])
      : orders.find({ ...visible, createdAt: range }).sort({ createdAt: -1 }).toArray(),
    type === "orders"
      ? Promise.resolve([] as Expense[])
      : expenses.find({ ...visible, createdAt: range }).sort({ createdAt: -1 }).toArray()
  ]);

  const income = orderRows.reduce((total, order) => total + order.totalAmount, 0);
  const expenseTotal = expenseRows.reduce((total, expense) => total + expense.amount, 0);
  const unitsSold = orderRows.reduce(
    (total, order) => total + order.items.reduce((itemTotal, item) => itemTotal + item.quantity, 0),
    0
  );
  const rows = [...orderRows.map(orderToRow), ...expenseRows.map(expenseToRow)].sort(
    (a, b) => Number(new Date(b.date)) - Number(new Date(a.date))
  );

  return {
    date: day,
    type,
    totals: {
      income,
      expenses: expenseTotal,
      profit: income - expenseTotal,
      orders: orderRows.length,
      expenseCount: expenseRows.length,
      unitsSold,
      averageTicket: orderRows.length ? income / orderRows.length : 0
    },
    rows
  };
}

function orderToRow(order: Order): DailyReportRow {
  const quantity = order.items.reduce((total, item) => total + item.quantity, 0);
  const details = order.items.map((item) => `${item.quantity}x ${item.productName}`).join(", ");

  return {
    id: String(order._id),
    type: "order",
    date: new Date(order.createdAt).toISOString(),
    title: `Orden #${order.orderNumber}`,
    category: "Venta",
    paymentMethod: order.paymentMethod,
    amount: order.totalAmount,
    quantity,
    details,
    note: order.note
  };
}

function expenseToRow(expense: Expense): DailyReportRow {
  return {
    id: String(expense._id),
    type: "expense",
    date: new Date(expense.createdAt).toISOString(),
    title: expense.productName ?? expense.category,
    category: expense.category,
    paymentMethod: expense.paymentMethod,
    amount: -expense.amount,
    details: expense.vendorName ?? "Gasto",
    reference: expense.receiptNumber,
    note: expense.note
  };
}

function parseReportDate(date: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  return dateKey(new Date());
}

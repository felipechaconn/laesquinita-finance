import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { AuthRequiredError, requireAuth } from "@/lib/auth";
import { getCollections } from "@/lib/collections";

export async function GET() {
  try {
    await requireAuth();
    const { orders, expenses, products } = await getCollections();
    const [orderRows, expenseRows, productRows] = await Promise.all([
      orders.find({ deletedAt: { $exists: false } }).sort({ createdAt: -1 }).toArray(),
      expenses.find({ deletedAt: { $exists: false } }).sort({ createdAt: -1 }).toArray(),
      products.find({ deletedAt: { $exists: false } }).sort({ category: 1, name: 1 }).toArray()
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "La Esquinita";
    workbook.created = new Date();

    const ordersSheet = workbook.addWorksheet("Ordenes");
    ordersSheet.columns = [
      { header: "Orden", key: "orderNumber", width: 12 },
      { header: "Fecha", key: "date", width: 22 },
      { header: "Metodo", key: "paymentMethod", width: 18 },
      { header: "Productos", key: "items", width: 50 },
      { header: "Total", key: "totalAmount", width: 14 },
      { header: "Nota", key: "note", width: 30 }
    ];
    orderRows.forEach((order) =>
      ordersSheet.addRow({
        orderNumber: order.orderNumber,
        date: new Date(order.createdAt).toLocaleString("es-CR"),
        paymentMethod: order.paymentMethod,
        items: order.items.map((item) => `${item.quantity}x ${item.productName}`).join(", "),
        totalAmount: order.totalAmount,
        note: order.note ?? ""
      })
    );

    const expensesSheet = workbook.addWorksheet("Gastos");
    expensesSheet.columns = [
      { header: "Fecha", key: "date", width: 22 },
      { header: "Producto", key: "productName", width: 24 },
      { header: "Categoria", key: "category", width: 18 },
      { header: "Metodo", key: "paymentMethod", width: 18 },
      { header: "Factura", key: "receiptNumber", width: 18 },
      { header: "Proveedor", key: "vendorName", width: 24 },
      { header: "Total", key: "amount", width: 14 },
      { header: "Nota", key: "note", width: 30 }
    ];
    expenseRows.forEach((expense) =>
      expensesSheet.addRow({
        date: new Date(expense.createdAt).toLocaleString("es-CR"),
        productName: expense.productName ?? "",
        category: expense.category,
        paymentMethod: expense.paymentMethod,
        receiptNumber: expense.receiptNumber ?? "",
        vendorName: expense.vendorName ?? "",
        amount: expense.amount,
        note: expense.note ?? ""
      })
    );

    const productsSheet = workbook.addWorksheet("Productos");
    productsSheet.columns = [
      { header: "Producto", key: "name", width: 28 },
      { header: "Categoria", key: "category", width: 18 },
      { header: "Precio", key: "defaultPrice", width: 14 },
      { header: "Activo", key: "active", width: 12 }
    ];
    productRows.forEach((product) =>
      productsSheet.addRow({
        name: product.name,
        category: product.category,
        defaultPrice: product.defaultPrice,
        active: product.active ? "Si" : "No"
      })
    );

    for (const sheet of workbook.worksheets) {
      sheet.getRow(1).font = { bold: true };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="la-esquinita-finanzas.xlsx"`
      }
    });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "No se pudo exportar Excel.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

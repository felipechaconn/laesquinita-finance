"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Minus, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PAYMENT_METHODS, type DashboardSummary, type Order, type OrderItem, type PaymentMethod } from "@/lib/finance-types";
import { formatCRC, formatDateTime } from "@/lib/utils";

type RecentTransactionsProps = {
  transactions: DashboardSummary["recentTransactions"];
  onDelete: (transaction: DashboardSummary["recentTransactions"][number]) => void;
  onUpdateOrder: (id: string, payload: { paymentMethod: string; items: OrderItem[]; note?: string }) => Promise<Order>;
};

export function RecentTransactions({ transactions, onDelete, onUpdateOrder }: RecentTransactionsProps) {
  const [selected, setSelected] = React.useState<DashboardSummary["recentTransactions"][number] | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Movimientos recientes</CardTitle>
        <CardDescription>Desliza mentalmente: aqui todo debe ser obvio en segundos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {transactions.length ? (
          transactions.map((transaction) => (
            <motion.div
              key={`${transaction.type}-${transaction.id}`}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="group flex touch-pan-y items-center gap-3 rounded-2xl border bg-background p-3"
            >
              <button
                type="button"
                className={transaction.amount >= 0 ? "rounded-2xl bg-emerald-500/12 p-3" : "rounded-2xl bg-red-500/12 p-3"}
                onClick={() => transaction.type === "order" && setSelected(transaction)}
                aria-label="Ver detalle"
              >
                {transaction.amount >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                ) : (
                  <ArrowDownLeft className="h-4 w-4 text-red-600" />
                )}
              </button>
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => transaction.type === "order" && setSelected(transaction)}
              >
                <p className="truncate text-sm font-semibold">{transaction.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {transaction.subtitle} · {formatDateTime(transaction.createdAt)}
                </p>
              </button>
              <div className="text-right">
                <p className={transaction.amount >= 0 ? "text-sm font-bold text-emerald-600" : "text-sm font-bold text-red-600"}>
                  {formatCRC(transaction.amount)}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-8 px-2 text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={() => onDelete(transaction)}
                  aria-label="Eliminar movimiento"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Los movimientos apareceran aqui despues de registrar una orden o gasto.
          </div>
        )}
      </CardContent>
      <OrderDetailSheet
        transaction={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onUpdateOrder={onUpdateOrder}
      />
    </Card>
  );
}

function OrderDetailSheet({
  transaction,
  onOpenChange,
  onUpdateOrder
}: {
  transaction: DashboardSummary["recentTransactions"][number] | null;
  onOpenChange: (open: boolean) => void;
  onUpdateOrder: (id: string, payload: { paymentMethod: string; items: OrderItem[]; note?: string }) => Promise<Order>;
}) {
  const order = transaction?.order;

  if (!transaction || !order) {
    return <Sheet open={false} onOpenChange={onOpenChange} />;
  }

  return (
    <Sheet open={Boolean(transaction)} onOpenChange={onOpenChange}>
      <SheetContent>
        <OrderDetailEditor
          key={transaction.id}
          transactionId={transaction.id}
          order={order}
          onOpenChange={onOpenChange}
          onUpdateOrder={onUpdateOrder}
        />
      </SheetContent>
    </Sheet>
  );
}

function OrderDetailEditor({
  transactionId,
  order,
  onOpenChange,
  onUpdateOrder
}: {
  transactionId: string;
  order: NonNullable<DashboardSummary["recentTransactions"][number]["order"]>;
  onOpenChange: (open: boolean) => void;
  onUpdateOrder: (id: string, payload: { paymentMethod: string; items: OrderItem[]; note?: string }) => Promise<Order>;
}) {
  const [items, setItems] = React.useState<OrderItem[]>(() => order.items.map((item) => ({ ...item })));
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(order.paymentMethod);
  const [note, setNote] = React.useState(order.note ?? "");
  const [saving, setSaving] = React.useState(false);

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  function updateQuantity(productId: string, delta: number) {
    setItems((current) =>
      current
        .map((item) => {
          if (item.productId !== productId) return item;
          const quantity = Math.max(0, item.quantity + delta);
          return { ...item, quantity, subtotal: quantity * item.unitPrice };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onUpdateOrder(transactionId, { paymentMethod, items, note });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Orden #{order.orderNumber}</SheetTitle>
        <SheetDescription>Detalle de productos, cantidades y metodo de pago.</SheetDescription>
      </SheetHeader>

      <div className="space-y-5">
        <div className="rounded-2xl bg-secondary p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-3xl font-bold text-emerald-600">{formatCRC(total)}</p>
        </div>

        <div className="space-y-2">
          <Label>Metodo de pago</Label>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((method) => (
              <Button
                key={method}
                type="button"
                variant={paymentMethod === method ? "default" : "secondary"}
                onClick={() => setPaymentMethod(method)}
              >
                {method}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Productos</Label>
          {items.map((item) => (
            <div key={item.productId} className="rounded-2xl border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">{formatCRC(item.unitPrice)} c/u</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" size="icon" onClick={() => updateQuantity(item.productId, -1)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-bold">{item.quantity}</span>
                  <Button type="button" variant="secondary" size="icon" onClick={() => updateQuantity(item.productId, 1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {item.priceChangeReason ? (
                <p className="mt-2 rounded-xl bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-300">
                  Cambio de precio: {item.priceChangeReason}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota opcional" />
        <Button type="button" size="lg" className="w-full" onClick={handleSave} disabled={saving || !items.length}>
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </>
  );
}

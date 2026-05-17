"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CalendarDays, Copy, Minus, Plus, PlusCircle, Search, ShoppingCart, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { normalizeExpenseCategory } from "@/lib/category-normalization";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  type Expense,
  type ExpenseCategory,
  type IncomeCategory,
  type Order,
  type OrderItem,
  type PaymentMethod,
  type Product
} from "@/lib/finance-types";
import { cn, formatCRC } from "@/lib/utils";

type DraftItem = OrderItem;

type QuickEntrySheetProps = {
  products: Product[];
  isMutating: boolean;
  lastEntry: Order | Expense | null;
  onCreateOrder: (payload: {
    paymentMethod: PaymentMethod;
    items: DraftItem[];
    note?: string;
    createdAt?: string;
  }) => Promise<Order>;
  onCreateExpense: (payload: Record<string, unknown>) => Promise<Expense>;
  onCreateProduct: (payload: Record<string, unknown>) => Promise<Product>;
};

export function QuickEntrySheet({
  products,
  isMutating,
  lastEntry,
  onCreateOrder,
  onCreateExpense,
  onCreateProduct
}: QuickEntrySheetProps) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"income" | "expense">("income");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="lg"
          className="fixed bottom-5 right-5 z-40 h-16 w-16 rounded-full p-0 shadow-2xl shadow-sky-600/30 sm:bottom-8 sm:right-8"
          aria-label="Agregar movimiento"
        >
          <Plus className="h-7 w-7" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Agregar movimiento</SheetTitle>
          <SheetDescription>Orden o gasto en pocos toques, pensado para usarlo en el local.</SheetDescription>
        </SheetHeader>

        <div className="mb-5 grid grid-cols-2 rounded-2xl bg-secondary p-1">
          <Button
            type="button"
            variant="ghost"
            className={cn("rounded-xl", mode === "income" && "bg-card shadow-sm hover:bg-card")}
            onClick={() => setMode("income")}
          >
            <ShoppingCart className="h-4 w-4" />
            Ingreso
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={cn("rounded-xl", mode === "expense" && "bg-card shadow-sm hover:bg-card")}
            onClick={() => setMode("expense")}
          >
            <Wallet className="h-4 w-4" />
            Gasto
          </Button>
        </div>

        {lastEntry ? (
          <Button
            type="button"
            variant="secondary"
            className="mb-5 w-full"
            disabled={isMutating}
            onClick={async () => {
              if ("items" in lastEntry) {
                await onCreateOrder({
                  paymentMethod: lastEntry.paymentMethod,
                  items: lastEntry.items,
                  note: lastEntry.note
                });
              } else {
                await onCreateExpense({
                  amount: lastEntry.amount,
                  category: lastEntry.category,
                  productId: lastEntry.productId,
                  productName: lastEntry.productName,
                  paymentMethod: lastEntry.paymentMethod,
                  receiptNumber: lastEntry.receiptNumber,
                  vendorName: lastEntry.vendorName,
                  note: lastEntry.note
                });
              }
              setOpen(false);
            }}
          >
            <Copy className="h-4 w-4" />
            Duplicar movimiento anterior
          </Button>
        ) : null}

        {mode === "income" ? (
          <OrderForm
            products={products}
            isMutating={isMutating}
            onCreateProduct={onCreateProduct}
            onSubmit={async (payload) => {
              await onCreateOrder(payload);
              setOpen(false);
            }}
          />
        ) : (
          <ExpenseForm
            products={products}
            isMutating={isMutating}
            previous={"amount" in (lastEntry ?? {}) ? (lastEntry as Expense) : null}
            onSubmit={async (payload) => {
              await onCreateExpense(payload);
              setOpen(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function OrderForm({
  products,
  isMutating,
  onSubmit,
  onCreateProduct
}: {
  products: Product[];
  isMutating: boolean;
  onSubmit: (payload: {
    paymentMethod: PaymentMethod;
    items: DraftItem[];
    note?: string;
    createdAt?: string;
  }) => Promise<void>;
  onCreateProduct: (payload: Record<string, unknown>) => Promise<Product>;
}) {
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("SINPE");
  const [selectedDate, setSelectedDate] = React.useState(todayDateInputValue);
  const [items, setItems] = React.useState<DraftItem[]>([]);
  const [note, setNote] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [nextNumber, setNextNumber] = React.useState<number | null>(null);
  const [showNewProduct, setShowNewProduct] = React.useState(false);
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  React.useEffect(() => {
    fetch("/api/orders/next-number")
      .then((response) => response.json())
      .then((data) => setNextNumber(data.nextOrderNumber))
      .catch(() => setNextNumber(null));
  }, []);

  function addProduct(product: Product) {
    const id = String(product._id);
    setItems((current) => {
      const found = current.find((item) => item.productId === id);
      if (found) {
        return current.map((item) =>
          item.productId === id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice }
            : item
        );
      }

      return [
        ...current,
        {
          productId: id,
          productName: product.name,
          category: product.category as IncomeCategory,
          quantity: 1,
          unitPrice: product.defaultPrice,
          subtotal: product.defaultPrice
        }
      ];
    });
  }

  function changeQuantity(productId: string, delta: number) {
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!items.length) return;
    await onSubmit({
      paymentMethod,
      items,
      note,
      createdAt: toLocalDateIso(selectedDate)
    });
    setItems([]);
    setNote("");
  }

  const filteredProducts = products.filter((product) => {
    const text = `${product.name} ${product.category}`.toLowerCase();
    return (product.kind ?? "sell") === "sell" && product.active && text.includes(search.toLowerCase());
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between rounded-2xl bg-secondary p-4">
        <div>
          <p className="text-xs text-muted-foreground">Orden sugerida</p>
          <p className="text-xl font-bold">#{nextNumber ?? "..."}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCRC(total)}</p>
        </div>
      </div>

      <TransactionDatePicker
        date={selectedDate}
        onDateChange={setSelectedDate}
      />

      <PaymentPicker value={paymentMethod} onChange={setPaymentMethod} />

      <div className="space-y-3">
        <Label>Productos</Label>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar ceviche, caldosa..."
            className="pl-10"
          />
        </div>

        <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
          {INCOME_CATEGORIES.map((category) => {
            const grouped = filteredProducts.filter((product) => product.category === category);
            if (!grouped.length) return null;

            return (
              <div key={category} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {grouped.map((product) => (
                    <button
                      key={String(product._id)}
                      type="button"
                      className="flex min-h-16 items-center justify-between rounded-2xl border bg-card p-3 text-left transition hover:bg-secondary"
                      onClick={() => addProduct(product)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{product.name}</span>
                        <span className="text-xs text-muted-foreground">{formatCRC(product.defaultPrice)}</span>
                      </span>
                      <PlusCircle className="h-5 w-5 text-primary" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={() => setShowNewProduct((value) => !value)}>
          <Plus className="h-4 w-4" />
          Agregar producto nuevo
        </Button>

        {showNewProduct ? (
          <NewProductForm
            onCreate={async (payload) => {
              const product = await onCreateProduct(payload);
              addProduct(product);
              setShowNewProduct(false);
            }}
          />
        ) : null}
      </div>

      {items.length ? (
        <div className="space-y-2">
          <Label>Orden actual</Label>
          {items.map((item) => (
            <motion.div
              key={item.productId}
              layout
              className="flex items-center gap-3 rounded-2xl border bg-background p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.productName}</p>
                <p className="text-xs text-muted-foreground">{formatCRC(item.unitPrice)} c/u</p>
              </div>
              <QuantityControl
                quantity={item.quantity}
                onMinus={() => changeQuantity(item.productId, -1)}
                onPlus={() => changeQuantity(item.productId, 1)}
              />
              <Badge variant="success">{formatCRC(item.subtotal)}</Badge>
            </motion.div>
          ))}
        </div>
      ) : null}

      <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota opcional" />
      <Button type="submit" size="lg" className="w-full" disabled={!items.length || isMutating}>
        {isMutating ? "Guardando..." : `Guardar orden · ${formatCRC(total)}`}
      </Button>
    </form>
  );
}

function ExpenseForm({
  products,
  isMutating,
  previous,
  onSubmit
}: {
  products: Product[];
  isMutating: boolean;
  previous: Expense | null;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [amount, setAmount] = React.useState(previous?.amount ? String(previous.amount) : "");
  const [category, setCategory] = React.useState<ExpenseCategory>(
    asExpenseCategory(previous?.category ?? EXPENSE_CATEGORIES[0])
  );
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [productSearch, setProductSearch] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("SINPE");
  const [selectedDate, setSelectedDate] = React.useState(todayDateInputValue);
  const [receiptNumber, setReceiptNumber] = React.useState("");
  const [vendorName, setVendorName] = React.useState("");
  const [note, setNote] = React.useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit({
      amount: Number(amount),
      category,
      productId: selectedProduct?._id ? String(selectedProduct._id) : undefined,
      productName: selectedProduct?.name,
      paymentMethod,
      createdAt: toLocalDateIso(selectedDate),
      receiptNumber,
      vendorName,
      note
    });
    setAmount("");
    setSelectedProduct(null);
    setProductSearch("");
    setReceiptNumber("");
    setVendorName("");
    setNote("");
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label>Monto</Label>
        <Input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="₡0"
          className="h-16 text-3xl font-bold"
          required
        />
      </div>

      <TransactionDatePicker
        date={selectedDate}
        onDateChange={setSelectedDate}
      />

      <BuyProductPicker
        products={products}
        search={productSearch}
        selectedProduct={selectedProduct}
        onSearchChange={setProductSearch}
        onSelect={(product) => {
          setSelectedProduct(product);
          setProductSearch(product.name);
          setCategory(asExpenseCategory(product.category));

          if (product.defaultPrice > 0) {
            setAmount(String(product.defaultPrice));
          }
        }}
        onClear={() => {
          setSelectedProduct(null);
          setProductSearch("");
        }}
      />

      <div className="space-y-2">
        <Label>Categoria</Label>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
          className="h-12 w-full rounded-2xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
        >
          {EXPENSE_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <PaymentPicker value={paymentMethod} onChange={setPaymentMethod} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          value={receiptNumber}
          onChange={(event) => setReceiptNumber(event.target.value)}
          placeholder="Factura o recibo"
        />
        <Input
          value={vendorName}
          onChange={(event) => setVendorName(event.target.value)}
          placeholder="Proveedor opcional"
        />
      </div>
      <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota opcional" />
      <Button type="submit" size="lg" variant="destructive" className="w-full" disabled={!amount || isMutating}>
        {isMutating ? "Guardando..." : "Guardar gasto"}
      </Button>
    </form>
  );
}

function asExpenseCategory(category: unknown): ExpenseCategory {
  const normalized = normalizeExpenseCategory(category);
  return EXPENSE_CATEGORIES.includes(normalized as ExpenseCategory)
    ? (normalized as ExpenseCategory)
    : EXPENSE_CATEGORIES[0];
}

function BuyProductPicker({
  products,
  search,
  selectedProduct,
  onSearchChange,
  onSelect,
  onClear
}: {
  products: Product[];
  search: string;
  selectedProduct: Product | null;
  onSearchChange: (value: string) => void;
  onSelect: (product: Product) => void;
  onClear: () => void;
}) {
  const buyProducts = products.filter((product) => {
    const text = `${product.name} ${product.category}`.toLowerCase();
    return (product.kind ?? "sell") === "buy" && product.active && text.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-3">
      <Label>Producto comprado</Label>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => {
            onSearchChange(event.target.value);
          }}
          placeholder="Buscar pescado, hielo, empaques..."
          className="pl-10"
        />
      </div>

      {selectedProduct ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-emerald-500/10 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{selectedProduct.name}</p>
            <p className="text-xs text-muted-foreground">
              {selectedProduct.category} · Costo ref. {formatCRC(selectedProduct.defaultPrice)}
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onClear}>
            Cambiar
          </Button>
        </div>
      ) : (
        <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
          {buyProducts.length ? (
            buyProducts.map((product) => (
              <button
                key={String(product._id)}
                type="button"
                className="flex min-h-14 w-full items-center justify-between rounded-2xl border bg-card p-3 text-left transition hover:bg-secondary"
                onClick={() => onSelect(product)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{product.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {product.category} · {formatCRC(product.defaultPrice)}
                  </span>
                </span>
                <PlusCircle className="h-5 w-5 text-primary" />
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              Agrega productos en la seccion Productos &gt; Compro.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TransactionDatePicker({
  date,
  onDateChange
}: {
  date: string;
  onDateChange: (value: string) => void;
}) {
  const today = todayDateInputValue();

  function handleDateChange(value: string) {
    onDateChange(value);
  }

  return (
    <div className="space-y-2 rounded-2xl border bg-card p-3">
      <Label className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-primary" />
        Fecha del movimiento
      </Label>
      <Input type="date" value={date} max={today} onChange={(event) => handleDateChange(event.target.value)} />
      <p className="text-xs text-muted-foreground">Puedes registrar dias anteriores; fechas futuras quedan bloqueadas.</p>
    </div>
  );
}

function PaymentPicker({ value, onChange }: { value: PaymentMethod; onChange: (value: PaymentMethod) => void }) {
  return (
    <div className="space-y-2">
      <Label>Metodo de pago</Label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PAYMENT_METHODS.map((method) => (
          <Button
            key={method}
            type="button"
            variant={value === method ? "default" : "secondary"}
            className="h-12"
            onClick={() => onChange(method)}
          >
            {method}
          </Button>
        ))}
      </div>
    </div>
  );
}

function todayDateInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalDateIso(date: string) {
  const today = todayDateInputValue();

  if (date === today) {
    return new Date().toISOString();
  }

  return new Date(`${date}T12:00:00`).toISOString();
}

function QuantityControl({ quantity, onMinus, onPlus }: { quantity: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0" onClick={onMinus}>
        <Minus className="h-4 w-4" />
      </Button>
      <span className="w-7 text-center text-sm font-bold">{quantity}</span>
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0" onClick={onPlus}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

function NewProductForm({ onCreate }: { onCreate: (payload: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<IncomeCategory>("Ceviche");
  const [defaultPrice, setDefaultPrice] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleCreate() {
    if (!name.trim() || !defaultPrice) {
      return;
    }

    setSaving(true);
    try {
      await onCreate({ name, kind: "sell", category, defaultPrice: Number(defaultPrice), active: true });
      setName("");
      setDefaultPrice("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-muted/30 p-3">
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del producto" />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as IncomeCategory)}
          className="h-12 rounded-2xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring"
        >
          {INCOME_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <Input
          value={defaultPrice}
          onChange={(event) => setDefaultPrice(event.target.value)}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Precio"
        />
      </div>
      <Button
        type="button"
        className="w-full"
        disabled={saving || !name.trim() || !defaultPrice}
        onClick={handleCreate}
      >
        {saving ? "Agregando..." : "Guardar producto"}
      </Button>
    </div>
  );
}

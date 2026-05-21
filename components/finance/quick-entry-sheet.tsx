"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Copy,
  Fish,
  Minus,
  Package,
  Pencil,
  Plus,
  PlusCircle,
  Search,
  ShoppingCart,
  GlassWater,
  Wallet
} from "lucide-react";

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
  type Product,
  type Provider
} from "@/lib/finance-types";
import { cn, formatCRC } from "@/lib/utils";

type DraftItem = OrderItem;

type QuickEntrySheetProps = {
  products: Product[];
  providers: Provider[];
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
  onCreateProvider: (payload: Record<string, unknown>) => Promise<Provider>;
  onUpdateProduct: (id: string, payload: Record<string, unknown>) => Promise<Product>;
};

export function QuickEntrySheet({
  products,
  providers,
  isMutating,
  lastEntry,
  onCreateOrder,
  onCreateExpense,
  onCreateProduct,
  onCreateProvider,
  onUpdateProduct
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
      <SheetContent className="md:max-w-4xl">
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
            onUpdateProduct={onUpdateProduct}
            onSubmit={async (payload) => {
              await onCreateOrder(payload);
              setOpen(false);
            }}
          />
        ) : (
          <ExpenseForm
            products={products}
            providers={providers}
            isMutating={isMutating}
            previous={"amount" in (lastEntry ?? {}) ? (lastEntry as Expense) : null}
            onCreateProvider={onCreateProvider}
            onSubmit={async (payload) => {
              if (Array.isArray(payload)) {
                await Promise.all(payload.map((entry) => onCreateExpense(entry)));
              } else {
                await onCreateExpense(payload);
              }
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
  onCreateProduct,
  onUpdateProduct
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
  onUpdateProduct: (id: string, payload: Record<string, unknown>) => Promise<Product>;
}) {
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("SINPE");
  const [selectedDate, setSelectedDate] = React.useState(todayDateInputValue);
  const [items, setItems] = React.useState<DraftItem[]>([]);
  const [note, setNote] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [nextNumber, setNextNumber] = React.useState<number | null>(null);
  const [showNewProduct, setShowNewProduct] = React.useState(false);
  const [addedProduct, setAddedProduct] = React.useState<{ name: string; quantity: number; nonce: number } | null>(null);
  const addedProductNonce = React.useRef(0);
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  React.useEffect(() => {
    fetch("/api/orders/next-number")
      .then((response) => response.json())
      .then((data) => setNextNumber(data.nextOrderNumber))
      .catch(() => setNextNumber(null));
  }, []);

  function addProduct(product: Product, quantity = 1) {
    const id = String(product._id);
    const cleanQuantity = Math.max(1, quantity);
    const nextQuantity = (items.find((item) => item.productId === id)?.quantity ?? 0) + cleanQuantity;

    setAddedProduct({
      name: product.name,
      quantity: nextQuantity,
      nonce: (addedProductNonce.current += 1)
    });

    setItems((current) => {
      const found = current.find((item) => item.productId === id);

      if (found) {
        return current.map((item) =>
          item.productId === id
            ? { ...item, quantity: item.quantity + cleanQuantity, subtotal: (item.quantity + cleanQuantity) * item.unitPrice }
            : item
        );
      }

      return [
        ...current,
        {
          productId: id,
          productName: product.name,
          category: product.category as IncomeCategory,
          quantity: cleanQuantity,
          unitPrice: product.defaultPrice,
          originalUnitPrice: product.defaultPrice,
          subtotal: product.defaultPrice * cleanQuantity
        }
      ];
    });
  }

  React.useEffect(() => {
    if (!addedProduct) return;

    const timeout = window.setTimeout(() => {
      setAddedProduct(null);
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [addedProduct]);

  async function applyPriceChange(
    item: DraftItem,
    nextPrice: number,
    reason: string,
    updateCatalog: boolean
  ) {
    setItems((current) =>
      current.map((currentItem) =>
        currentItem.productId === item.productId
          ? {
              ...currentItem,
              unitPrice: nextPrice,
              originalUnitPrice: currentItem.originalUnitPrice ?? item.unitPrice,
              priceChangeReason: reason,
              subtotal: currentItem.quantity * nextPrice
            }
          : currentItem
      )
    );

    if (updateCatalog) {
      const product = products.find((entry) => String(entry._id) === item.productId);
      if (product) {
        await onUpdateProduct(item.productId, {
          name: product.name,
          kind: product.kind ?? "sell",
          category: product.category,
          defaultPrice: nextPrice,
          active: product.active
        });
      }
    }
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

  const sellProducts = products.filter((product) => (product.kind ?? "sell") === "sell" && product.active);
  const filteredProducts = sellProducts.filter((product) => {
    const text = `${product.name} ${product.category}`.toLowerCase();
    return text.includes(search.toLowerCase());
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

        <ProductAddedNotice product={addedProduct} context="orden" />

        <GuidedProductPicker products={sellProducts} onAddProduct={addProduct} />

        <details className="rounded-2xl border bg-background p-3">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">Buscar en todo el catálogo</summary>
          <div className="mt-3 space-y-3">
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
          </div>
        </details>

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
              <PriceChangeButton item={item} onApply={applyPriceChange} />
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

type GuidedCategory = "Ceviche" | "Caldosa" | "Otros";

type GuidedStep = "category" | "size" | "product";

const CEVICHE_SIZES = ["8oz", "12oz", "16oz", "22oz"] as const;
const CALDOSA_SIZES = ["9oz", "12oz", "20oz"] as const;
const PRODUCT_STYLES = ["Camaron", "Clasico", "Mixto", "Tropical"] as const;
const PRODUCT_STYLE_ALIASES: Record<(typeof PRODUCT_STYLES)[number], string[]> = {
  Camaron: ["camaron"],
  Clasico: ["clasico", "clasica"],
  Mixto: ["mixto", "mixta"],
  Tropical: ["tropical"]
};

function GuidedProductPicker({
  products,
  onAddProduct
}: {
  products: Product[];
  onAddProduct: (product: Product, quantity?: number) => void;
}) {
  const [category, setCategory] = React.useState<GuidedCategory | null>(null);
  const [size, setSize] = React.useState("");
  const [style, setStyle] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const step: GuidedStep = !category ? "category" : category !== "Otros" && !size ? "size" : "product";

  const sizeOptions = category === "Ceviche" ? CEVICHE_SIZES : category === "Caldosa" ? CALDOSA_SIZES : [];
  const styleOptions = React.useMemo(
    () => getAvailableProductStyles(products, category, size),
    [products, category, size]
  );
  const currentStepNumber = step === "category" ? 1 : step === "size" ? 2 : 3;
  const suggestedProducts = React.useMemo(
    () => findGuidedProducts(products, category, size, style),
    [products, category, size, style]
  );
  const selectedProduct = suggestedProducts.length === 1 ? suggestedProducts[0] : null;

  function resetAll() {
    setCategory(null);
    setSize("");
    setStyle("");
    setQuantity(1);
  }

  function back() {
    if (step === "category") return;
    if (step === "size") {
      resetAll();
      return;
    }
    if (category === "Otros") {
      resetAll();
      return;
    }
    setStyle("");
    setSize("");
    setQuantity(1);
  }

  function addAndContinue(product: Product) {
    onAddProduct(product, quantity);
    setStyle("");
    setQuantity(1);
  }

  function addAndReset(product: Product) {
    onAddProduct(product, quantity);
    resetAll();
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border bg-card shadow-sm">
      <div className="border-b bg-secondary/50 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ingreso rápido</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span>{category ?? "Tipo"}</span>
              {size ? (
                <>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <span>{size}</span>
                </>
              ) : null}
              {style ? (
                <>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <span>{displayProductStyle(style, category)}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StepPill active={currentStepNumber >= 1} current={currentStepNumber === 1} label="Tipo" />
            <StepPill active={currentStepNumber >= 2} current={currentStepNumber === 2} label="Tamaño" />
            <StepPill active={currentStepNumber >= 3} current={currentStepNumber === 3} label="Producto" />
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        {step !== "category" ? (
          <Button type="button" variant="ghost" size="sm" className="h-9 px-2" onClick={back}>
            <ArrowLeft className="h-4 w-4" />
            Atrás
          </Button>
        ) : null}

        {step === "category" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {(["Ceviche", "Caldosa", "Otros"] as const).map((option) => (
              <GuidedTile
                key={option}
                title={option}
                subtitle={guidedCategorySubtitle(option, products)}
                icon={guidedCategoryIcon(option)}
                tone={guidedCategoryTone(option)}
                active={category === option}
                onClick={() => {
                  setCategory(option);
                  setSize("");
                  setStyle("");
                  setQuantity(1);
                }}
              />
            ))}
          </div>
        ) : null}

        {step === "size" ? (
          <div className="space-y-3">
            <SectionHeading title={`Tamaño de ${category}`} detail="Toque una opción para continuar" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {sizeOptions.map((option) => (
                <GuidedTile
                  key={option}
                  title={option}
                  subtitle={`${countMatchingProducts(products, category, option)} productos`}
                  tone="sky"
                  active={size === option}
                  onClick={() => setSize(option)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {step === "product" ? (
          <div className="space-y-4">
            {styleOptions.length ? (
              <div className="space-y-3">
                <SectionHeading title="Producto" detail={style ? "Listo para agregar" : "Elija el sabor o mezcla"} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {styleOptions.map((option) => (
                    <GuidedTile
                      key={option}
                      title={displayProductStyle(option, category)}
                      subtitle={styleSubtitle(products, category, size, option)}
                      tone={guidedStyleTone(option)}
                      active={style === option}
                      onClick={() => setStyle(option)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 rounded-2xl border bg-secondary/40 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Cantidad</p>
                <p className="text-sm font-semibold">{quantity} unidad{quantity === 1 ? "" : "es"}</p>
              </div>
              <QuantityControl
                quantity={quantity}
                onMinus={() => setQuantity((current) => Math.max(1, current - 1))}
                onPlus={() => setQuantity((current) => current + 1)}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {suggestedProducts.map((product) => (
                <ProductChoiceCard
                  key={String(product._id)}
                  product={product}
                  quantity={quantity}
                  selected={Boolean(selectedProduct && String(selectedProduct._id) === String(product._id))}
                  onClick={() => addAndContinue(product)}
                />
              ))}
            </div>

            {!suggestedProducts.length ? (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                No encontré ese producto en el catálogo activo. Revise el nombre o agréguelo como producto nuevo.
              </div>
            ) : null}

            {selectedProduct ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" size="lg" onClick={() => addAndContinue(selectedProduct)}>
                  <PlusCircle className="h-5 w-5" />
                  Agregar más
                </Button>
                <Button type="button" size="lg" variant="secondary" onClick={() => addAndReset(selectedProduct)}>
                  Agregar y cambiar producto
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GuidedTile({
  title,
  subtitle,
  icon,
  tone = "neutral",
  active,
  onClick
}: {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  tone?: "neutral" | "sky" | "emerald" | "amber" | "rose";
  active: boolean;
  onClick: () => void;
}) {
  const tones = {
    neutral: "bg-background text-foreground",
    sky: "bg-sky-500/8 text-sky-800 dark:text-sky-200",
    emerald: "bg-emerald-500/8 text-emerald-800 dark:text-emerald-200",
    amber: "bg-yellow-500/10 text-yellow-800 dark:text-yellow-200",
    rose: "bg-rose-500/8 text-rose-800 dark:text-rose-200"
  };

  return (
    <button
      type="button"
      className={cn(
        "group min-h-24 rounded-2xl border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md",
        active && "border-primary bg-secondary shadow-sm"
      )}
      onClick={onClick}
    >
      <span className="mb-3 flex items-center justify-between gap-2">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", tones[tone])}>
          {icon ?? <CheckCircle2 className="h-5 w-5" />}
        </span>
        {active ? <CheckCircle2 className="h-5 w-5 text-primary" /> : null}
      </span>
      <span className="block text-base font-bold">{title}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{subtitle}</span>
    </button>
  );
}

function StepPill({ active, current, label }: { active: boolean; current: boolean; label: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold transition",
        active ? "bg-primary/10 text-primary" : "bg-background text-muted-foreground",
        current && "ring-2 ring-primary/20"
      )}
    >
      {label}
    </span>
  );
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-base font-bold">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function ProductChoiceCard({
  product,
  quantity,
  selected,
  onClick
}: {
  product: Product;
  quantity: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-24 items-center justify-between gap-3 rounded-2xl border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-primary hover:bg-secondary/60 hover:shadow-md",
        selected && "border-primary bg-secondary/70 shadow-sm"
      )}
      onClick={onClick}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="block truncate text-base font-bold">{product.name}</span>
          {selected ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : null}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">{formatCRC(product.defaultPrice)} c/u</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        <Badge variant="success" className="text-sm">{formatCRC(product.defaultPrice * quantity)}</Badge>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
          <PlusCircle className="h-4 w-4" />
          Agregar
        </span>
      </span>
    </button>
  );
}

function findGuidedProducts(products: Product[], category: GuidedCategory | null, size: string, style: string) {
  if (!category) return [];
  if (category === "Otros") {
    return products.filter((product) => product.category !== "Ceviche" && product.category !== "Caldosa");
  }

  const categoryMatches = products.filter((product) => product.category === category);
  const sized = size ? categoryMatches.filter((product) => productHasSize(product, size)) : categoryMatches;
  const styled = style ? sized.filter((product) => productHasStyle(product, style)) : sized;

  return styled;
}

function countMatchingProducts(products: Product[], category: GuidedCategory | null, size: string) {
  return findGuidedProducts(products, category, size, "").length;
}

function guidedCategorySubtitle(category: GuidedCategory, products: Product[]) {
  const count =
    category === "Otros"
      ? products.filter((product) => product.category !== "Ceviche" && product.category !== "Caldosa").length
      : products.filter((product) => product.category === category).length;

  return `${count} en catálogo`;
}

function displayProductStyle(style: string, category?: GuidedCategory | null) {
  if (style === "Camaron") return "Camarón";
  if (style === "Clasico") return category === "Caldosa" ? "Clásica" : "Clásico";
  if (style === "Mixto") return category === "Caldosa" ? "Mixta" : "Mixto";
  return style;
}

function styleSubtitle(products: Product[], category: GuidedCategory | null, size: string, style: string) {
  const matches = findGuidedProducts(products, category, size, style);
  if (matches.length === 1) return formatCRC(matches[0].defaultPrice);

  return `${matches.length} opciones`;
}

function guidedCategoryIcon(category: GuidedCategory) {
  if (category === "Ceviche") return <Fish className="h-5 w-5" />;
  if (category === "Caldosa") return <GlassWater className="h-5 w-5" />;
  return <Package className="h-5 w-5" />;
}

function guidedCategoryTone(category: GuidedCategory) {
  if (category === "Ceviche") return "sky" as const;
  if (category === "Caldosa") return "emerald" as const;
  return "amber" as const;
}

function guidedStyleTone(style: string) {
  if (style === "Camaron") return "rose" as const;
  if (style === "Tropical") return "emerald" as const;
  if (style === "Mixto") return "amber" as const;
  return "sky" as const;
}

function getAvailableProductStyles(products: Product[], category: GuidedCategory | null, size: string) {
  if (!category || category === "Otros" || !size) return [];

  return PRODUCT_STYLES.filter((style) =>
    products.some(
      (product) => product.category === category && productHasSize(product, size) && productHasStyle(product, style)
    )
  );
}

function productHasSize(product: Product, size: string) {
  return normalizeCatalogText(product.name).includes(normalizeCatalogText(size));
}

function productHasStyle(product: Product, style: string) {
  const normalizedName = normalizeCatalogText(product.name);
  const aliases = PRODUCT_STYLE_ALIASES[style as (typeof PRODUCT_STYLES)[number]] ?? [style];

  return aliases.some((alias) => normalizedName.includes(normalizeCatalogText(alias)));
}

function normalizeCatalogText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function PriceChangeButton({
  item,
  onApply
}: {
  item: DraftItem;
  onApply: (item: DraftItem, nextPrice: number, reason: string, updateCatalog: boolean) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [price, setPrice] = React.useState(String(item.unitPrice));
  const [reason, setReason] = React.useState(item.priceChangeReason ?? "");
  const [updateCatalog, setUpdateCatalog] = React.useState(false);
  const changed = Number(price) > 0 && Number(price) !== item.unitPrice;

  async function handleApply() {
    if (!changed || !reason.trim()) return;
    await onApply(item, Number(price), reason.trim(), updateCatalog);
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="secondary" size="icon" onClick={() => setOpen(true)} aria-label="Cambiar precio">
        <Pencil className="h-4 w-4" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Cambiar precio</SheetTitle>
            <SheetDescription>{item.productName}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Nuevo precio</Label>
              <Input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="numeric" pattern="[0-9]*" />
            </div>
            <div className="space-y-2">
              <Label>Detalle del cambio del precio</Label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ej: precio especial, promo, ajuste manual..."
                className="min-h-28 w-full resize-none rounded-2xl border bg-background p-4 text-sm outline-none transition focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="rounded-2xl border bg-secondary p-3">
              <p className="mb-2 text-sm font-semibold">¿Actualizar precio del producto?</p>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={!updateCatalog ? "default" : "secondary"} onClick={() => setUpdateCatalog(false)}>
                  Solo esta orden
                </Button>
                <Button type="button" variant={updateCatalog ? "default" : "secondary"} onClick={() => setUpdateCatalog(true)}>
                  Cambiar producto
                </Button>
              </div>
            </div>
            <Button type="button" size="lg" className="w-full" disabled={!changed || !reason.trim()} onClick={handleApply}>
              Aplicar cambio
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ExpenseForm({
  products,
  providers,
  isMutating,
  previous,
  onCreateProvider,
  onSubmit
}: {
  products: Product[];
  providers: Provider[];
  isMutating: boolean;
  previous: Expense | null;
  onCreateProvider: (payload: Record<string, unknown>) => Promise<Provider>;
  onSubmit: (payload: Record<string, unknown> | Array<Record<string, unknown>>) => Promise<void>;
}) {
  const [manualAmount, setManualAmount] = React.useState(previous?.amount ? String(previous.amount) : "");
  const [category, setCategory] = React.useState<ExpenseCategory>(
    asExpenseCategory(previous?.category ?? EXPENSE_CATEGORIES[0])
  );
  const [productSearch, setProductSearch] = React.useState("");
  const [expenseLines, setExpenseLines] = React.useState<Array<{
    amount: number;
    category: ExpenseCategory;
    productId?: string;
    productName?: string;
    quantity?: number;
    unitCost?: number;
    note?: string;
  }>>([]);
  const [manualMode, setManualMode] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("SINPE");
  const [selectedDate, setSelectedDate] = React.useState(todayDateInputValue);
  const [receiptNumber, setReceiptNumber] = React.useState("");
  const [vendorName, setVendorName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [addedProduct, setAddedProduct] = React.useState<{ name: string; quantity: number; nonce: number } | null>(null);
  const addedProductNonce = React.useRef(0);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const manualLine = buildManualExpenseLine();
    const lines = manualLine ? [...expenseLines, manualLine] : expenseLines;

    if (!lines.length) return;

    await onSubmit(lines.map((line) => ({
      ...line,
      paymentMethod,
      createdAt: toLocalDateIso(selectedDate),
      receiptNumber,
      vendorName,
      note: line.note
    })));

    setManualAmount("");
    setProductSearch("");
    setExpenseLines([]);
    setManualMode(false);
    setReceiptNumber("");
    setVendorName("");
    setNote("");
  }

  async function saveProviderOption(name: string) {
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    const exists = providers.some((provider) => provider.name.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      await onCreateProvider({ name: trimmed, active: true });
    }
  }

  function buildManualExpenseLine() {
    if (!manualMode) return null;

    const parsedAmount = Number(manualAmount);

    if (!parsedAmount || parsedAmount <= 0) {
      return null;
    }

    return {
      amount: parsedAmount,
      category,
      note
    };
  }

  function addManualExpenseLine() {
    const line = buildManualExpenseLine();
    if (!line) return;
    setExpenseLines((current) => [...current, line]);
    setManualAmount("");
    setProductSearch("");
    setCategory(EXPENSE_CATEGORIES[0]);
    setNote("");
    setManualMode(false);
  }

  function addBuyProduct(product: Product) {
    const id = String(product._id);
    const nextQuantity = (expenseLines.find((line) => line.productId === id)?.quantity ?? 0) + 1;

    setAddedProduct({
      name: product.name,
      quantity: nextQuantity,
      nonce: (addedProductNonce.current += 1)
    });

    setExpenseLines((current) => {
      const found = current.find((line) => line.productId === id);

      if (found) {
        return current.map((line) =>
          line.productId === id
            ? {
                ...line,
                quantity: (line.quantity ?? 1) + 1,
                amount: ((line.quantity ?? 1) + 1) * (line.unitCost ?? line.amount)
              }
            : line
        );
      }

      const unitCost = product.defaultPrice > 0 ? product.defaultPrice : 0;

      return [
        ...current,
        {
          amount: unitCost,
          category: asExpenseCategory(product.category),
          productId: id,
          productName: product.name,
          quantity: 1,
          unitCost
        }
      ];
    });
    setProductSearch("");
  }

  React.useEffect(() => {
    if (!addedProduct) return;

    const timeout = window.setTimeout(() => {
      setAddedProduct(null);
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [addedProduct]);

  function updateExpenseLine(index: number, patch: Partial<{ quantity: number; unitCost: number; amount: number; note: string }>) {
    setExpenseLines((current) =>
      current.map((line, itemIndex) => {
        if (itemIndex !== index) return line;
        const quantity = Math.max(1, patch.quantity ?? line.quantity ?? 1);
        const unitCost = Math.max(0, patch.unitCost ?? line.unitCost ?? line.amount);
        return {
          ...line,
          ...patch,
          quantity,
          unitCost,
          amount: patch.amount ?? quantity * unitCost
        };
      })
    );
  }

  const pendingTotal =
    expenseLines.reduce((total, line) => total + line.amount, 0) + (manualMode ? Number(manualAmount || 0) : 0);

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <TransactionDatePicker
        date={selectedDate}
        onDateChange={setSelectedDate}
      />

      <BuyProductPicker
        products={products}
        search={productSearch}
        onSearchChange={setProductSearch}
        onSelect={addBuyProduct}
        addedProduct={addedProduct}
      />

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
        <Button type="button" variant={!manualMode ? "default" : "ghost"} onClick={() => setManualMode(false)}>
          Productos
        </Button>
        <Button type="button" variant={manualMode ? "default" : "ghost"} onClick={() => setManualMode(true)}>
          Gasto manual
        </Button>
      </div>

      {manualMode ? (
        <div className="space-y-3 rounded-2xl border bg-muted/30 p-3">
          <div className="space-y-2">
            <Label>Monto manual</Label>
            <Input
              value={manualAmount}
              onChange={(event) => setManualAmount(event.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="₡0"
              className="h-14 text-2xl font-bold"
            />
          </div>

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

          <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota opcional del gasto" />
          <Button type="button" variant="outline" className="w-full" disabled={!manualAmount} onClick={addManualExpenseLine}>
            <Plus className="h-4 w-4" />
            Agregar gasto manual a esta factura
          </Button>
        </div>
      ) : null}

      <PaymentPicker value={paymentMethod} onChange={setPaymentMethod} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          value={receiptNumber}
          onChange={(event) => setReceiptNumber(event.target.value)}
          placeholder="Factura o recibo"
        />
        <ProviderCombobox
          value={vendorName}
          providers={providers}
          onChange={setVendorName}
          onCommit={saveProviderOption}
        />
      </div>

      {expenseLines.length ? (
        <div className="space-y-2 rounded-2xl border bg-muted/30 p-3">
          <Label>Gastos en esta factura</Label>
          {expenseLines.map((line, index) => (
            <div key={`${line.category}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-background p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{line.productName ?? line.category}</p>
                <p className="text-xs text-muted-foreground">
                  {line.category}
                  {line.productName ? ` · ${line.quantity ?? 1} x ${formatCRC(line.unitCost ?? line.amount)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {line.productName ? (
                  <>
                    <QuantityControl
                      quantity={line.quantity ?? 1}
                      onMinus={() => updateExpenseLine(index, { quantity: Math.max(1, (line.quantity ?? 1) - 1) })}
                      onPlus={() => updateExpenseLine(index, { quantity: (line.quantity ?? 1) + 1 })}
                    />
                    <Input
                      value={String(line.unitCost ?? 0)}
                      onChange={(event) => updateExpenseLine(index, { unitCost: Number(event.target.value || 0) })}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="h-10 w-28 rounded-xl text-sm"
                    />
                  </>
                ) : null}
                <span className="text-sm font-bold text-red-600">{formatCRC(line.amount)}</span>
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setExpenseLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                  Quitar
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Button type="submit" size="lg" variant="destructive" className="w-full" disabled={(!manualAmount && !expenseLines.length) || isMutating}>
        {isMutating ? "Guardando..." : `Guardar gastos · ${formatCRC(pendingTotal)}`}
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
  onSearchChange,
  onSelect,
  addedProduct
}: {
  products: Product[];
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (product: Product) => void;
  addedProduct: { name: string; quantity: number; nonce: number } | null;
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

      <ProductAddedNotice product={addedProduct} context="factura" />

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
    </div>
  );
}

function ProviderCombobox({
  value,
  providers,
  onChange,
  onCommit
}: {
  value: string;
  providers: Provider[];
  onChange: (value: string) => void;
  onCommit: (value: string) => Promise<void>;
}) {
  const listId = React.useId();
  const activeProviders = providers.filter((provider) => provider.active);
  const exists = activeProviders.some((provider) => provider.name.toLowerCase() === value.trim().toLowerCase());

  async function handleBlur() {
    try {
      await onCommit(value);
    } catch {
      // The expense save path also persists providers, so a transient dropdown save failure should not block entry.
    }
  }

  return (
    <div className="space-y-1">
      <Input
        value={value}
        list={listId}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => void handleBlur()}
        placeholder="Proveedor opcional"
      />
      <datalist id={listId}>
        {activeProviders.map((provider) => (
          <option key={String(provider._id ?? provider.name)} value={provider.name} />
        ))}
      </datalist>
      {value.trim() && !exists ? (
        <p className="px-1 text-xs text-muted-foreground">Se guardara como proveedor para la proxima factura.</p>
      ) : null}
    </div>
  );
}

function ProductAddedNotice({
  product,
  context
}: {
  product: { name: string; quantity: number; nonce: number } | null;
  context: "orden" | "factura";
}) {
  return (
    <AnimatePresence mode="wait">
      {product ? (
        <motion.div
          key={product.nonce}
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-emerald-800 shadow-sm shadow-emerald-500/10 dark:text-emerald-200"
          role="status"
          aria-live="polite"
        >
          <span className="mt-0.5 rounded-full bg-emerald-500/15 p-1">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">Has agregado {product.name}</span>
            <span className="block text-xs text-emerald-700/80 dark:text-emerald-200/80">
              {product.quantity > 1 ? `${product.quantity} unidades en la ${context}` : `Ya esta en la ${context}`}
            </span>
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
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

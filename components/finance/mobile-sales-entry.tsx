"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  LogOut,
  Minus,
  Package,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  WalletCards
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicUser } from "@/lib/auth";
import {
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  type IncomeCategory,
  type Order,
  type OrderItem,
  type PaymentMethod,
  type Product
} from "@/lib/finance-types";
import { cn, formatCRC } from "@/lib/utils";

type DraftItem = OrderItem;
type MobileView = "products" | "register" | "sales";

const EXTRA_UNIT_PRICE = 150;
const ORDER_EXTRAS = ["Pina", "Mango", "Chile panameno"] as const;

export function MobileSalesEntry({ user }: { user: PublicUser }) {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [todayOrders, setTodayOrders] = React.useState<Order[]>([]);
  const [items, setItems] = React.useState<DraftItem[]>([]);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("SINPE");
  const [selectedDate, setSelectedDate] = React.useState(todayDateInputValue);
  const [note, setNote] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<IncomeCategory | null>(null);
  const [nextNumber, setNextNumber] = React.useState<number | null>(null);
  const [lastOrder, setLastOrder] = React.useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = React.useState<Order | null>(null);
  const [activeView, setActiveView] = React.useState<MobileView>("products");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const isContractor = user.role === "contractor";

  const sellProducts = React.useMemo(
    () => products.filter((product) => (product.kind ?? "sell") === "sell" && product.active),
    [products]
  );

  const filteredProducts = React.useMemo(() => {
    const cleanSearch = normalizeSearch(search);

    return sellProducts.filter((product) => {
      const categoryMatches = !category || product.category === category;
      const textMatches = !cleanSearch || normalizeSearch(`${product.name} ${product.category}`).includes(cleanSearch);
      return categoryMatches && textMatches;
    });
  }, [category, search, sellProducts]);
  const hasProductFilter = search.trim().length > 0 || Boolean(category);
  const visibleProducts = hasProductFilter ? filteredProducts.slice(0, 8) : [];

  const catalogSections = React.useMemo(() => {
    return INCOME_CATEGORIES.map((item) => ({
      category: item,
      products: sellProducts
        .filter((product) => product.category === item)
        .sort((first, second) => first.name.localeCompare(second.name, "es"))
    })).filter((section) => section.products.length > 0);
  }, [sellProducts]);

  const categoryCounts = React.useMemo(() => {
    return INCOME_CATEGORIES.reduce<Record<IncomeCategory, number>>((counts, item) => {
      counts[item] = sellProducts.filter((product) => product.category === item).length;
      return counts;
    }, {} as Record<IncomeCategory, number>);
  }, [sellProducts]);

  const load = React.useCallback(async ({ showToast = false }: { showToast?: boolean } = {}) => {
    setError(null);
    setIsRefreshing(true);

    try {
      const [productsResponse, nextNumberResponse, ordersResponse] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/orders/next-number", { cache: "no-store" }),
        fetch("/api/orders?date=today&limit=100", { cache: "no-store" })
      ]);

      if (!productsResponse.ok) {
        throw new Error((await productsResponse.json()).error ?? "No se pudieron cargar productos.");
      }
      if (!ordersResponse.ok) {
        throw new Error((await ordersResponse.json()).error ?? "No se pudieron cargar ventas de hoy.");
      }

      setProducts(await productsResponse.json());
      setTodayOrders(await ordersResponse.json());

      if (nextNumberResponse.ok) {
        const data = await nextNumberResponse.json();
        setNextNumber(data.nextOrderNumber ?? null);
      } else {
        setNextNumber(null);
      }

      if (showToast) {
        toast.success("Lista actualizada");
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Error cargando ventas.";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function addProduct(product: Product) {
    const id = String(product._id);
    const unitPrice = Number(product.defaultPrice);
    const productCategory = asIncomeCategory(product.category);

    if (!id || !unitPrice || unitPrice <= 0) return;

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
          category: productCategory,
          quantity: 1,
          unitPrice,
          subtotal: unitPrice
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

  function removeItem(productId: string) {
    setItems((current) => current.filter((item) => item.productId !== productId));
  }

  function changeExtra(extra: string, delta: number) {
    const id = extraProductId(extra);

    setItems((current) => {
      const found = current.find((item) => item.productId === id);

      if (!found && delta <= 0) return current;

      if (!found) {
        return [
          ...current,
          {
            productId: id,
            productName: `Extra ${extra}`,
            category: "Otros",
            quantity: 1,
            unitPrice: EXTRA_UNIT_PRICE,
            subtotal: EXTRA_UNIT_PRICE
          }
        ];
      }

      return current
        .map((item) => {
          if (item.productId !== id) return item;
          const quantity = Math.max(0, item.quantity + delta);
          return { ...item, quantity, subtotal: quantity * item.unitPrice };
        })
        .filter((item) => item.quantity > 0);
    });
  }

  function startNewOrder() {
    setEditingOrder(null);
    setItems([]);
    setPaymentMethod("SINPE");
    setSelectedDate(todayDateInputValue());
    setNote("");
    setActiveView("register");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editOrder(order: Order) {
    setEditingOrder(order);
    setItems(order.items);
    setPaymentMethod(order.paymentMethod);
    setSelectedDate(dateInputValue(order.createdAt));
    setNote(order.note ?? "");
    setActiveView("register");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitOrder(event?: React.FormEvent) {
    event?.preventDefault();
    if (!items.length || isSaving) return;

    setIsSaving(true);
    const orderId = editingOrder?._id ? String(editingOrder._id) : null;
    const payload = {
      paymentMethod,
      items,
      note,
      createdAt: toLocalDateIso(isContractor ? todayDateInputValue() : selectedDate)
    };

    try {
      const response = await fetch(orderId ? `/api/orders/${orderId}` : "/api/orders", {
        method: orderId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error((await response.json()).error ?? "No se pudo guardar la venta.");
      }

      const order = (await response.json()) as Order;
      setLastOrder(order);
      startNewOrder();
      await load();
      if (!orderId) {
        setNextNumber(order.orderNumber + 1);
      }
      toast.success(`Orden #${order.orderNumber} ${orderId ? "actualizada" : "guardada"}`);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Error guardando la venta.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteOrder(order: Order) {
    if (!order._id || isSaving) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/orders/${String(order._id)}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error((await response.json()).error ?? "No se pudo anular la venta.");
      }

      if (editingOrder?._id && String(editingOrder._id) === String(order._id)) {
        startNewOrder();
      }
      await load();
      toast.success(`Orden #${order.orderNumber} anulada`);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Error anulando la venta.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-background pb-96">
      <header className="sticky top-0 z-30 border-b bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          {isContractor ? (
            <Button type="button" variant="secondary" size="icon" onClick={handleLogout} aria-label="Cerrar sesion">
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <Button asChild variant="secondary" size="icon" aria-label="Volver al panel">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">La Esquinita</p>
            <h1 className="truncate text-lg font-bold">
              {activeView === "products"
                ? "Productos"
                : activeView === "sales"
                  ? "Ventas de hoy"
                  : editingOrder
                    ? `Editar #${editingOrder.orderNumber}`
                    : "Registrar venta"}
            </h1>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => void load({ showToast: true })}
            disabled={isRefreshing}
            aria-label="Actualizar productos"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </header>

      <form className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-4" onSubmit={submitOrder}>
        <section className={cn("space-y-3", activeView !== "products" && "hidden")}>
          <div className="flex items-center justify-between gap-3">
            <Label>Todos los productos</Label>
            <Badge variant="secondary">{sellProducts.length} activos</Badge>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-secondary" />
              ))}
            </div>
          ) : null}

          {!isLoading && catalogSections.length ? (
            <div className="space-y-4">
              {catalogSections.map((section) => (
                <section key={section.category} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{section.category}</p>
                    <p className="text-xs text-muted-foreground">{section.products.length}</p>
                  </div>
                  <div className="overflow-hidden rounded-2xl border bg-card">
                    {section.products.map((product, index) => (
                      <ProductCatalogRow
                        key={String(product._id)}
                        product={product}
                        className={index > 0 ? "border-t" : undefined}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {!isLoading && !catalogSections.length ? (
            <div className="rounded-2xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
              No hay productos activos para vender.
            </div>
          ) : null}
        </section>

        <section className={cn("grid grid-cols-[1fr_auto] gap-3 rounded-2xl border bg-card p-4", activeView !== "register" && "hidden")}>
          <div>
            <p className="text-xs text-muted-foreground">Orden sugerida</p>
            <p className="mt-1 text-2xl font-bold">#{nextNumber ?? "..."}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{formatCRC(total)}</p>
          </div>
          {lastOrder ? (
            <div className="col-span-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Orden #{lastOrder.orderNumber} lista
            </div>
          ) : null}
          {editingOrder ? (
            <div className="col-span-2 flex items-center justify-between gap-2 rounded-xl bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-700 dark:text-sky-300">
              Editando orden #{editingOrder.orderNumber}
              <Button type="button" variant="ghost" size="sm" onClick={startNewOrder}>
                Nueva
              </Button>
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <section className={cn("space-y-3", activeView !== "register" && "hidden")}>
          <div className="flex items-center justify-between gap-3">
            <Label>Buscar producto</Label>
            <Badge variant="secondary">{sellProducts.length} activos</Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar ceviche, caldosa, refresco..."
              className="h-16 rounded-2xl pl-12 text-lg font-semibold"
              autoComplete="off"
              autoFocus
            />
          </div>

          {!hasProductFilter ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Secciones</p>
                <p className="text-xs text-muted-foreground">Elija una para empezar</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {INCOME_CATEGORIES.map((item) => (
                  <CategorySectionButton
                    key={item}
                    category={item}
                    count={categoryCounts[item] ?? 0}
                    onClick={() => setCategory(item)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {hasProductFilter ? (
            <div className="flex items-center justify-between rounded-2xl border bg-secondary/50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Mostrando</p>
                <p className="truncate text-sm font-bold">{category ?? "Busqueda"}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCategory(null);
                  setSearch("");
                }}
              >
                Limpiar
              </Button>
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-secondary" />
              ))}
            </div>
          ) : null}

          {!isLoading && visibleProducts.length ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Coincidencias</span>
                <span>
                  {filteredProducts.length > visibleProducts.length
                    ? `${visibleProducts.length} de ${filteredProducts.length}`
                    : filteredProducts.length}
                </span>
              </div>
              <div className="space-y-2">
                {visibleProducts.map((product) => {
                  const quantity = items.find((item) => item.productId === String(product._id))?.quantity ?? 0;

                  return (
                    <ProductResultButton
                      key={String(product._id)}
                      product={product}
                      quantity={quantity}
                      onClick={() => addProduct(product)}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          {!isLoading && hasProductFilter && !filteredProducts.length ? (
            <div className="rounded-2xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
              No hay productos con esa busqueda.
            </div>
          ) : null}
        </section>

        <section className={cn("space-y-3", activeView !== "sales" && "hidden")}>
          <div className="flex items-center justify-between gap-3">
            <Label>Ventas de hoy</Label>
            <Badge variant="secondary">{todayOrders.length}</Badge>
          </div>

          {todayOrders.length ? (
            <div className="space-y-2">
              {todayOrders.map((order) => (
                <div
                  key={String(order._id)}
                  className={cn(
                    "grid grid-cols-[1fr_auto] gap-3 rounded-2xl border bg-card p-3",
                    editingOrder?._id && String(editingOrder._id) === String(order._id) && "border-primary"
                  )}
                >
                  <button type="button" className="min-w-0 text-left" onClick={() => editOrder(order)}>
                    <span className="block text-sm font-bold">Orden #{order.orderNumber}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {order.items.map((item) => `${item.quantity}x ${item.productName}`).join(", ")}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-emerald-600">{formatCRC(order.totalAmount)}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" size="icon" onClick={() => editOrder(order)} aria-label="Editar venta">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void deleteOrder(order)}
                      disabled={isSaving}
                      aria-label="Anular venta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
              Aun no hay ventas registradas hoy.
            </div>
          )}
        </section>

        <section className={cn("space-y-3", activeView !== "register" && "hidden")}>
          <Label>Extras</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {ORDER_EXTRAS.map((extra) => {
              const quantity = items.find((item) => item.productId === extraProductId(extra))?.quantity ?? 0;

              return (
                <div key={extra} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{extra}</p>
                    <p className="text-xs text-muted-foreground">{formatCRC(EXTRA_UNIT_PRICE)}</p>
                  </div>
                  <QuantityControl
                    quantity={quantity}
                    onMinus={() => changeExtra(extra, -1)}
                    onPlus={() => changeExtra(extra, 1)}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section className={cn("space-y-3", activeView !== "register" && "hidden")}>
          <Label>Metodo de pago</Label>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                className={cn(
                  "flex min-h-14 items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition",
                  paymentMethod === method ? "border-primary bg-primary text-primary-foreground" : "bg-card"
                )}
                onClick={() => setPaymentMethod(method)}
              >
                {paymentMethod === method ? <CheckCircle2 className="h-4 w-4" /> : <WalletCards className="h-4 w-4" />}
                {method}
              </button>
            ))}
          </div>
        </section>

        <section className={cn("grid gap-3 sm:grid-cols-2", activeView !== "register" && "hidden")}>
          <div className="space-y-2">
            <Label htmlFor="sale-date">Fecha</Label>
            {isContractor ? (
              <div className="flex h-12 items-center gap-2 rounded-2xl border bg-secondary px-4 text-sm font-semibold">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Hoy
              </div>
            ) : (
              <div className="relative">
                <CalendarDays className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="sale-date"
                  type="date"
                  value={selectedDate}
                  max={todayDateInputValue()}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="pl-11"
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sale-note">Nota</Label>
            <Input
              id="sale-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Opcional"
            />
          </div>
        </section>
      </form>

      {activeView === "register" ? (
        <div className="fixed inset-x-0 bottom-[5.75rem] z-40 px-4">
          <div className="mx-auto max-w-4xl rounded-2xl border bg-card/95 p-3 shadow-2xl shadow-slate-900/10 backdrop-blur">
            {items.length ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Venta actual</p>
                    <p className="truncate text-sm font-bold">{itemCount} unidades seleccionadas</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setItems([])}>
                    <Trash2 className="h-4 w-4" />
                    Limpiar
                  </Button>
                </div>

                <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <SelectedItemReviewRow
                      key={item.productId}
                      item={item}
                      onMinus={() => changeQuantity(item.productId, -1)}
                      onPlus={() => changeQuantity(item.productId, 1)}
                      onRemove={() => removeItem(item.productId)}
                    />
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-3 border-t pt-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="truncate text-xl font-bold text-emerald-600">{formatCRC(total)}</p>
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    className="min-w-36 bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700"
                    disabled={isSaving}
                    onClick={() => void submitOrder()}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    {isSaving ? "Guardando" : editingOrder ? "Actualizar" : "Registrar"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Venta actual</p>
                  <p className="truncate text-sm font-semibold">Agregue productos para registrar</p>
                </div>
                <Button type="button" size="lg" className="min-w-36" disabled>
                  <ShoppingCart className="h-5 w-5" />
                  Registrar
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <div className="mx-auto grid max-w-4xl grid-cols-[1fr_5rem_1fr] items-end gap-2">
          <button
            type="button"
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition",
              activeView === "products" ? "bg-secondary text-primary" : "text-muted-foreground"
            )}
            onClick={() => setActiveView("products")}
          >
            <Package className="h-5 w-5" />
            Productos
          </button>

          <button
            type="button"
            className="mx-auto flex h-16 w-16 -translate-y-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xl shadow-emerald-500/30 transition active:scale-95"
            onClick={startNewOrder}
            aria-label="Nueva venta"
          >
            <Plus className="h-8 w-8" />
          </button>

          <button
            type="button"
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition",
              activeView === "sales" ? "bg-secondary text-primary" : "text-muted-foreground"
            )}
            onClick={() => setActiveView("sales")}
          >
            <ReceiptText className="h-5 w-5" />
            Ventas
          </button>
        </div>
      </nav>
    </main>
  );
}

function CategorySectionButton({
  category,
  count,
  onClick
}: {
  category: IncomeCategory;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-h-24 items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition active:scale-[0.98]"
      onClick={onClick}
    >
      <span className="min-w-0">
        <span className="block text-base font-bold">{category}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{count} productos</span>
      </span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
        <Package className="h-5 w-5" />
      </span>
    </button>
  );
}

function ProductResultButton({ product, quantity, onClick }: { product: Product; quantity: number; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-20 items-center justify-between gap-3 rounded-2xl border bg-card p-3 text-left shadow-sm transition active:scale-[0.98]",
        quantity > 0 && "border-emerald-500 bg-emerald-500/5"
      )}
      onClick={onClick}
    >
      <span className="min-w-0 space-y-1">
        <span className="line-clamp-2 text-sm font-bold leading-tight">{product.name}</span>
        <span className="block text-xs text-muted-foreground">{product.category}</span>
        <span className="block text-sm font-bold text-emerald-600">{formatCRC(product.defaultPrice)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {quantity > 0 ? (
          <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-emerald-600 px-2 text-xs font-bold text-white">
            {quantity}
          </span>
        ) : null}
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Plus className="h-5 w-5" />
        </span>
      </span>
    </button>
  );
}

function ProductCatalogRow({ product, className }: { product: Product; className?: string }) {
  return (
    <div className={cn("grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3", className)}>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-bold leading-tight">{product.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{product.category}</p>
      </div>
      <p className="shrink-0 text-sm font-bold text-emerald-600">{formatCRC(product.defaultPrice)}</p>
    </div>
  );
}

function SelectedItemReviewRow({
  item,
  onMinus,
  onPlus,
  onRemove
}: {
  item: DraftItem;
  onMinus: () => void;
  onPlus: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-bold leading-tight">{item.productName}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatCRC(item.unitPrice)} c/u</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onRemove} aria-label="Quitar producto">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <QuantityControl quantity={item.quantity} onMinus={onMinus} onPlus={onPlus} />
        <Badge variant="success">{formatCRC(item.subtotal)}</Badge>
      </div>
    </div>
  );
}

function QuantityControl({
  quantity,
  onMinus,
  onPlus
}: {
  quantity: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="grid h-10 grid-cols-[2.5rem_2.5rem_2.5rem] overflow-hidden rounded-full border bg-background">
      <button type="button" className="flex items-center justify-center" onClick={onMinus} aria-label="Quitar uno">
        <Minus className="h-4 w-4" />
      </button>
      <span className="flex items-center justify-center border-x text-sm font-bold">{quantity}</span>
      <button type="button" className="flex items-center justify-center" onClick={onPlus} aria-label="Agregar uno">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function asIncomeCategory(category: Product["category"]): IncomeCategory {
  return INCOME_CATEGORIES.includes(category as IncomeCategory) ? (category as IncomeCategory) : "Otros";
}

function extraProductId(extra: string) {
  return `extra:${normalizeSearch(extra).replace(/[^a-z0-9]/g, "")}`;
}

function todayDateInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function dateInputValue(value: Date | string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function toLocalDateIso(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

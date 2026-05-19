"use client";

import * as React from "react";
import { toast } from "sonner";

import { dateKey } from "@/lib/date-ranges";
import type { DashboardSummary, Expense, Order, Product, Provider, RangeKey } from "@/lib/finance-types";

type RangeState = {
  range: RangeKey;
  start?: string;
  end?: string;
};

export function useFinanceDashboard(initialRange: RangeState = { range: "today" }) {
  const [range, setRange] = React.useState<RangeState>(initialRange);
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastEntry, setLastEntry] = React.useState<Order | Expense | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ range: range.range });
    if (range.start) params.set("start", range.start);
    if (range.end) params.set("end", range.end);

    try {
      const [summaryResponse, productsResponse, providersResponse] = await Promise.all([
        fetch(`/api/finance/summary?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/providers", { cache: "no-store" })
      ]);

      if (!summaryResponse.ok) {
        throw new Error((await summaryResponse.json()).error ?? "No se pudo cargar el resumen.");
      }
      if (!productsResponse.ok) {
        throw new Error((await productsResponse.json()).error ?? "No se pudieron cargar productos.");
      }
      if (!providersResponse.ok) {
        throw new Error((await providersResponse.json()).error ?? "No se pudieron cargar proveedores.");
      }

      setSummary(await summaryResponse.json());
      setProducts(await productsResponse.json());
      setProviders(await providersResponse.json());
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Error inesperado.";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function createOrder(payload: { paymentMethod: string; items: unknown[]; note?: string; createdAt?: string }) {
    setIsMutating(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error((await response.json()).error ?? "No se pudo guardar la orden.");
      }

      const order = await response.json();
      setLastEntry(order);
      toast.success(`Orden #${order.orderNumber} guardada`);
      await load();
      return order as Order;
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "Error guardando la orden.";
      toast.error(message);
      throw mutationError;
    } finally {
      setIsMutating(false);
    }
  }

  async function updateOrder(id: string, payload: { paymentMethod: string; items: unknown[]; note?: string }) {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error((await response.json()).error ?? "No se pudo actualizar la orden.");
      }

      const order = await response.json();
      toast.success(`Orden #${order.orderNumber} actualizada`);
      await load();
      return order as Order;
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "Error actualizando la orden.";
      toast.error(message);
      throw mutationError;
    } finally {
      setIsMutating(false);
    }
  }

  async function createExpense(payload: Record<string, unknown>) {
    setIsMutating(true);
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error((await response.json()).error ?? "No se pudo guardar el gasto.");
      }

      const expense = await response.json();
      await ensureProviderFromExpense(payload);
      setLastEntry(expense);
      toast.success("Gasto guardado");
      await load();
      return expense as Expense;
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "Error guardando el gasto.";
      toast.error(message);
      throw mutationError;
    } finally {
      setIsMutating(false);
    }
  }

  async function createProduct(payload: Record<string, unknown>) {
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error((await response.json()).error ?? "No se pudo crear el producto.");
    }

    const product = (await response.json()) as Product;
    setProducts((current) => [...current, product].sort((a, b) => String(a.name).localeCompare(String(b.name))));
    toast.success("Producto agregado");
    return product;
  }

  async function createProvider(payload: Record<string, unknown>) {
    const response = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error((await response.json()).error ?? "No se pudo crear el proveedor.");
    }

    const provider = (await response.json()) as Provider;
    setProviders((current) =>
      [...current.filter((item) => item.name.toLowerCase() !== provider.name.toLowerCase()), provider].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
    return provider;
  }

  async function ensureProviderFromExpense(payload: Record<string, unknown>) {
    const vendorName = typeof payload.vendorName === "string" ? payload.vendorName.trim() : "";

    if (!vendorName) {
      return;
    }

    if (providers.some((provider) => provider.name.toLowerCase() === vendorName.toLowerCase())) {
      return;
    }

    try {
      await createProvider({ name: vendorName, active: true });
      toast.success(`Proveedor ${vendorName} agregado`);
    } catch {
      await load();
    }
  }

  async function updateProduct(id: string, payload: Record<string, unknown>) {
    const previous = products;
    setProducts((current) =>
      current.map((product) => (String(product._id) === id ? ({ ...product, ...payload } as Product) : product))
    );

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error((await response.json()).error ?? "No se pudo actualizar el producto.");
      }

      const product = (await response.json()) as Product;
      setProducts((current) =>
        current
          .map((item) => (String(item._id) === id ? product : item))
          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      );
      toast.success("Producto actualizado");
      return product;
    } catch (updateError) {
      setProducts(previous);
      const message = updateError instanceof Error ? updateError.message : "Error actualizando producto.";
      toast.error(message);
      throw updateError;
    }
  }

  async function deleteProduct(id: string) {
    const previous = products;
    setProducts((current) => current.filter((product) => String(product._id) !== id));

    try {
      const response = await fetch(`/api/products/${id}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error((await response.json()).error ?? "No se pudo eliminar el producto.");
      }

      toast.success("Producto eliminado");
    } catch (deleteError) {
      setProducts(previous);
      const message = deleteError instanceof Error ? deleteError.message : "Error eliminando producto.";
      toast.error(message);
    }
  }

  async function deleteTransaction(transaction: DashboardSummary["recentTransactions"][number]) {
    const snapshot = summary;
    if (!snapshot) return;

    setSummary({
      ...snapshot,
      recentTransactions: snapshot.recentTransactions.filter((item) => item.id !== transaction.id)
    });

    try {
      const endpoint = transaction.type === "order" ? "orders" : "expenses";
      const response = await fetch(`/api/${endpoint}/${transaction.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error((await response.json()).error ?? "No se pudo eliminar.");
      }
      toast.success("Movimiento eliminado");
      await load();
    } catch (deleteError) {
      setSummary(snapshot);
      const message = deleteError instanceof Error ? deleteError.message : "Error eliminando movimiento.";
      toast.error(message);
    }
  }

  async function saveDailyNote(note: string) {
    const todayKey = dateKey(new Date());
    const response = await fetch("/api/daily-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateKey: todayKey, note })
    });

    if (!response.ok) {
      throw new Error((await response.json()).error ?? "No se pudo guardar la nota.");
    }

    toast.success("Nota diaria guardada");
    await load();
  }

  return {
    range,
    setRange,
    summary,
    products,
    providers,
    isLoading,
    isMutating,
    error,
    lastEntry,
    reload: load,
    createOrder,
    updateOrder,
    createExpense,
    createProduct,
    createProvider,
    updateProduct,
    deleteProduct,
    deleteTransaction,
    saveDailyNote
  };
}

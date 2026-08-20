"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Download,
  FileText,
  LogOut,
  Moon,
  Package,
  RefreshCw,
  ReceiptText,
  ShoppingCart,
  Sun,
  TrendingUp,
  WalletCards
} from "lucide-react";
import { useTheme } from "next-themes";

import { ChartsPanel } from "@/components/finance/charts-panel";
import { DailyReportPanel } from "@/components/finance/daily-report";
import { DailyNote } from "@/components/finance/daily-note";
import { DashboardSkeleton } from "@/components/finance/dashboard-skeleton";
import { InsightsPanel } from "@/components/finance/insights-panel";
import { MetricCard } from "@/components/finance/metric-card";
import { ProductCatalog } from "@/components/finance/product-catalog";
import { QuickEntrySheet } from "@/components/finance/quick-entry-sheet";
import { RangeFilter } from "@/components/finance/range-filter";
import { RecentTransactions } from "@/components/finance/recent-transactions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFinanceDashboard } from "@/hooks/use-finance-dashboard";
import type { RangeKey } from "@/lib/finance-types";
import { cn, formatCRC } from "@/lib/utils";

type AdminWorkspace = "summary" | "products" | "movements" | "reports";

const adminWorkspaces: Array<{
  value: AdminWorkspace;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    value: "summary",
    label: "Resumen",
    description: "KPIs y salud del negocio",
    icon: BarChart3
  },
  {
    value: "products",
    label: "Productos",
    description: "Catalogo y precios",
    icon: Package
  },
  {
    value: "movements",
    label: "Movimientos",
    description: "Ventas y gastos recientes",
    icon: ReceiptText
  },
  {
    value: "reports",
    label: "Reportes",
    description: "Revision diaria y analisis",
    icon: FileText
  }
];

export function FinanceDashboard() {
  const { theme, setTheme } = useTheme();
  const [activeWorkspace, setActiveWorkspace] = React.useState<AdminWorkspace>("summary");
  const {
    range,
    setRange,
    summary,
    products,
    providers,
    isLoading,
    isRefreshing,
    isMutating,
    error,
    lastEntry,
    reload,
    createOrder,
    updateOrder,
    createExpense,
    createProduct,
    createProvider,
    updateProduct,
    deleteProduct,
    deleteTransaction,
    saveDailyNote
  } = useFinanceDashboard({ range: "today" });

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const periodLabel = summary ? metricPeriodLabel(summary.range.key) : "";
  const healthLabel = summary ? healthPeriodLabel(summary.range.key) : "";
  const productStats = React.useMemo(() => {
    const sellProducts = products.filter((product) => (product.kind ?? "sell") === "sell");
    const buyProducts = products.filter((product) => (product.kind ?? "sell") === "buy");
    const activeProducts = products.filter((product) => product.active);

    return [
      { label: "Activos", value: activeProducts.length },
      { label: "Vendo", value: sellProducts.length },
      { label: "Compro", value: buyProducts.length }
    ];
  }, [products]);

  return (
    <main className="min-h-screen px-4 py-4 pb-28 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="glass-surface sticky top-3 z-30 rounded-[1.5rem] border p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg shadow-sky-500/15 dark:bg-white">
                <Image
                  src="/logo1-clean.png"
                  alt="La Esquinita"
                  width={56}
                  height={56}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">La Esquinita</p>
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                  Control de Gastos e Ingresos
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button asChild variant="success" className="px-4">
                <Link href="/ventas">
                  <ShoppingCart className="h-4 w-4" />
                  Ventas
                </Link>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => void reload({ showToast: true })}
                disabled={isRefreshing}
                aria-label="Actualizar"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
              <Button asChild variant="secondary" size="icon" aria-label="Exportar Excel">
                <a href="/api/export">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Cambiar tema"
              >
                <Sun className="h-4 w-4 dark:hidden" />
                <Moon className="hidden h-4 w-4 dark:block" />
              </Button>
              <Button type="button" variant="secondary" size="icon" onClick={handleLogout} aria-label="Cerrar sesion">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <AdminWorkspaceNav active={activeWorkspace} onChange={setActiveWorkspace} />
        </header>

        {error ? (
          <Card className="border-red-500/30 bg-red-500/8">
            <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">{error}</CardContent>
          </Card>
        ) : null}

        {isLoading || !summary ? (
          <DashboardSkeleton />
        ) : (
          <>
            {activeWorkspace === "summary" ? (
              <WorkspacePanel
                title="Resumen"
                description="Indicadores principales para revisar el negocio por periodo."
                action={<RangeFilter value={range} onChange={setRange} />}
              >
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard title={`Ingresos ${periodLabel}`} value={summary.totals.income} icon={ArrowUpRight} tone="income" />
                  <MetricCard title={`Gastos ${periodLabel}`} value={summary.totals.expenses} icon={ArrowDownLeft} tone="expense" />
                  <MetricCard title={`Utilidad ${periodLabel}`} value={summary.totals.profit} icon={TrendingUp} tone="profit" />
                  <MetricCard
                    title={`Ticket promedio ${periodLabel}`}
                    value={summary.totals.averageTicket}
                    icon={WalletCards}
                    tone="profit"
                    compact
                  />
                </section>

                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]"
                >
                  <HealthStat label={`Ventas ${healthLabel}`} value={formatCRC(summary.totals.income)} />
                  <HealthStat label="Ordenes" value={String(summary.totals.orders)} />
                  <HealthStat
                    label="Margen de utilidad"
                    value={`${summary.totals.margin.toFixed(1)}%`}
                    accent={summary.totals.margin >= 20 ? "green" : summary.totals.margin >= 0 ? "yellow" : "red"}
                  />
                </motion.section>

                <ChartsPanel summary={summary} />
                <InsightsPanel summary={summary} />
              </WorkspacePanel>
            ) : null}

            {activeWorkspace === "products" ? (
              <WorkspacePanel
                title="Productos"
                description="Gestiona productos de venta, insumos de compra, precios y estado activo."
                meta={productStats}
              >
                <ProductCatalog
                  products={products}
                  onCreate={createProduct}
                  onUpdate={updateProduct}
                  onDelete={deleteProduct}
                />
              </WorkspacePanel>
            ) : null}

            {activeWorkspace === "movements" ? (
              <WorkspacePanel
                title="Movimientos recientes"
                description="Revisa, edita o elimina ventas y gastos del periodo seleccionado."
                action={<RangeFilter value={range} onChange={setRange} />}
              >
                <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <RecentTransactions
                    transactions={summary.recentTransactions}
                    onDelete={deleteTransaction}
                    onUpdateOrder={updateOrder}
                  />
                  <DailyNote key={String(summary.dailyNote?.updatedAt ?? "empty-note")} note={summary.dailyNote} onSave={saveDailyNote} />
                </section>
              </WorkspacePanel>
            ) : null}

            {activeWorkspace === "reports" ? (
              <WorkspacePanel
                title="Reportes"
                description="Reporte diario detallado y analisis visual para revisar cierres."
                meta={[
                  { label: "Ordenes", value: summary.totals.orders },
                  { label: "Movimientos", value: summary.recentTransactions.length },
                  { label: "Utilidad", value: formatCRC(summary.totals.profit) }
                ]}
              >
                <DailyReportPanel />
                <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <ChartsPanel summary={summary} />
                  <InsightsPanel summary={summary} />
                </section>
              </WorkspacePanel>
            ) : null}
          </>
        )}
      </div>

      <QuickEntrySheet
        products={products}
        providers={providers}
        isMutating={isMutating}
        lastEntry={lastEntry}
        onCreateOrder={createOrder}
        onCreateExpense={createExpense}
        onCreateProduct={createProduct}
        onCreateProvider={createProvider}
        onUpdateProduct={updateProduct}
      />
    </main>
  );
}

function AdminWorkspaceNav({
  active,
  onChange
}: {
  active: AdminWorkspace;
  onChange: (value: AdminWorkspace) => void;
}) {
  return (
    <nav className="mt-3 grid gap-2 border-t pt-3 md:grid-cols-4" aria-label="Navegacion del administrador">
      {adminWorkspaces.map((item) => {
        const Icon = item.icon;
        const selected = active === item.value;

        return (
          <button
            key={item.value}
            type="button"
            className={cn(
              "flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-2 text-left transition",
              selected
                ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-sky-500/15"
                : "bg-background/70 hover:bg-secondary"
            )}
            onClick={() => onChange(item.value)}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                selected ? "bg-white/20" : "bg-secondary text-primary"
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{item.label}</span>
              <span className={cn("mt-0.5 block truncate text-xs", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {item.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function WorkspacePanel({
  title,
  description,
  action,
  meta,
  children
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  meta?: Array<{ label: string; value: string | number }>;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-[1.25rem] border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Administrador</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>

          {action ? <div className="xl:min-w-[34rem]">{action}</div> : null}

          {meta?.length ? (
            <div className="grid grid-cols-3 gap-2 sm:min-w-96">
              {meta.map((item) => (
                <div key={item.label} className="rounded-2xl border bg-secondary/45 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 truncate text-lg font-bold">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  );
}

function metricPeriodLabel(range: RangeKey) {
  if (range === "week") return "semana";
  if (range === "month") return "mes";
  if (range === "custom") return "del rango";
  return "del dia";
}

function healthPeriodLabel(range: RangeKey) {
  if (range === "week") return "de la semana";
  if (range === "month") return "del mes";
  if (range === "custom") return "del rango";
  return "del dia";
}

function HealthStat({
  label,
  value,
  accent = "blue"
}: {
  label: string;
  value: string;
  accent?: "blue" | "green" | "yellow" | "red";
}) {
  const colors = {
    blue: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    green: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    yellow: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
    red: "bg-red-500/12 text-red-700 dark:text-red-300"
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className={`rounded-2xl p-3 ${colors[accent]}`}>
          <WalletCards className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Download,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  TrendingUp,
  WalletCards
} from "lucide-react";
import { useTheme } from "next-themes";

import { ChartsPanel } from "@/components/finance/charts-panel";
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
import { formatCRC } from "@/lib/utils";

export function FinanceDashboard() {
  const { theme, setTheme } = useTheme();
  const {
    range,
    setRange,
    summary,
    products,
    isLoading,
    isMutating,
    error,
    lastEntry,
    reload,
    createOrder,
    updateOrder,
    createExpense,
    createProduct,
    updateProduct,
    deleteProduct,
    deleteTransaction,
    saveDailyNote
  } = useFinanceDashboard({ range: "today" });

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

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
              <Button type="button" variant="secondary" size="icon" onClick={() => void reload()} aria-label="Actualizar">
                <RefreshCw className="h-4 w-4" />
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
        </header>

        <RangeFilter value={range} onChange={setRange} />

        {error ? (
          <Card className="border-red-500/30 bg-red-500/8">
            <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">{error}</CardContent>
          </Card>
        ) : null}

        {isLoading || !summary ? (
          <DashboardSkeleton />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard title="Ingresos hoy" value={summary.topCards.todayIncome} icon={ArrowUpRight} tone="income" />
              <MetricCard title="Gastos hoy" value={summary.topCards.todayExpenses} icon={ArrowDownLeft} tone="expense" />
              <MetricCard title="Utilidad hoy" value={summary.topCards.todayProfit} icon={TrendingUp} tone="profit" />
              <MetricCard
                title="Utilidad del mes"
                value={summary.topCards.monthProfit}
                icon={CalendarDays}
                tone="profit"
                compact
              />
            </section>

            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]"
            >
              <HealthStat label="Ventas del rango" value={formatCRC(summary.totals.income)} />
              <HealthStat label="Ordenes" value={String(summary.totals.orders)} />
              <HealthStat
                label="Margen de utilidad"
                value={`${summary.totals.margin.toFixed(1)}%`}
                accent={summary.totals.margin >= 20 ? "green" : summary.totals.margin >= 0 ? "yellow" : "red"}
              />
            </motion.section>

            <ChartsPanel summary={summary} />
            <InsightsPanel summary={summary} />
         

            <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <RecentTransactions
                transactions={summary.recentTransactions}
                onDelete={deleteTransaction}
                onUpdateOrder={updateOrder}
              />
              <DailyNote key={String(summary.dailyNote?.updatedAt ?? "empty-note")} note={summary.dailyNote} onSave={saveDailyNote} />
            </section>
               <ProductCatalog
              products={products}
              onCreate={createProduct}
              onUpdate={updateProduct}
              onDelete={deleteProduct}
            />
          </>
        )}
      </div>

      <QuickEntrySheet
        products={products}
        isMutating={isMutating}
        lastEntry={lastEntry}
        onCreateOrder={createOrder}
        onCreateExpense={createExpense}
        onCreateProduct={createProduct}
        onUpdateProduct={updateProduct}
      />
    </main>
  );
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

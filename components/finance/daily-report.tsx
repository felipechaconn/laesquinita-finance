"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  FileText,
  PackageSearch,
  Save,
  ReceiptText,
  SearchX,
  WalletCards
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  type DailyReport,
  type DailyReportRow,
  type Expense,
  type ExpenseCategory,
  type Order,
  type PaymentMethod,
  type Provider,
  type ReportType
} from "@/lib/finance-types";
import { dateKey } from "@/lib/date-ranges";
import { cn, formatCRC } from "@/lib/utils";

const reportFilters: Array<{ value: ReportType; label: string }> = [
  { value: "all", label: "Todo" },
  { value: "orders", label: "Ventas" },
  { value: "expenses", label: "Gastos" }
];

export function DailyReportPanel() {
  const [date, setDate] = React.useState(todayDateInputValue);
  const [type, setType] = React.useState<ReportType>("all");
  const [report, setReport] = React.useState<DailyReport | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedRow, setSelectedRow] = React.useState<DailyReportRow | null>(null);

  const loadReport = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ date, type });
      const response = await fetch(`/api/reports/daily?${params.toString()}`, {
        signal
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "No se pudo cargar el reporte.");
      }

      setReport((await response.json()) as DailyReport);
    } catch (loadError) {
      if (signal?.aborted) return;
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el reporte.");
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [date, type]);

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadReport(controller.signal));

    return () => controller.abort();
  }, [loadReport]);

  const rows = React.useMemo(
    () => [...(report?.rows ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [report?.rows]
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b bg-muted/20">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Reporte diario
            </CardTitle>
            <CardDescription>Ventas y gastos del dia, listos para revisar sin abrir hojas de calculo.</CardDescription>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                max={todayDateInputValue()}
                onChange={(event) => setDate(event.target.value)}
                className="h-11 min-w-[11rem] pl-9"
                aria-label="Fecha del reporte"
              />
            </div>

            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1">
              {reportFilters.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  variant={type === filter.value ? "default" : "ghost"}
                  className="h-9 rounded-xl px-3 text-xs sm:text-sm"
                  onClick={() => setType(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/8 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <ReportSkeleton />
        ) : report ? (
          <ReportContent report={report} rows={rows} onSelectRow={setSelectedRow} />
        ) : null}
      </CardContent>

      <ReportEditSheet
        row={selectedRow}
        onOpenChange={(open) => !open && setSelectedRow(null)}
        onSaved={async () => {
          setSelectedRow(null);
          await loadReport();
        }}
      />
    </Card>
  );
}

function ReportContent({
  report,
  rows,
  onSelectRow
}: {
  report: DailyReport;
  rows: DailyReportRow[];
  onSelectRow: (row: DailyReportRow) => void;
}) {
  const profitTone =
    report.totals.profit > 0 ? "text-emerald-600" : report.totals.profit < 0 ? "text-red-600" : "text-yellow-600";

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ReportMetric label="Ventas" value={formatCRC(report.totals.income)} tone="income" icon={ArrowUpRight} />
        <ReportMetric label="Gastos" value={formatCRC(report.totals.expenses)} tone="expense" icon={ArrowDownLeft} />
        <ReportMetric label="Utilidad" value={formatCRC(report.totals.profit)} valueClassName={profitTone} icon={WalletCards} />
        <ReportMetric
          label="Ordenes / ticket"
          value={`${report.totals.orders} / ${formatCRC(report.totals.averageTicket)}`}
          icon={ReceiptText}
        />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{report.totals.unitsSold} unidades vendidas</Badge>
        <Badge variant="secondary">{report.totals.expenseCount} gastos registrados</Badge>
        <Badge variant={report.totals.profit >= 0 ? "success" : "destructive"}>
          {report.totals.profit >= 0 ? "Dia rentable" : "Dia en perdida"}
        </Badge>
      </div>

      {rows.length ? (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <ReportRow key={`${row.type}-${row.id}`} row={row} index={index} onSelect={onSelectRow} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
          <SearchX className="h-9 w-9 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">No hay movimientos para este filtro.</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Cambia la fecha o selecciona otro tipo de movimiento para revisar el dia.
          </p>
        </div>
      )}
    </>
  );
}

function ReportMetric({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  valueClassName
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone?: "income" | "expense" | "neutral";
  valueClassName?: string;
}) {
  const tones = {
    income: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    expense: "bg-red-500/12 text-red-700 dark:text-red-300",
    neutral: "bg-primary/10 text-primary"
  };

  return (
    <div className="rounded-2xl border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn("rounded-xl p-2", tones[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={cn("mt-3 truncate text-lg font-bold tracking-tight sm:text-xl", valueClassName)}>{value}</p>
    </div>
  );
}

function ReportRow({
  row,
  index,
  onSelect
}: {
  row: DailyReportRow;
  index: number;
  onSelect: (row: DailyReportRow) => void;
}) {
  const isOrder = row.type === "order";

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.18) }}
      className="grid w-full gap-3 rounded-2xl border bg-background p-3 text-left transition hover:bg-secondary/60 focus:outline-none focus:ring-2 focus:ring-ring sm:grid-cols-[auto_1fr_auto] sm:items-center"
      onClick={() => onSelect(row)}
    >
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", isOrder ? "bg-emerald-500/12" : "bg-red-500/12")}>
        {isOrder ? (
          <ArrowUpRight className="h-5 w-5 text-emerald-600" />
        ) : (
          <ArrowDownLeft className="h-5 w-5 text-red-600" />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{row.title}</p>
          <Badge variant={isOrder ? "success" : "destructive"}>{isOrder ? "Venta" : "Gasto"}</Badge>
          <Badge variant="secondary">{row.paymentMethod}</Badge>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{row.details}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{formatReportDate(row.date)}</span>
          <span>{row.category}</span>
          {row.quantity ? <span>{row.quantity} unidades</span> : null}
          {row.reference ? <span>Recibo {row.reference}</span> : null}
          {row.note ? <span>Nota: {row.note}</span> : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
        <PackageSearch className="h-4 w-4 text-muted-foreground sm:hidden" />
        <p className={cn("text-lg font-bold", isOrder ? "text-emerald-600" : "text-red-600")}>{formatCRC(row.amount)}</p>
      </div>
    </motion.button>
  );
}

function ReportEditSheet({
  row,
  onOpenChange,
  onSaved
}: {
  row: DailyReportRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent>
        {row ? (
          <ReportEditForm key={`${row.type}-${row.id}`} row={row} onSaved={onSaved} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ReportEditForm({ row, onSaved }: { row: DailyReportRow; onSaved: () => Promise<void> }) {
  const isOrder = row.type === "order";
  const [order, setOrder] = React.useState<Order | null>(null);
  const [expense, setExpense] = React.useState<Expense | null>(null);
  const [selectedDate, setSelectedDate] = React.useState(dateKey(new Date(row.date)));
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(row.paymentMethod);
  const [note, setNote] = React.useState(row.note ?? "");
  const [amount, setAmount] = React.useState(String(Math.abs(row.amount)));
  const [category, setCategory] = React.useState<ExpenseCategory>(EXPENSE_CATEGORIES[0]);
  const [receiptNumber, setReceiptNumber] = React.useState(row.reference ?? "");
  const [vendorName, setVendorName] = React.useState("");
  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadTransaction() {
      setIsLoading(true);
      setError(null);

      try {
        const endpoint = isOrder ? `/api/orders/${row.id}` : `/api/expenses/${row.id}`;
        const response = await fetch(endpoint, { signal: controller.signal });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "No se pudo cargar el movimiento.");
        }

        if (isOrder) {
          const payload = (await response.json()) as Order;
          setOrder(payload);
          setSelectedDate(dateKey(new Date(payload.createdAt)));
          setPaymentMethod(payload.paymentMethod);
          setNote(payload.note ?? "");
        } else {
          const [payload, providerRows] = await Promise.all([
            response.json() as Promise<Expense>,
            fetch("/api/providers", { signal: controller.signal })
              .then((providerResponse) => (providerResponse.ok ? providerResponse.json() as Promise<Provider[]> : []))
          ]);
          setExpense(payload);
          setProviders(providerRows);
          setSelectedDate(dateKey(new Date(payload.createdAt)));
          setPaymentMethod(payload.paymentMethod);
          setAmount(String(payload.amount));
          setCategory(payload.category);
          setReceiptNumber(payload.receiptNumber ?? "");
          setVendorName(payload.vendorName ?? "");
          setNote(payload.note ?? "");
        }
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el movimiento.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadTransaction();

    return () => controller.abort();
  }, [isOrder, row.id]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(isOrder ? `/api/orders/${row.id}` : `/api/expenses/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isOrder
            ? {
                paymentMethod,
                items: order?.items ?? [],
                note,
                createdAt: dateToCostaRicaNoonIso(selectedDate)
              }
            : {
                amount: Number(amount),
                category,
                productId: expense?.productId ?? "",
                productName: expense?.productName ?? "",
                paymentMethod,
                receiptNumber,
                vendorName,
                note,
                createdAt: dateToCostaRicaNoonIso(selectedDate)
              }
        )
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "No se pudo guardar el cambio.");
      }

      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el cambio.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveProviderOption(name: string) {
    const trimmed = name.trim();

    if (!trimmed || providers.some((provider) => provider.name.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    const response = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, active: true })
    });

    if (response.ok) {
      const provider = (await response.json()) as Provider;
      setProviders((current) =>
        [...current.filter((item) => item.name.toLowerCase() !== provider.name.toLowerCase()), provider].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
    }
  }

  const total = isOrder ? order?.totalAmount ?? Math.abs(row.amount) : Number(amount || 0);

  return (
    <>
      <SheetHeader>
        <SheetTitle>{isOrder ? row.title : "Editar gasto"}</SheetTitle>
        <SheetDescription>Corrige fecha y detalles basicos del movimiento.</SheetDescription>
      </SheetHeader>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSave}>
          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/8 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <div className={cn("rounded-2xl p-4", isOrder ? "bg-emerald-500/10" : "bg-red-500/10")}>
            <p className="text-xs text-muted-foreground">{isOrder ? "Total venta" : "Total gasto"}</p>
            <p className={cn("mt-1 text-3xl font-bold", isOrder ? "text-emerald-600" : "text-red-600")}>
              {formatCRC(total)}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input type="date" value={selectedDate} max={todayDateInputValue()} onChange={(event) => setSelectedDate(event.target.value)} />
          </div>

          <PaymentPicker value={paymentMethod} onChange={setPaymentMethod} />

          {!isOrder ? (
            <>
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" pattern="[0-9]*" />
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input value={receiptNumber} onChange={(event) => setReceiptNumber(event.target.value)} placeholder="Factura o recibo" />
                <ProviderPicker
                  value={vendorName}
                  providers={providers}
                  onChange={setVendorName}
                  onCommit={saveProviderOption}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2 rounded-2xl border bg-muted/30 p-3">
              <Label>Productos</Label>
              {(order?.items ?? []).map((item) => (
                <div key={item.productId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{item.quantity}x {item.productName}</span>
                  <span className="font-semibold">{formatCRC(item.subtotal)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Nota</Label>
            <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota opcional" />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isSaving || (isOrder && !order) || (!isOrder && !Number(amount))}>
            <Save className="h-4 w-4" />
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>
      )}
    </>
  );
}

function ProviderPicker({
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

  return (
    <div className="space-y-1">
      <Input
        value={value}
        list={listId}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => void onCommit(value).catch(() => undefined)}
        placeholder="Proveedor opcional"
      />
      <datalist id={listId}>
        {activeProviders.map((provider) => (
          <option key={String(provider._id ?? provider.name)} value={provider.name} />
        ))}
      </datalist>
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
            className="h-11"
            onClick={() => onChange(method)}
          >
            {method}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-24" />
      ))}
    </div>
  );
}

function todayDateInputValue() {
  return dateKey(new Date());
}

function dateToCostaRicaNoonIso(date: string) {
  return new Date(`${date}T12:00:00-06:00`).toISOString();
}

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    dateStyle: "medium"
  }).format(new Date(value));
}

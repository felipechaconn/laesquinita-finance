"use client";

import * as React from "react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "@/lib/finance-types";
import { formatCompactCRC, formatCRC } from "@/lib/utils";

const pieColors = ["#0284c7", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316"];

type ChartsPanelProps = {
  summary: DashboardSummary;
};

export function ChartsPanel({ summary }: ChartsPanelProps) {
  const hasSeries = summary.series.some((item) => item.income > 0 || item.expenses > 0);
  const hasExpenses = summary.expenseCategories.length > 0;

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Ingresos vs gastos</CardTitle>
          <CardDescription>Movimiento diario para entender la salud del negocio.</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <ChartFrame>
            {({ width, height }) =>
              hasSeries ? (
                <LineChart width={width} height={height} data={summary.series} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.12} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={formatCompactCRC} />
                  <Tooltip formatter={(value) => formatCRC(Number(value))} />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Ingresos"
                    stroke="#16a34a"
                    strokeWidth={3}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    name="Gastos"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              ) : (
                <EmptyChart title="Aun no hay ventas o gastos en este rango." />
              )
            }
          </ChartFrame>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Gastos por categoria</CardTitle>
          <CardDescription>Detecta rapido que esta pesando mas.</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <ChartFrame>
            {({ width, height }) =>
              hasExpenses ? (
                <PieChart width={width} height={height}>
                  <Pie
                    data={summary.expenseCategories}
                    dataKey="amount"
                    nameKey="category"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {summary.expenseCategories.map((entry, index) => (
                      <Cell key={entry.category} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCRC(Number(value))} />
                </PieChart>
              ) : (
                <EmptyChart title="Sin gastos registrados." />
              )
            }
          </ChartFrame>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {summary.expenseCategories.slice(0, 4).map((item, index) => (
              <div key={item.category} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pieColors[index] }} />
                <span className="truncate">{item.category}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden xl:col-span-2">
        <CardHeader>
          <CardTitle>Utilidad semanal</CardTitle>
          <CardDescription>Vista rapida de rentabilidad por semana.</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <ChartFrame className="h-64 min-h-64">
            {({ width, height }) =>
              summary.weeklyProfit.length ? (
                <BarChart width={width} height={height} data={summary.weeklyProfit} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.12} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={formatCompactCRC} />
                  <Tooltip formatter={(value) => formatCRC(Number(value))} />
                  <Bar dataKey="profit" name="Utilidad" radius={[10, 10, 4, 4]} fill="#0284c7" />
                </BarChart>
              ) : (
                <EmptyChart title="La utilidad semanal aparecera al registrar movimientos." />
              )
            }
          </ChartFrame>
        </CardContent>
      </Card>
    </div>
  );
}

function ChartFrame({
  children,
  className = "h-72 min-h-72"
}: {
  children: ReactNode | ((size: { width: number; height: number }) => ReactNode);
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);

      if (width > 0 && height > 0) {
        setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const ready = size.width > 0 && size.height > 0;

  return (
    <div ref={ref} className={`w-full min-w-0 overflow-hidden ${className}`}>
      {ready ? (typeof children === "function" ? children(size) : children) : <div className="h-full w-full" />}
    </div>
  );
}

function EmptyChart({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      {title}
    </div>
  );
}

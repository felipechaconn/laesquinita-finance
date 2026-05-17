"use client";

import { Lightbulb, Receipt, ShoppingBag, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "@/lib/finance-types";
import { formatCRC } from "@/lib/utils";

type InsightsPanelProps = {
  summary: DashboardSummary;
};

export function InsightsPanel({ summary }: InsightsPanelProps) {
  const topPayment = summary.paymentMethods[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Insights
          </CardTitle>
          <CardDescription>Lectura simple, sin contabilidad pesada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary.insights.map((insight) => (
            <div key={insight} className="rounded-2xl bg-secondary p-3 text-sm">
              {insight}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-emerald-600" />
            Productos top
          </CardTitle>
          <CardDescription>Lo que mas esta vendiendo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary.topProducts.length ? (
            summary.topProducts.map((product) => (
              <div key={product.productName} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{product.productName}</p>
                  <p className="text-xs text-muted-foreground">{product.quantity} unidades</p>
                </div>
                <Badge variant="success">{formatCRC(product.revenue)}</Badge>
              </div>
            ))
          ) : (
            <EmptyLine text="Aun no hay productos vendidos." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-sky-600" />
            Pagos y ticket
          </CardTitle>
          <CardDescription>Como esta pagando la gente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-xs text-muted-foreground">Ticket promedio</p>
            <p className="mt-1 text-2xl font-bold">{formatCRC(summary.totals.averageTicket)}</p>
          </div>
          {topPayment ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{topPayment.paymentMethod}</span>
              </div>
              <Badge>{topPayment.count} ordenes</Badge>
            </div>
          ) : (
            <EmptyLine text="Sin pagos registrados." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">{text}</div>;
}

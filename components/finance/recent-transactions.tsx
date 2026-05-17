"use client";

import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "@/lib/finance-types";
import { formatCRC, formatDateTime } from "@/lib/utils";

type RecentTransactionsProps = {
  transactions: DashboardSummary["recentTransactions"];
  onDelete: (transaction: DashboardSummary["recentTransactions"][number]) => void;
};

export function RecentTransactions({ transactions, onDelete }: RecentTransactionsProps) {
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
              <div className={transaction.amount >= 0 ? "rounded-2xl bg-emerald-500/12 p-3" : "rounded-2xl bg-red-500/12 p-3"}>
                {transaction.amount >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                ) : (
                  <ArrowDownLeft className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{transaction.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {transaction.subtitle} · {formatDateTime(transaction.createdAt)}
                </p>
              </div>
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
    </Card>
  );
}

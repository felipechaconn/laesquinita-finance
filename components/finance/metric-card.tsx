"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCompactCRC, formatCRC } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  value: number;
  icon: LucideIcon;
  tone?: "income" | "expense" | "profit" | "warning";
  compact?: boolean;
  detail?: string;
};

const toneStyles = {
  income: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  expense: "bg-red-500/12 text-red-700 dark:text-red-300",
  profit: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  warning: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
};

export function MetricCard({ title, value, icon: Icon, tone = "profit", compact, detail }: MetricCardProps) {
  const losing = tone === "profit" && value < 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p
                className={cn(
                  "mt-2 truncate text-2xl font-bold tracking-tight sm:text-3xl",
                  losing && "text-red-600 dark:text-red-300"
                )}
              >
                {compact ? formatCompactCRC(value) : formatCRC(value)}
              </p>
              {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
            </div>
            <div className={cn("rounded-2xl p-3", losing ? toneStyles.expense : toneStyles[tone])}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

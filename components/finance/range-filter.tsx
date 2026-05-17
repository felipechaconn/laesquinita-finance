"use client";

import type { RangeKey } from "@/lib/finance-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RangeFilterProps = {
  value: { range: RangeKey; start?: string; end?: string };
  onChange: (value: { range: RangeKey; start?: string; end?: string }) => void;
};

const options: Array<{ label: string; value: RangeKey }> = [
  { label: "Hoy", value: "today" },
  { label: "Semana", value: "week" },
  { label: "Mes", value: "month" },
  { label: "Rango", value: "custom" }
];

export function RangeFilter({ value, onChange }: RangeFilterProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid grid-cols-4 rounded-2xl bg-secondary p-1">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-10 rounded-xl px-2 text-xs sm:text-sm",
              value.range === option.value && "bg-card shadow-sm hover:bg-card"
            )}
            onClick={() => onChange({ ...value, range: option.value })}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {value.range === "custom" ? (
        <div className="grid grid-cols-2 gap-2 sm:w-80">
          <Input
            type="date"
            value={value.start ?? ""}
            onChange={(event) => onChange({ ...value, start: event.target.value })}
            className="h-10 rounded-xl text-sm"
          />
          <Input
            type="date"
            value={value.end ?? ""}
            onChange={(event) => onChange({ ...value, end: event.target.value })}
            className="h-10 rounded-xl text-sm"
          />
        </div>
      ) : null}
    </div>
  );
}

import type { RangeKey } from "@/lib/finance-types";

export function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function startOfWeek(date = new Date()) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getRange(range: RangeKey, start?: string | null, end?: string | null) {
  const now = new Date();

  if (range === "custom" && start && end) {
    return {
      start: startOfDay(new Date(`${start}T00:00:00`)),
      end: endOfDay(new Date(`${end}T00:00:00`))
    };
  }

  if (range === "week") {
    return { start: startOfWeek(now), end: endOfDay(now) };
  }

  if (range === "month") {
    return { start: startOfMonth(now), end: endOfDay(now) };
  }

  return { start: startOfDay(now), end: endOfDay(now) };
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

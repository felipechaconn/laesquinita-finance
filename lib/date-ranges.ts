import type { RangeKey } from "@/lib/finance-types";

const COSTA_RICA_UTC_OFFSET_HOURS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date | string = new Date()) {
  const key = typeof date === "string" ? date : dateKey(date);
  return dateKeyToUtcBoundary(key, "start");
}

export function endOfDay(date: Date | string = new Date()) {
  const key = typeof date === "string" ? date : dateKey(date);
  return dateKeyToUtcBoundary(key, "end");
}

export function startOfWeek(date: Date | string = new Date()) {
  const key = typeof date === "string" ? date : dateKey(date);
  const [year, month, day] = parseDateKey(key);
  const plainDate = new Date(Date.UTC(year, month - 1, day));
  const weekDay = plainDate.getUTCDay();
  const diff = weekDay === 0 ? -6 : 1 - weekDay;
  return startOfDay(addDaysToDateKey(key, diff));
}

export function startOfMonth(date: Date | string = new Date()) {
  const key = typeof date === "string" ? date : dateKey(date);
  const [year, month] = parseDateKey(key);
  return startOfDay(formatDateKey(year, month, 1));
}

export function getRange(range: RangeKey, start?: string | null, end?: string | null) {
  const now = new Date();

  if (range === "custom" && start && end) {
    return {
      start: startOfDay(start),
      end: endOfDay(end)
    };
  }

  if (range === "week") {
    const weekStart = startOfSelectedWeek(start, now);
    return { start: weekStart, end: endOfDay(addDays(weekStart, 6)) };
  }

  if (range === "month") {
    const monthStart = startOfSelectedMonth(start, now);
    return { start: monthStart, end: endOfMonth(monthStart) };
  }

  const day = isDateKey(start) ? start : now;
  return { start: startOfDay(day), end: endOfDay(day) };
}

export function dateKey(date: Date) {
  const costaRicaDate = new Date(date.getTime() - COSTA_RICA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return costaRicaDate.toISOString().slice(0, 10);
}

export function addDaysToDateKey(key: string, days: number) {
  const [year, month, day] = parseDateKey(key);
  const date = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return formatDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function htmlWeekValue(date: Date | string = new Date()) {
  const start = startOfWeek(date);
  const [year] = parseDateKey(dateKey(start));
  const yearStart = startOfWeek(formatDateKey(year, 1, 4));
  const week = Math.floor((start.getTime() - yearStart.getTime()) / (7 * DAY_MS)) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function htmlMonthValue(date: Date | string = new Date()) {
  return dateKey(startOfMonth(date)).slice(0, 7);
}

export function selectedRangeStartValue(range: RangeKey, start?: string | null) {
  if (range === "week" && /^\d{4}-W\d{2}$/.test(start ?? "")) return start ?? "";
  if (range === "month" && /^\d{4}-\d{2}$/.test(start ?? "")) return start ?? "";
  if (range === "week") return htmlWeekValue(start ?? new Date());
  if (range === "month") return htmlMonthValue(start ?? new Date());
  return isDateKey(start) ? start : dateKey(new Date());
}

function dateKeyToUtcBoundary(key: string, boundary: "start" | "end") {
  const [year, month, day] = parseDateKey(key);
  const hour = boundary === "start" ? COSTA_RICA_UTC_OFFSET_HOURS : COSTA_RICA_UTC_OFFSET_HOURS + 23;
  const minute = boundary === "start" ? 0 : 59;
  const second = boundary === "start" ? 0 : 59;
  const millisecond = boundary === "start" ? 0 : 999;

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
}

function parseDateKey(key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);

  if (!match) {
    return parseDateKey(dateKey(new Date()));
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])] as const;
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function startOfSelectedWeek(value: string | null | undefined, fallback: Date) {
  const htmlWeekMatch = /^(\d{4})-W(\d{2})$/.exec(value ?? "");

  if (htmlWeekMatch) {
    const year = Number(htmlWeekMatch[1]);
    const week = Number(htmlWeekMatch[2]);
    const firstWeekStart = startOfWeek(formatDateKey(year, 1, 4));
    return startOfDay(addDays(firstWeekStart, (week - 1) * 7));
  }

  return startOfWeek(isDateKey(value) ? value : fallback);
}

function startOfSelectedMonth(value: string | null | undefined, fallback: Date) {
  const htmlMonthMatch = /^(\d{4})-(\d{2})$/.exec(value ?? "");

  if (htmlMonthMatch) {
    return startOfDay(formatDateKey(Number(htmlMonthMatch[1]), Number(htmlMonthMatch[2]), 1));
  }

  return startOfMonth(isDateKey(value) ? value : fallback);
}

function endOfMonth(date: Date) {
  const [year, month] = parseDateKey(dateKey(date));
  const nextMonth = month === 12 ? formatDateKey(year + 1, 1, 1) : formatDateKey(year, month + 1, 1);
  return endOfDay(addDays(startOfDay(nextMonth), -1));
}

function isDateKey(value: string | null | undefined): value is string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

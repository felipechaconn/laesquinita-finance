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
    return { start: startOfWeek(now), end: endOfDay(now) };
  }

  if (range === "month") {
    return { start: startOfMonth(now), end: endOfDay(now) };
  }

  return { start: startOfDay(now), end: endOfDay(now) };
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

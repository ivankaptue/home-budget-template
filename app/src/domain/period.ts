import type { Expense, Scope } from "./types";

export const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;
export const MONTH_SHORT = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"] as const;

export const pad2 = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTH_SHORT[m - 1]}`;
}

export function checkId(scope: Scope, period: string, itemId: string): string {
  return scope === "annual" ? `chk_${period}_A_${itemId}` : `chk_${period}_${itemId}`;
}

export function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return `${ym}-${pad2(new Date(y, m, 0).getDate())}`;
}

export function defaultDate(scope: Scope, period: string, today: string): string {
  if (scope === "annual") return today.startsWith(period) ? today : `${period}-01-01`;
  return today.startsWith(period) ? today : `${period}-01`;
}

export function trackedMonths(expenses: Expense[], year: number, today: string): string[] {
  const months = expenses
    .filter((e) => e.scope === "monthly" && e.year === year)
    .map((e) => Number(e.month.slice(5, 7)))
    .sort((a, b) => a - b);
  if (months.length === 0) return [];
  const first = months[0]!;
  const lastData = months[months.length - 1]!;
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7));
  const bound = year < todayYear ? 12 : year === todayYear ? todayMonth : lastData;
  const last = Math.max(bound, lastData);
  const out: string[] = [];
  for (let m = first; m <= last; m++) out.push(`${year}-${pad2(m)}`);
  return out;
}

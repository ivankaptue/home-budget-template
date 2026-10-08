import { computed, signal } from "@preact/signals";
import { shiftMonth, toISODate } from "../domain/period";
import type { Expense, Scope } from "../domain/types";

export type Tab = "month" | "annual" | "report";
export type SheetState = { mode: "add"; scope: Scope; item?: string } | { mode: "edit"; expense: Expense } | null;
export type ThemeChoice = "auto" | "light" | "dark";

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode: keep in memory only */ }
}

export const today = signal(toISODate(new Date()));
export const tab = signal<Tab>("month");
export const ym = signal(today.value.slice(0, 7));
export const year = signal(Number(today.value.slice(0, 4)));
export const openRows = signal<ReadonlySet<string>>(new Set());
export const sheet = signal<SheetState>(null);
export const theme = signal<ThemeChoice>(readStored("carnet-theme", ["auto", "light", "dark"] as const, "auto"));

export type Ledger = "expenses" | "chequing";
/** Display preference only (per device); the ticks themselves live in Firestore. */
export const ledger = signal<Ledger>(readStored("carnet-ledger", ["expenses", "chequing"] as const, "expenses"));

/** Privacy screen (per device): every amount shown as a mask, e.g. when showing the app to friends. */
export const hideAmounts = signal(readStored("carnet-hide-amounts", ["0", "1"] as const, "0") === "1");

export function toggleHideAmounts() {
  hideAmounts.value = !hideAmounts.value;
  store("carnet-hide-amounts", hideAmounts.value ? "1" : "0");
}

export function selectLedger(l: Ledger) {
  ledger.value = l;
  store("carnet-ledger", l);
}

function readStoredEnvelope(): string {
  try {
    return localStorage.getItem("carnet-envelope") ?? "";
  } catch {
    return ""; // MonthView falls back to the first envelope
  }
}
export const envelope = signal<string>(readStoredEnvelope());

export function selectEnvelope(id: string) {
  envelope.value = id;
  store("carnet-envelope", id);
}

/** Year whose expenses must be loaded for the current view. */
export const activeYear = computed(() => (tab.value === "month" ? Number(ym.value.slice(0, 4)) : year.value));

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "auto") delete root.dataset.theme;
  else root.dataset.theme = choice;
  const meta = document.querySelector('meta[name="theme-color"]');
  const dark = choice === "dark" || (choice === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  meta?.setAttribute("content", dark ? "#0F1512" : "#1E6B52");
}

export function cycleTheme() {
  const next: ThemeChoice = theme.value === "auto" ? "light" : theme.value === "light" ? "dark" : "auto";
  theme.value = next;
  store("carnet-theme", next);
  applyTheme(next);
}

export function toggleRow(key: string) {
  const next = new Set(openRows.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  openRows.value = next;
}

export function openRow(key: string) {
  if (!openRows.value.has(key)) openRows.value = new Set(openRows.value).add(key);
}

export function navigate(delta: number) {
  if (tab.value === "month") {
    ym.value = shiftMonth(ym.value, delta);
    year.value = Number(ym.value.slice(0, 4));
  } else {
    year.value += delta;
  }
}

export function selectTab(t: Tab) {
  tab.value = t;
  if (t === "month" && Number(ym.value.slice(0, 4)) !== year.value) {
    ym.value = year.value === Number(today.value.slice(0, 4)) ? today.value.slice(0, 7) : `${year.value}-01`;
  }
}

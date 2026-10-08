import type { Cents } from "./types";

/** Firestore rules cap an expense amount at this many cents ($1 000 000). */
export const MAX_AMOUNT: Cents = 100_000_000;

const whole = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const withCents = new Intl.NumberFormat("fr-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "84,50", "1 234,56", "12 $" -> cents. Returns null for anything ambiguous or negative. */
export function parseAmount(input: string): Cents | null {
  const cleaned = input.replace(/[\s  $]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [int = "0", dec = ""] = cleaned.split(".");
  return Number(int) * 100 + Number(dec.padEnd(2, "0"));
}

export function formatMoney(cents: Cents): string {
  return cents % 100 === 0 ? whole.format(cents / 100) : withCents.format(cents / 100);
}

/** Text for an editable amount field: "84,50", or "2500" for whole dollars. */
export function centsToInput(cents: Cents): string {
  const int = Math.trunc(cents / 100);
  const dec = cents % 100;
  return dec === 0 ? String(int) : `${int},${String(dec).padStart(2, "0")}`;
}

import type { Budget, Expense, ExpenseInput, Outflow, Scope } from "../domain/types";

export function expenseFields(input: ExpenseInput): ExpenseInput & { month: string; year: number } {
  return { ...input, month: input.date.slice(0, 7), year: Number(input.date.slice(0, 4)) };
}

export function expenseFromDoc(id: string, d: Record<string, unknown>): Expense | null {
  const ok =
    (d.kind === "expense" || d.kind === "check") &&
    (d.scope === "monthly" || d.scope === "annual") &&
    typeof d.item === "string" &&
    Number.isInteger(d.amount) &&
    typeof d.note === "string" &&
    typeof d.date === "string" &&
    typeof d.month === "string" &&
    typeof d.year === "number" &&
    typeof d.by === "string";
  if (!ok) return null;
  return {
    id,
    kind: d.kind as Expense["kind"],
    scope: d.scope as Expense["scope"],
    item: d.item as string,
    amount: d.amount as number,
    note: d.note as string,
    date: d.date as string,
    month: d.month as string,
    year: d.year as number,
    by: d.by as string,
  };
}

export function budgetFromDoc(d: Record<string, unknown>): Budget | null {
  if (typeof d.effectiveFrom !== "string" || !/^\d{4}-\d{2}$/.test(d.effectiveFrom)) return null;
  if (!Array.isArray(d.envelopes) || !Array.isArray(d.annualItems)) return null;
  return d as unknown as Budget;
}

export function outflowFields(scope: Scope, period: string, item: string): { scope: Scope; item: string; period: string; year: number } {
  return { scope, item, period, year: Number(period.slice(0, 4)) };
}

export function outflowFromDoc(id: string, d: Record<string, unknown>): Outflow | null {
  const ok =
    (d.scope === "monthly" || d.scope === "annual") &&
    typeof d.item === "string" &&
    typeof d.period === "string" &&
    typeof d.year === "number" &&
    typeof d.by === "string";
  if (!ok) return null;
  return {
    id,
    scope: d.scope as Outflow["scope"],
    item: d.item as string,
    period: d.period as string,
    year: d.year as number,
    by: d.by as string,
  };
}

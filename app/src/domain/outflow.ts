import type { Cents, Item, Outflow, Scope } from "./types";

export interface OutflowLine {
  item: Item;
  amount: Cents;
}

export interface OutflowSummary {
  out: Cents;
  total: Cents;
  left: Cents;
}

export function outflowId(scope: Scope, period: string, itemId: string): string {
  return scope === "annual" ? `out_${period}_A_${itemId}` : `out_${period}_${itemId}`;
}

/** Items that can be ticked as moved out of the chequing account, with their OWN budget (never the effective one:
 *  a transfer source like Courses is ticked in its own envelope). Archived and budgetless items are excluded. */
export function outflowLines(items: Item[]): OutflowLine[] {
  return items
    .filter((p) => !p.archived && p.budget !== null && p.budget > 0)
    .map((p) => ({ item: p, amount: p.budget as Cents }));
}

export function tickedItems(outflows: Outflow[], scope: Scope, period: string): Set<string> {
  return new Set(outflows.filter((o) => o.scope === scope && o.period === period).map((o) => o.item));
}

/** Ticks on items absent from `lines` (archived, removed, budgetless) are ignored. */
export function outflowSummary(lines: OutflowLine[], outflows: Outflow[], scope: Scope, period: string): OutflowSummary {
  const ticked = tickedItems(outflows, scope, period);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const out = lines.filter((l) => ticked.has(l.item.id)).reduce((s, l) => s + l.amount, 0);
  return { out, total, left: total - out };
}

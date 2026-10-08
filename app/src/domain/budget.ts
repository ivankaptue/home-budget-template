import type { Budget, Category, Cents, Envelope, Item } from "./types";

export function budgetFor(budgets: Budget[], ym: string): Budget | null {
  let best: Budget | null = null;
  for (const b of budgets) {
    if (b.effectiveFrom <= ym && (!best || b.effectiveFrom > best.effectiveFrom)) best = b;
  }
  return best;
}

export function annualBudgetFor(budgets: Budget[], year: number): Budget | null {
  return budgetFor(budgets, `${year}-12`);
}

export function monthlyItems(b: Budget): Item[] {
  return b.envelopes.flatMap((e) => e.categories.flatMap((c) => c.items));
}

export function findItem(b: Budget, id: string): Item | undefined {
  return monthlyItems(b).find((p) => p.id === id);
}

export function envelopeOfItem(b: Budget, id: string): Envelope | undefined {
  return b.envelopes.find((e) => e.categories.some((c) => c.items.some((p) => p.id === id)));
}

/** Items whose budget is transferred to `itemId` every month. */
export function sourcesOf(b: Budget, itemId: string): Item[] {
  return monthlyItems(b).filter((p) => p.transferTo === itemId);
}

/** Own budget plus transfers received. A transfer item keeps its own budget (it is spent by the transfer).
 *  An archived item is never planned: its effective budget is always null, even if it still has a `budget`
 *  or receives transfers (an archived transfer source is ignored by the receiving item, see below). */
export function effectiveBudget(b: Budget, p: Item): Cents | null {
  if (p.archived) return null;
  if (p.transferTo) return p.budget;
  const received = sourcesOf(b, p.id)
    .filter((x) => !x.archived)
    .reduce((s, x) => s + (x.budget ?? 0), 0);
  if (p.budget === null && received === 0) return null;
  return (p.budget ?? 0) + received;
}

export function categoryBudget(b: Budget, c: Category): Cents {
  return c.items.filter((p) => !p.transferTo).reduce((s, p) => s + (effectiveBudget(b, p) ?? 0), 0);
}

export function annualBudgetTotal(b: Budget): Cents {
  return b.annualItems.reduce((sum, p) => sum + (p.archived ? 0 : (p.budget ?? 0)), 0);
}

export function itemNote(p: Item): string {
  return [p.note, p.budget === null ? "budget à définir" : null].filter(Boolean).join(" · ");
}

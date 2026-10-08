import { annualBudgetFor, annualBudgetTotal, budgetFor, effectiveBudget, monthlyItems } from "./budget";
import { checkId, pad2, trackedMonths } from "./period";
import type { Budget, Cents, Envelope, Expense, Item, Nature } from "./types";

export type Status = "ok" | "warn" | "over" | null;

export const sumAmounts = (list: { amount: Cents }[]): Cents => list.reduce((s, e) => s + e.amount, 0);

export const monthExpenses = (expenses: Expense[], ym: string) =>
  expenses.filter((e) => e.scope === "monthly" && e.month === ym);

export const annualExpenses = (expenses: Expense[], year: number) =>
  expenses.filter((e) => e.scope === "annual" && e.year === year);

export function budgetStatus(spent: Cents, budget: Cents | null): Status {
  if (!budget) return null;
  if (spent > budget) return "over";
  if (spent >= budget * 0.9) return "warn";
  return "ok";
}

export const isMonthClosed = (ym: string, today: string) => ym < today.slice(0, 7);

const spentOn = (expenses: Expense[], ym: string, itemId: string) =>
  sumAmounts(monthExpenses(expenses, ym).filter((e) => e.item === itemId));

export function projectedLeftover(b: Budget, p: Item, expenses: Expense[], ym: string): Cents {
  return Math.max(0, (effectiveBudget(b, p) ?? 0) - spentOn(expenses, ym, p.id));
}

export function leftoverSaved(b: Budget, p: Item, expenses: Expense[], ym: string, today: string): Cents {
  if (!p.leftoverToSavings || p.archived || !isMonthClosed(ym, today)) return 0;
  return projectedLeftover(b, p, expenses, ym);
}

export interface EnvelopeSummary {
  id: string;
  label: string;
  income: Cents;
  received: Cents;
  transferred: Cents;
  expenses: Cents;
  savings: Cents;
  leftoverSaved: Cents;
  planned: Cents;
  remaining: Cents;
  fixedPaid: number;
  fixedTotal: number;
}

export function envelopeSummary(b: Budget, env: Envelope, expenses: Expense[], ym: string, today: string): EnvelopeSummary {
  const items = env.categories.flatMap((c) => c.items);
  const inEnv = new Set(items.map((p) => p.id));
  const own = items.filter((p) => !p.transferTo);
  const list = monthExpenses(expenses, ym);
  const spent = (p: Item) => sumAmounts(list.filter((e) => e.item === p.id));

  const expensesTotal = own.filter((p) => p.nature === "expense").reduce((s, p) => s + spent(p), 0);
  const savingsEntered = own.filter((p) => p.nature === "savings").reduce((s, p) => s + spent(p), 0);
  const leftover = own.reduce((s, p) => s + leftoverSaved(b, p, expenses, ym, today), 0);
  const transferred = items
    .filter((p) => p.transferTo && !inEnv.has(p.transferTo) && !p.archived)
    .reduce((s, p) => s + (p.budget ?? 0), 0);
  const received = monthlyItems(b)
    .filter((p) => p.transferTo && inEnv.has(p.transferTo) && !inEnv.has(p.id) && !p.archived)
    .reduce((s, p) => s + (p.budget ?? 0), 0);
  const planned = own.reduce((s, p) => s + (p.archived ? 0 : (p.budget ?? 0)), 0) + received;
  const savings = savingsEntered + leftover;
  const ids = new Set(list.map((e) => e.id));
  const fixed = own.filter((p) => p.type === "fixed" && !p.archived);
  return {
    id: env.id,
    label: env.label,
    income: env.income,
    received,
    transferred,
    expenses: expensesTotal,
    savings,
    leftoverSaved: leftover,
    planned,
    remaining: env.income + received - expensesTotal - savings - transferred,
    fixedPaid: fixed.filter((p) => ids.has(checkId("monthly", ym, p.id))).length,
    fixedTotal: fixed.length,
  };
}

export function annualSummary(b: Budget, expenses: Expense[], year: number) {
  const list = annualExpenses(expenses, year);
  const savingsIds = new Set(b.annualItems.filter((p) => p.nature === "savings").map((p) => p.id));
  const savings = sumAmounts(list.filter((e) => savingsIds.has(e.item)));
  const spent = sumAmounts(list);
  return {
    spent,
    expenses: spent - savings,
    savings,
    budget: annualBudgetTotal(b),
    undefinedCount: b.annualItems.filter((p) => p.budget === null).length,
  };
}

export interface ReportLine { id: string; label: string; budget: Cents; spent: Cents; nature: Nature; archived?: boolean }
export interface ReportCategory extends ReportLine { items: ReportLine[] }
export interface ReportEnvelope {
  id: string;
  label: string;
  shortLabel?: string;
  income: Cents;
  received: Cents;
  transferred: Cents;
  planned: Cents;
  expenses: Cents;
  savings: Cents;
  leftoverSaved: Cents;
  remaining: Cents;
  categories: ReportCategory[];
}
export interface ReportMonth {
  ym: string;
  tracked: boolean;
  expenses: Record<string, Cents>;
  total: Cents;
  budget: Record<string, Cents>;
  budgetTotal: Cents;
}
export interface ReportAnnualLine { id: string; label: string; budget: Cents | null; spent: Cents; archived?: boolean }
export interface Report {
  year: number;
  months: ReportMonth[];
  trackedCount: number;
  envelopes: ReportEnvelope[];
  totals: { planned: Cents; expenses: Cents; savings: Cents; leftoverSaved: Cents };
  annual: { spent: Cents; expenses: Cents; savings: Cents; budget: Cents; lines: ReportAnnualLine[] };
}

export function computeReport(budgets: Budget[], expenses: Expense[], year: number, today: string): Report {
  const tracked = new Set(trackedMonths(expenses, year, today));
  const envs = new Map<string, ReportEnvelope>();
  const envAcc = (id: string, label: string, shortLabel?: string): ReportEnvelope => {
    let acc = envs.get(id);
    if (!acc) {
      acc = {
        id, label, income: 0, received: 0, transferred: 0, planned: 0, expenses: 0, savings: 0, leftoverSaved: 0,
        remaining: 0, categories: [],
      };
      envs.set(id, acc);
    }
    acc.label = label;
    if (shortLabel) acc.shortLabel = shortLabel;
    else delete acc.shortLabel;
    return acc;
  };
  const lineOf = (
    acc: ReportEnvelope, catId: string, catLabel: string, itemId: string, itemLabel: string, nature: Nature, archived: boolean,
  ) => {
    let cat = acc.categories.find((c) => c.id === catId);
    if (!cat) { cat = { id: catId, label: catLabel, budget: 0, spent: 0, nature: "expense", items: [] }; acc.categories.push(cat); }
    cat.label = catLabel;
    let line = cat.items.find((l) => l.id === itemId);
    if (!line) { line = { id: itemId, label: itemLabel, budget: 0, spent: 0, nature }; cat.items.push(line); }
    line.label = itemLabel;
    line.nature = nature;
    if (archived) line.archived = true;
    return { cat, line };
  };

  // Build a map of all items across all budget versions (most recent by effectiveFrom wins)
  type ItemInfo = {
    envId: string; envLabel: string; envShortLabel?: string; catId: string; catLabel: string; itemLabel: string; nature: Nature; archived: boolean;
  };
  const itemInfo = new Map<string, ItemInfo>();
  const sortedBudgets = [...budgets].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  for (const b of sortedBudgets) {
    for (const env of b.envelopes) {
      for (const cat of env.categories) {
        for (const p of cat.items) {
          itemInfo.set(p.id, {
            envId: env.id, envLabel: env.label, envShortLabel: env.shortLabel, catId: cat.id, catLabel: cat.label, itemLabel: p.label, nature: p.nature,
            archived: !!p.archived,
          });
        }
      }
    }
  }

  const months: ReportMonth[] = [];
  for (let i = 1; i <= 12; i++) {
    const ym = `${year}-${pad2(i)}`;
    const b = budgetFor(budgets, ym);
    const m: ReportMonth = { ym, tracked: tracked.has(ym), expenses: {}, total: 0, budget: {}, budgetTotal: 0 };
    if (b) {
      for (const env of b.envelopes) {
        const spendBudget = env.categories
          .flatMap((c) => c.items)
          .filter((p) => !p.transferTo && p.nature === "expense")
          .reduce((s, p) => s + (effectiveBudget(b, p) ?? 0), 0);
        m.budget[env.id] = spendBudget;
        m.budgetTotal += spendBudget;
        m.expenses[env.id] = 0;
      }
    }
    if (b && m.tracked) {
      const list = monthExpenses(expenses, ym);
      for (const env of b.envelopes) {
        const s = envelopeSummary(b, env, expenses, ym, today);
        const acc = envAcc(env.id, env.label, env.shortLabel);
        acc.income += s.income;
        acc.received += s.received;
        acc.transferred += s.transferred;
        acc.planned += s.planned;
        acc.expenses += s.expenses;
        acc.savings += s.savings;
        acc.leftoverSaved += s.leftoverSaved;
        acc.remaining += s.remaining;
        m.expenses[env.id] = s.expenses;
        m.total += s.expenses;
        for (const c of env.categories) {
          for (const p of c.items) {
            if (p.transferTo) continue;
            const { cat, line } = lineOf(acc, c.id, c.label, p.id, p.label, p.nature, !!p.archived);
            const budget = effectiveBudget(b, p) ?? 0;
            const spent = sumAmounts(list.filter((e) => e.item === p.id));
            line.budget += budget;
            line.spent += spent;
            cat.budget += budget;
            cat.spent += spent;
          }
        }
      }
      const known = new Set(monthlyItems(b).map((p) => p.id));
      for (const e of list.filter((x) => !known.has(x.item))) {
        const info = itemInfo.get(e.item);
        if (info) {
          // Item exists in another budget version; attribute to its envelope/category
          const acc = envAcc(info.envId, info.envLabel, info.envShortLabel);
          const { cat, line } = lineOf(acc, info.catId, info.catLabel, e.item, info.itemLabel, info.nature, info.archived);
          line.spent += e.amount;
          cat.spent += e.amount;
          if (info.nature === "expense") {
            acc.expenses += e.amount;
            m.expenses[info.envId] = (m.expenses[info.envId] ?? 0) + e.amount;
            m.total += e.amount;
          } else if (info.nature === "savings") {
            acc.savings += e.amount;
          }
        } else {
          // Truly unknown item; put in Autres
          const acc = envAcc("autres", "Autres");
          const { cat, line } = lineOf(acc, "autres", "Autres", e.item, e.item, "expense", false);
          line.spent += e.amount;
          cat.spent += e.amount;
          acc.expenses += e.amount;
          m.expenses.autres = (m.expenses.autres ?? 0) + e.amount;
          m.total += e.amount;
        }
      }
    }
    months.push(m);
  }

  const envelopes = [...envs.values()];
  const ref = annualBudgetFor(budgets, year);
  const annualList = annualExpenses(expenses, year);
  const lines: ReportAnnualLine[] = (ref?.annualItems ?? []).map((p) => ({
    id: p.id, label: p.label, budget: p.budget, spent: sumAmounts(annualList.filter((e) => e.item === p.id)),
    ...(p.archived ? { archived: true as const } : {}),
  }));
  for (const e of annualList) {
    if (ref?.annualItems.some((p) => p.id === e.item)) continue;
    let line = lines.find((l) => l.id === e.item);
    if (!line) { line = { id: e.item, label: e.item, budget: null, spent: 0 }; lines.push(line); }
    line.spent += e.amount;
  }
  const annual = ref
    ? { ...annualSummary(ref, expenses, year), lines }
    : { spent: sumAmounts(annualList), expenses: sumAmounts(annualList), savings: 0, budget: 0, lines };

  return {
    year,
    months,
    trackedCount: months.filter((m) => m.tracked).length,
    envelopes,
    totals: {
      planned: envelopes.reduce((s, x) => s + x.planned, 0),
      expenses: envelopes.reduce((s, x) => s + x.expenses, 0),
      savings: envelopes.reduce((s, x) => s + x.savings, 0),
      leftoverSaved: envelopes.reduce((s, x) => s + x.leftoverSaved, 0),
    },
    annual: { spent: annual.spent, expenses: annual.expenses, savings: annual.savings, budget: annual.budget, lines },
  };
}

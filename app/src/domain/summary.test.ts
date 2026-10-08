import { describe, expect, test } from "vitest";
import { findItem } from "./budget";
import { v2Budget } from "./fixtures";
import {
  annualSummary, budgetStatus, computeReport, envelopeSummary, isMonthClosed, leftoverSaved, projectedLeftover,
} from "./summary";
import type { Expense } from "./types";

let n = 0;
const e = (date: string, item: string, amount: number, extra: Partial<Expense> = {}): Expense => ({
  id: extra.id ?? `e${n++}`, kind: "expense", scope: "monthly", item, amount, note: "", date,
  month: date.slice(0, 7), year: Number(date.slice(0, 4)), by: "u1", ...extra,
});
const chk = (ym: string, item: string, amount: number) =>
  e(`${ym}-01`, item, amount, { id: `chk_${ym}_${item}`, kind: "check" });

const b = v2Budget("2026-09");
const env = (id: string) => b.envelopes.find((x) => x.id === id)!;

test("budgetStatus thresholds (unchanged)", () => {
  expect(budgetStatus(8900, 10000)).toBe("ok");
  expect(budgetStatus(9000, 10000)).toBe("warn");
  expect(budgetStatus(10001, 10000)).toBe("over");
  expect(budgetStatus(1, null)).toBeNull();
});

test("isMonthClosed", () => {
  expect(isMonthClosed("2026-09", "2026-10-20")).toBe(true);
  expect(isMonthClosed("2026-10", "2026-10-20")).toBe(false);
  expect(isMonthClosed("2026-11", "2026-10-20")).toBe(false);
});

describe("envelopeSummary", () => {
  test("Budget principal receives the secondary transfer; groceries counted once", () => {
    const list = [chk("2026-10", "loyer", 180000), e("2026-10-05", "alimentation", 70000), chk("2026-10", "epargne", 25000)];
    expect(envelopeSummary(b, env("principal"), list, "2026-10", "2026-10-20")).toEqual({
      id: "principal", label: "Budget principal", income: 400000, received: 15000, transferred: 0,
      expenses: 250000, savings: 25000, leftoverSaved: 0,
      planned: 280000, remaining: 140000, fixedPaid: 2, fixedTotal: 2,
    });
  });

  test("Secondaire: transfer counted as transferred, never as an expense; remaining is 0 when all paid", () => {
    const list = [chk("2026-10", "transport", 35000), chk("2026-10", "reserve", 40000), chk("2026-10", "projets", 10000)];
    expect(envelopeSummary(b, env("secondaire"), list, "2026-10", "2026-10-20")).toEqual({
      id: "secondaire", label: "Revenu secondaire", income: 100000, received: 0, transferred: 15000,
      expenses: 35000, savings: 50000, leftoverSaved: 0,
      planned: 85000, remaining: 0, fixedPaid: 3, fixedTotal: 3,
    });
  });

  test("Appoint: closed month rest goes to savings", () => {
    const list = [e("2026-09-10", "loisirs", 42000)];
    const s = envelopeSummary(b, env("appoint"), list, "2026-09", "2026-10-20");
    expect([s.expenses, s.leftoverSaved, s.savings, s.remaining]).toEqual([42000, 8000, 8000, 0]);
  });

  test("Appoint: current month has no reported rest", () => {
    const list = [e("2026-10-10", "loisirs", 42000)];
    const s = envelopeSummary(b, env("appoint"), list, "2026-10", "2026-10-20");
    expect([s.leftoverSaved, s.savings, s.remaining]).toEqual([0, 0, 8000]);
  });

  test("Appoint: overspent closed month reports nothing", () => {
    const s = envelopeSummary(b, env("appoint"), [e("2026-09-10", "loisirs", 75000)], "2026-09", "2026-10-20");
    expect(s.leftoverSaved).toBe(0);
  });
});

test("projectedLeftover / leftoverSaved", () => {
  const loisirs = findItem(b, "loisirs")!;
  const list = [e("2026-10-10", "loisirs", 42000)];
  expect(projectedLeftover(b, loisirs, list, "2026-10")).toBe(8000);
  expect(leftoverSaved(b, loisirs, list, "2026-10", "2026-10-20")).toBe(0);
  expect(leftoverSaved(b, loisirs, list, "2026-10", "2026-11-01")).toBe(8000);
  expect(leftoverSaved(b, findItem(b, "alimentation")!, [], "2026-09", "2026-10-20")).toBe(0);
});

test("leftoverToSavings does not apply to an archived item", () => {
  const b2 = structuredClone(v2Budget("2026-09"));
  const loisirs = b2.envelopes[2]!.categories[0]!.items.find((p) => p.id === "loisirs")!;
  loisirs.archived = true;
  const list = [e("2026-09-10", "loisirs", 42000)];
  expect(leftoverSaved(b2, loisirs, list, "2026-09", "2026-10-20")).toBe(0);
});

describe("archived items", () => {
  test("envelopeSummary: excluded from planned and fixed counts, but its own expenses still count", () => {
    const b2 = structuredClone(v2Budget("2026-09"));
    b2.envelopes[1]!.categories[0]!.items.find((p) => p.id === "transport")!.archived = true;
    const list = [chk("2026-10", "reserve", 40000), e("2026-10-05", "transport", 35000), chk("2026-10", "projets", 10000)];
    const s = envelopeSummary(b2, b2.envelopes[1]!, list, "2026-10", "2026-10-20");
    expect(s.planned).toBe(50000);
    expect(s.fixedTotal).toBe(2);
    expect(s.fixedPaid).toBe(2);
    expect(s.expenses).toBe(35000);
  });

  test("envelopeSummary: an archived transfer source is not counted as transferred, and the target's received drops to 0", () => {
    const b2 = structuredClone(v2Budget("2026-09"));
    b2.envelopes[1]!.categories[0]!.items.find((p) => p.id === "courses")!.archived = true;
    const secondaire = envelopeSummary(b2, b2.envelopes[1]!, [], "2026-10", "2026-10-20");
    expect(secondaire.transferred).toBe(0);
    const principal = envelopeSummary(b2, b2.envelopes[0]!, [], "2026-10", "2026-10-20");
    expect(principal.received).toBe(0);
    expect(principal.planned).toBe(265000);
  });
});

test("a fixed item with a check plus an extra expense goes over budget", () => {
  const list = [chk("2026-10", "transport", 35000), e("2026-10-12", "transport", 3000)];
  const spent = list.reduce((s, x) => s + x.amount, 0);
  expect(budgetStatus(spent, 35000)).toBe("over");
  expect(envelopeSummary(b, env("secondaire"), list, "2026-10", "2026-10-20").expenses).toBe(38000);
});

test("annualSummary splits expenses and savings", () => {
  const list = [
    e("2026-04-02", "assurance", 15000, { scope: "annual" }),
    e("2026-05-02", "placement", 50000, { scope: "annual" }),
  ];
  expect(annualSummary(b, list, 2026)).toEqual({ spent: 65000, expenses: 15000, savings: 50000, budget: 52000, undefinedCount: 1 });
});

describe("computeReport", () => {
  const list = [
    e("2026-09-05", "alimentation", 50000),
    e("2026-09-10", "loisirs", 40000),
    e("2026-10-05", "alimentation", 90000),
    chk("2026-10", "reserve", 40000),
    e("2026-10-06", "mystere", 700),
    e("2026-06-01", "assurance", 15000, { scope: "annual" }),
  ];
  const report = computeReport([b], list, 2026, "2026-10-20");
  const byId = (id: string) => report.envelopes.find((x) => x.id === id)!;

  test("tracked months and per-envelope totals", () => {
    expect(report.trackedCount).toBe(2);
    expect(byId("principal")).toMatchObject({ planned: 560000, expenses: 140000, savings: 0, received: 30000, remaining: 690000 });
    expect(byId("secondaire")).toMatchObject({ planned: 170000, expenses: 0, savings: 40000, transferred: 30000, remaining: 130000 });
    expect(byId("appoint")).toMatchObject({ expenses: 40000, leftoverSaved: 10000, savings: 10000, remaining: 50000 });
  });

  test("report envelopes carry the short label of the latest budget version, when it has one", () => {
    const b1 = structuredClone(v2Budget("2026-09"));
    b1.envelopes[0]!.shortLabel = "Ancien";
    const b2 = structuredClone(v2Budget("2026-10"));
    b2.envelopes[0]!.shortLabel = "Principal";
    const r = computeReport([b2, b1], [e("2026-09-05", "alimentation", 100), e("2026-10-05", "alimentation", 100)], 2026, "2026-10-20");
    expect(r.envelopes.find((x) => x.id === "principal")).toMatchObject({ label: "Budget principal", shortLabel: "Principal" });
    expect(r.envelopes.find((x) => x.id === "secondaire")!.shortLabel).toBeUndefined();
  });

  test("unknown items go to Autres and are counted as an expense", () => {
    expect(byId("autres")).toMatchObject({ expenses: 700 });
  });

  test("global totals have no double counting of the transfer", () => {
    expect(report.totals).toEqual({ planned: 560000 + 170000 + 100000, expenses: 180700, savings: 50000, leftoverSaved: 10000 });
  });

  test("category lines use effective budgets", () => {
    const courant = byId("principal").categories.find((c) => c.id === "courant")!;
    expect(courant.items.find((p) => p.id === "alimentation")).toEqual({
      id: "alimentation", label: "alimentation", budget: 150000, spent: 140000, nature: "expense",
    });
    expect(byId("secondaire").categories[0]!.items.some((p) => p.id === "courses")).toBe(false);
  });

  test("monthly chart data per envelope", () => {
    const oct = report.months[9]!;
    expect(oct.tracked).toBe(true);
    expect(oct.expenses).toEqual({ principal: 90000, secondaire: 0, appoint: 0, autres: 700 });
    expect(oct.total).toBe(90700);
    expect(oct.budget).toEqual({ principal: 255000, secondaire: 35000, appoint: 50000 });
    expect(oct.budgetTotal).toBe(340000);
    expect(report.months[0]).toMatchObject({ tracked: false, total: 0, budgetTotal: 0 });
  });

  test("annual part", () => {
    expect(report.annual).toMatchObject({ spent: 15000, expenses: 15000, savings: 0, budget: 52000 });
  });

  test("removed/moved item attributed by effectiveFrom, not array order", () => {
    const b1 = v2Budget("2026-09");
    const b2 = structuredClone(v2Budget("2026-11"));
    // Move transport to new secondaire2 envelope in 2026-11
    const secondaireEnv = b2.envelopes.find((e) => e.id === "secondaire")!;
    const secondaireCategory = secondaireEnv.categories[0]!;
    const transport = secondaireCategory.items.find((p) => p.id === "transport")!;
    secondaireCategory.items = secondaireCategory.items.filter((p) => p.id !== "transport");
    b2.envelopes.push({
      id: "secondaire2", label: "Secondaire moved", income: 0, categories: [
        { id: "secondaire2", label: "Moved items", items: [transport] },
      ],
    });

    // Pass budgets in DESCENDING order (2026-11, 2026-09) to test sorting by effectiveFrom
    const list = [
      e("2026-10-10", "transport", 35000), // 2026-10 uses 2026-09 budget where transport is in secondaire
      e("2026-11-05", "transport", 36000), // 2026-11 uses 2026-11 budget where transport is in secondaire2
    ];
    const report = computeReport([b2, b1], list, 2026, "2026-11-20");

    const secondaireResult = report.envelopes.find((x) => x.id === "secondaire")!;
    const secondaire2Result = report.envelopes.find((x) => x.id === "secondaire2")!;

    expect(secondaireResult.expenses).toBe(35000);
    expect(secondaire2Result.expenses).toBe(36000);
    expect(report.months[9]!.expenses.secondaire).toBe(35000);
    expect(report.months[10]!.expenses.secondaire2).toBe(36000);
  });

  test("archived item: report line/category budget is 0 but spent is kept, flagged archived", () => {
    const b2 = structuredClone(v2Budget("2026-09"));
    b2.envelopes[1]!.categories[0]!.items.find((p) => p.id === "transport")!.archived = true;
    const archivedList = [e("2026-10-05", "transport", 35000)];
    const r = computeReport([b2], archivedList, 2026, "2026-10-20");
    const secondaire = r.envelopes.find((x) => x.id === "secondaire")!;
    const cat = secondaire.categories.find((c) => c.id === "secondaire")!;
    const line = cat.items.find((p) => p.id === "transport")!;
    expect(line.budget).toBe(0);
    expect(line.spent).toBe(35000);
    expect(line.archived).toBe(true);
  });

  test("item removed entirely from the current budget is attributed via an older version, not Autres", () => {
    const b1 = v2Budget("2026-09");
    const b2 = structuredClone(v2Budget("2026-11"));
    // Drop transport from the November budget (removed, not moved elsewhere)
    const secondaireCategory = b2.envelopes.find((x) => x.id === "secondaire")!.categories[0]!;
    secondaireCategory.items = secondaireCategory.items.filter((p) => p.id !== "transport");

    // Pass budgets in DESCENDING order (2026-11, 2026-09) to test sorting by effectiveFrom
    const list = [e("2026-11-05", "transport", 36000)];
    const report = computeReport([b2, b1], list, 2026, "2026-11-20");

    const secondaireResult = report.envelopes.find((x) => x.id === "secondaire")!;
    expect(secondaireResult.expenses).toBe(36000);
    expect(report.months[10]!.expenses.secondaire).toBe(36000);
    expect(report.envelopes.some((x) => x.id === "autres")).toBe(false);
  });
});

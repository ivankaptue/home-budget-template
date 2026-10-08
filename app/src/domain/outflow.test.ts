import { describe, expect, test } from "vitest";
import { P, v2Budget } from "./fixtures";
import { outflowId, outflowLines, outflowSummary, tickedItems } from "./outflow";
import type { Outflow, Scope } from "./types";

const b = v2Budget("2026-09");
const envItems = (id: string) => b.envelopes.find((x) => x.id === id)!.categories.flatMap((c) => c.items);
const out = (scope: Scope, period: string, item: string): Outflow => ({
  id: outflowId(scope, period, item), scope, item, period, year: Number(period.slice(0, 4)), by: "u1",
});

test("outflowId for both scopes", () => {
  expect(outflowId("monthly", "2026-10", "loyer")).toBe("out_2026-10_loyer");
  expect(outflowId("annual", "2026", "assurance")).toBe("out_2026_A_assurance");
});

describe("outflowLines", () => {
  test("uses each item's own budget, not the effective one", () => {
    expect(outflowLines(envItems("principal")).map((l) => [l.item.id, l.amount])).toEqual([
      ["loyer", 180000], ["alimentation", 60000], ["epargne", 25000],
    ]);
  });

  test("includes transfer and savings items", () => {
    expect(outflowLines(envItems("secondaire")).map((l) => [l.item.id, l.amount])).toEqual([
      ["reserve", 40000], ["transport", 35000], ["courses", 15000], ["projets", 10000],
    ]);
  });

  test("excludes archived and budgetless items", () => {
    const items = [P("a", 1000, { archived: true }), P("b", null), P("c", 0), P("d", 500)];
    expect(outflowLines(items).map((l) => l.item.id)).toEqual(["d"]);
    expect(outflowLines(b.annualItems).map((l) => l.item.id)).toEqual(["assurance", "placement"]);
  });
});

describe("outflowSummary", () => {
  const lines = outflowLines(envItems("principal"));

  test("sums ticked lines of the period; left = total − out", () => {
    const list = [out("monthly", "2026-10", "loyer"), out("monthly", "2026-10", "epargne")];
    expect(outflowSummary(lines, list, "monthly", "2026-10")).toEqual({ out: 205000, total: 265000, left: 60000 });
  });

  test("ignores other months, the other scope, and unknown or archived items", () => {
    const list = [
      out("monthly", "2026-09", "loyer"), // other month
      out("annual", "2026", "alimentation"), // other scope, same year
      out("monthly", "2026-10", "essence"), // not in these lines (unknown / archived / removed)
    ];
    expect(outflowSummary(lines, list, "monthly", "2026-10")).toEqual({ out: 0, total: 265000, left: 265000 });
  });

  test("an annual tick counts only in the annual list of its year", () => {
    const annual = outflowLines(b.annualItems);
    const list = [out("annual", "2026", "assurance"), out("annual", "2027", "placement"), out("monthly", "2026-12", "assurance")];
    expect(outflowSummary(annual, list, "annual", "2026")).toEqual({ out: 12000, total: 52000, left: 40000 });
  });
});

test("tickedItems filters by scope and period", () => {
  const list = [out("monthly", "2026-10", "a"), out("monthly", "2026-11", "b"), out("annual", "2026", "c")];
  expect([...tickedItems(list, "monthly", "2026-10")]).toEqual(["a"]);
  expect([...tickedItems(list, "annual", "2026")]).toEqual(["c"]);
});

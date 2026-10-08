import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { outflowLines, outflowSummary } from "../app/src/domain/outflow";
import { checkVersions, parseBudgetFile } from "./budget-file";

// Loose local shape for building raw (pre-validation) fixtures: leaf fields are `unknown` so
// tests can assign invalid values (wrong type, out-of-range) without fighting the type checker.
type RawItem = {
  id: unknown; label: unknown; budget: unknown; type: unknown; nature?: unknown;
  manager?: unknown; note?: unknown; leftoverToSavings?: unknown; transferTo?: unknown; archived?: unknown;
};
type RawCategory = { id: unknown; label: unknown; items: RawItem[] };
type RawEnvelope = { id: unknown; label: unknown; shortLabel?: unknown; income: unknown; categories: RawCategory[] };
type RawBudget = { envelopes: RawEnvelope[]; annualItems: RawItem[]; annualNote?: unknown };

const minimal = (): RawBudget => ({
  envelopes: [
    { id: "principal", label: "Principal", income: 4000, categories: [
      { id: "courant", label: "Vie", items: [{ id: "alimentation", label: "Alimentation", budget: 600.5, type: "variable", manager: "H" }] },
    ]},
    { id: "secondaire", label: "Secondaire", income: 1000, categories: [
      { id: "secondaire", label: "Répartition", items: [
        { id: "courses", label: "Courses", budget: 150, type: "fixed", transferTo: "alimentation" },
        { id: "reserve", label: "Réserve", budget: 400, type: "fixed", nature: "savings" },
      ]},
    ]},
  ],
  annualItems: [{ id: "vacances", label: "Vacances", budget: null, type: "variable" }],
});
const mutate = (f: (m: RawBudget) => void) => { const m = minimal(); f(m); return m; };

// The example, plus your own budget/*.json when present (git-ignored, so absent in CI and in a fresh clone).
const localBudgets = existsSync("budget") ? readdirSync("budget").filter((f) => f.endsWith(".json")).sort() : [];
const budgetFiles = ["examples/budget/2026-01.json", ...localBudgets.map((f) => join("budget", f))];

describe("parseBudgetFile v2", () => {
  test("converts dollars to cents, defaults nature, keeps transfer and flags", () => {
    const b = parseBudgetFile(minimal(), "2026-09.json");
    expect(b.effectiveFrom).toBe("2026-09");
    expect(b.envelopes.map((e) => [e.id, e.income])).toEqual([["principal", 400000], ["secondaire", 100000]]);
    expect(b.envelopes[0]!.categories[0]!.items[0]).toEqual({ id: "alimentation", label: "Alimentation", budget: 60050, type: "variable", nature: "expense", manager: "H" });
    expect(b.envelopes[1]!.categories[0]!.items[0]).toEqual({ id: "courses", label: "Courses", budget: 15000, type: "fixed", nature: "expense", transferTo: "alimentation" });
    expect(b.envelopes[1]!.categories[0]!.items[1]!.nature).toBe("savings");
    expect(b.annualItems[0]).toEqual({ id: "vacances", label: "Vacances", budget: null, type: "variable", nature: "expense" });
  });

  test("the example budget file is valid", () => {
    const b = parseBudgetFile(JSON.parse(readFileSync("examples/budget/2026-01.json", "utf8")), "2026-01.json");
    expect(b.envelopes.map((e) => e.id)).toEqual(["principal", "secondaire"]);
    expect(b.envelopes[0]!.categories[1]!.items[1]!.leftoverToSavings).toBe(true);
    expect(b.envelopes[1]!.categories[0]!.items[1]!.transferTo).toBe("alimentation");
  });

  test.each(budgetFiles)("%s: every item has a manager and the chequing totals per envelope equal its income", (path) => {
    const b = parseBudgetFile(JSON.parse(readFileSync(path, "utf8")), path.split("/").pop()!);
    const allItems = [...b.envelopes.flatMap((e) => e.categories.flatMap((c) => c.items)), ...b.annualItems];
    expect(allItems.every((p) => p.manager === "I" || p.manager === "H")).toBe(true);
    for (const env of b.envelopes) {
      const lines = outflowLines(env.categories.flatMap((c) => c.items));
      expect([env.id, outflowSummary(lines, [], "monthly", b.effectiveFrom).total]).toEqual([env.id, env.income]);
    }
  });

  test.each<[string, unknown, string, RegExp]>([
    ["bad file name", minimal(), "sept.json", /expected file name/],
    ["missing envelopes", { annualItems: [] }, "2026-09.json", /envelopes/],
    ["bad nature", mutate((m) => { m.envelopes[0]!.categories[0]!.items[0]!.nature = "autre"; }), "2026-09.json", /nature/],
    ["duplicate item id across envelopes", mutate((m) => { m.envelopes[1]!.categories[0]!.items[1]!.id = "alimentation"; }), "2026-09.json", /duplicate id/],
    ["duplicate envelope id", mutate((m) => { m.envelopes[1]!.id = "principal"; }), "2026-09.json", /duplicate id/],
    ["transfer to unknown item", mutate((m) => { m.envelopes[1]!.categories[0]!.items[0]!.transferTo = "inconnu"; }), "2026-09.json", /transferTo/],
    ["transfer to itself", mutate((m) => { m.envelopes[1]!.categories[0]!.items[0]!.transferTo = "courses"; }), "2026-09.json", /transferTo/],
    ["transfer chain", mutate((m) => { m.envelopes[0]!.categories[0]!.items[0]!.transferTo = "reserve"; }), "2026-09.json", /transferTo/],
    ["transfer with leftover to savings", mutate((m) => { m.envelopes[1]!.categories[0]!.items[0]!.leftoverToSavings = true; }), "2026-09.json", /leftoverToSavings/],
    ["annual transfer", mutate((m) => { m.annualItems[0]!.transferTo = "alimentation"; }), "2026-09.json", /annualItems\[0\]\.transferTo/],
    ["id longer than 60", mutate((m) => { m.envelopes[0]!.categories[0]!.items[0]!.id = "a".repeat(61); }), "2026-09.json", /\.id/],
    ["transfer inside the same envelope", mutate((m) => { m.envelopes[1]!.categories[0]!.items[0]!.transferTo = "reserve"; }), "2026-09.json", /transferTo/],
    ["annual item with leftoverToSavings is rejected", mutate((m) => { m.annualItems[0]!.leftoverToSavings = true; }), "2026-09.json", /leftoverToSavings/],
    ["archived must be true when present", mutate((m) => { m.envelopes[0]!.categories[0]!.items[0]!.archived = false; }), "2026-09.json", /archived/],
    ["archived with another value is rejected", mutate((m) => { m.annualItems[0]!.archived = "yes"; }), "2026-09.json", /archived/],
    ["transfer to an archived target", mutate((m) => { m.envelopes[0]!.categories[0]!.items[0]!.archived = true; }), "2026-09.json", /transferTo/],
  ])("rejects %s", (_n, raw, file, message) => {
    expect(() => parseBudgetFile(raw, file)).toThrow(message);
  });

  test("keeps the optional envelope shortLabel and budget annualNote, omits them when absent", () => {
    const raw = mutate((m) => { m.envelopes[0]!.shortLabel = "Princ."; m.annualNote = "payé par la réserve"; });
    const b = parseBudgetFile(raw, "2026-09.json");
    expect(b.envelopes[0]!.shortLabel).toBe("Princ.");
    expect(b.annualNote).toBe("payé par la réserve");
    const plain = parseBudgetFile(minimal(), "2026-09.json");
    expect("shortLabel" in plain.envelopes[0]!).toBe(false);
    expect("annualNote" in plain).toBe(false);
  });

  test.each<[string, RawBudget, RegExp]>([
    ["empty shortLabel", mutate((m) => { m.envelopes[0]!.shortLabel = " "; }), /envelopes\[0\]\.shortLabel/],
    ["shortLabel longer than 20", mutate((m) => { m.envelopes[0]!.shortLabel = "x".repeat(21); }), /envelopes\[0\]\.shortLabel/],
    ["annualNote not a string", mutate((m) => { m.annualNote = 3; }), /annualNote/],
  ])("rejects %s", (_n, raw, message) => {
    expect(() => parseBudgetFile(raw, "2026-09.json")).toThrow(message);
  });

  test("accepts and keeps archived: true on monthly and annual items", () => {
    const raw = mutate((m) => {
      m.envelopes[1]!.categories[0]!.items[1]!.archived = true; // reserve, not a transfer target
      m.annualItems[0]!.archived = true; // vacances
    });
    const b = parseBudgetFile(raw, "2026-09.json");
    expect(b.envelopes[1]!.categories[0]!.items[1]!.archived).toBe(true);
    expect(b.annualItems[0]!.archived).toBe(true);
  });
});

describe("checkVersions", () => {
  test("throws when an item present in an earlier version is missing from a later one", () => {
    const v1 = parseBudgetFile(minimal(), "2026-09.json");
    const v2 = parseBudgetFile(
      mutate((m) => {
        m.envelopes[1]!.categories[0]!.items = m.envelopes[1]!.categories[0]!.items.filter((it) => it.id !== "reserve");
      }),
      "2026-11.json",
    );
    expect(() => checkVersions([v1, v2])).toThrow(/2026-11\.json: item "reserve" was removed — set "archived": true instead of deleting it/);
  });

  test("accepts an item archived instead of removed", () => {
    const v1 = parseBudgetFile(minimal(), "2026-09.json");
    const v2 = parseBudgetFile(
      mutate((m) => {
        m.envelopes[1]!.categories[0]!.items[1]!.archived = true;
      }),
      "2026-11.json",
    );
    expect(() => checkVersions([v1, v2])).not.toThrow();
  });

  test("accepts budgets passed out of order (sorts by effectiveFrom first)", () => {
    const v1 = parseBudgetFile(minimal(), "2026-09.json");
    const v2 = parseBudgetFile(minimal(), "2026-11.json");
    expect(() => checkVersions([v2, v1])).not.toThrow();
  });
});

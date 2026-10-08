import { expect, test } from "vitest";
import {
  annualBudgetFor, annualBudgetTotal, budgetFor, categoryBudget, effectiveBudget, envelopeOfItem, findItem,
  monthlyItems, sourcesOf,
} from "./budget";
import { v2Budget } from "./fixtures";

test("budgetFor / annualBudgetFor pick the version in force", () => {
  const budgets = [v2Budget("2027-03"), v2Budget("2026-09")];
  expect(budgetFor(budgets, "2026-08")).toBeNull();
  expect(budgetFor(budgets, "2027-02")?.effectiveFrom).toBe("2026-09");
  expect(budgetFor(budgets, "2027-03")?.effectiveFrom).toBe("2027-03");
  expect(annualBudgetFor(budgets, 2026)?.effectiveFrom).toBe("2026-09");
});

test("lookups across envelopes", () => {
  const b = v2Budget("2026-09");
  expect(monthlyItems(b).map((p) => p.id)).toEqual([
    "loyer", "alimentation", "epargne", "reserve", "transport", "courses", "projets", "loisirs",
  ]);
  expect(findItem(b, "transport")?.budget).toBe(35000);
  expect(findItem(b, "assurance")).toBeUndefined();
  expect(envelopeOfItem(b, "courses")?.id).toBe("secondaire");
  expect(sourcesOf(b, "alimentation").map((p) => p.id)).toEqual(["courses"]);
});

test("effective budget adds transfers to the receiving item", () => {
  const b = v2Budget("2026-09");
  expect(effectiveBudget(b, findItem(b, "alimentation")!)).toBe(75000);
  expect(effectiveBudget(b, findItem(b, "courses")!)).toBe(15000);
  expect(effectiveBudget(b, findItem(b, "transport")!)).toBe(35000);
});

test("category budget uses effective budgets and skips transfer items", () => {
  const b = v2Budget("2026-09");
  const courant = b.envelopes[0]!.categories[1]!;
  const secondaire = b.envelopes[1]!.categories[0]!;
  expect(categoryBudget(b, courant)).toBe(75000);
  expect(categoryBudget(b, secondaire)).toBe(85000);
  expect(annualBudgetTotal(b)).toBe(52000);
});

test("archived item: effective budget is null and it contributes nothing to its category budget", () => {
  const b = structuredClone(v2Budget("2026-09"));
  findItem(b, "transport")!.archived = true;
  expect(effectiveBudget(b, findItem(b, "transport")!)).toBeNull();
  const secondaire = b.envelopes[1]!.categories[0]!;
  expect(categoryBudget(b, secondaire)).toBe(85000 - 35000);
});

test("archived transfer source: adds nothing to the target's effective budget, and its own is null", () => {
  const b = structuredClone(v2Budget("2026-09"));
  findItem(b, "courses")!.archived = true;
  expect(effectiveBudget(b, findItem(b, "alimentation")!)).toBe(60000);
  expect(effectiveBudget(b, findItem(b, "courses")!)).toBeNull();
});

test("annualBudgetTotal excludes an archived annual item", () => {
  const b = structuredClone(v2Budget("2026-09"));
  b.annualItems.find((p) => p.id === "assurance")!.archived = true;
  expect(annualBudgetTotal(b)).toBe(52000 - 12000);
});

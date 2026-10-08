import { expect, test } from "vitest";
import { budgetFromDoc, expenseFields, expenseFromDoc, outflowFields, outflowFromDoc } from "./mapping";

const doc = {
  kind: "expense", scope: "monthly", item: "alimentation", amount: 8450, note: "épicerie",
  date: "2026-10-03", month: "2026-10", year: 2026, by: "u1", createdAt: null, updatedAt: null,
};

test("expenseFromDoc keeps valid documents, including pending ones with null timestamps", () => {
  expect(expenseFromDoc("e1", doc)).toEqual({
    id: "e1", kind: "expense", scope: "monthly", item: "alimentation", amount: 8450, note: "épicerie",
    date: "2026-10-03", month: "2026-10", year: 2026, by: "u1",
  });
});

test("expenseFromDoc drops malformed documents", () => {
  expect(expenseFromDoc("e1", { ...doc, amount: "84" })).toBeNull();
  expect(expenseFromDoc("e1", { ...doc, scope: "hebdo" })).toBeNull();
  expect(expenseFromDoc("e1", { ...doc, date: undefined })).toBeNull();
});

test("expenseFields derives month and year from the date", () => {
  expect(expenseFields({ kind: "check", scope: "annual", item: "assurance", amount: 12000, note: "", date: "2027-01-01" }))
    .toEqual({ kind: "check", scope: "annual", item: "assurance", amount: 12000, note: "", date: "2027-01-01", month: "2027-01", year: 2027 });
});

test("budgetFromDoc requires the v2 shape", () => {
  const b = { effectiveFrom: "2026-09", envelopes: [], annualItems: [] };
  expect(budgetFromDoc(b)).toEqual(b);
  expect(budgetFromDoc({ ...b, envelopes: undefined })).toBeNull();
  expect(budgetFromDoc({ effectiveFrom: "2026-09", categories: [], annualItems: [], income: 1 })).toBeNull();
  expect(budgetFromDoc({ ...b, effectiveFrom: "sept" })).toBeNull();
});

const outDoc = { scope: "monthly", item: "alimentation", period: "2026-10", year: 2026, by: "u1", createdAt: null };

test("outflowFromDoc keeps valid documents, including pending ones with a null timestamp", () => {
  expect(outflowFromDoc("out_2026-10_alimentation", outDoc)).toEqual({
    id: "out_2026-10_alimentation", scope: "monthly", item: "alimentation", period: "2026-10", year: 2026, by: "u1",
  });
});

test("outflowFromDoc drops malformed documents", () => {
  expect(outflowFromDoc("x", { ...outDoc, scope: "hebdo" })).toBeNull();
  expect(outflowFromDoc("x", { ...outDoc, year: "2026" })).toBeNull();
  expect(outflowFromDoc("x", { ...outDoc, period: undefined })).toBeNull();
  expect(outflowFromDoc("x", { ...outDoc, item: 3 })).toBeNull();
});

test("outflowFields derives the year from the period", () => {
  expect(outflowFields("annual", "2027", "assurance")).toEqual({ scope: "annual", item: "assurance", period: "2027", year: 2027 });
  expect(outflowFields("monthly", "2026-10", "essence")).toEqual({ scope: "monthly", item: "essence", period: "2026-10", year: 2026 });
});

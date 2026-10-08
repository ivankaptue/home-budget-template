import { describe, expect, test } from "vitest";
import type { Expense } from "./types";
import {
  checkId, defaultDate, formatShortDate, isISODate, lastDayOfMonth, monthLabel, shiftMonth, toISODate, trackedMonths,
} from "./period";

const exp = (month: string, extra: Partial<Expense> = {}): Expense => ({
  id: month, kind: "expense", scope: "monthly", item: "alimentation", amount: 100, note: "",
  date: `${month}-15`, month, year: Number(month.slice(0, 4)), by: "u1", ...extra,
});

describe("shiftMonth", () => {
  test("crosses year boundaries both ways", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-09", 0)).toBe("2026-09");
    expect(shiftMonth("2026-09", -21)).toBe("2024-12");
  });
});

test("toISODate uses the local calendar date", () => {
  expect(toISODate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
});

test("isISODate", () => {
  expect(isISODate("2026-02-28")).toBe(true);
  expect(isISODate("2026-02-30")).toBe(false);
  expect(isISODate("2026-13-01")).toBe(false);
  expect(isISODate("26-01-01")).toBe(false);
  expect(isISODate("")).toBe(false);
});

test("labels", () => {
  expect(monthLabel("2026-10")).toBe("octobre 2026");
  expect(formatShortDate("2026-10-03")).toBe("3 oct");
});

test("lastDayOfMonth", () => {
  expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
  expect(lastDayOfMonth("2026-04")).toBe("2026-04-30");
  expect(lastDayOfMonth("2026-12")).toBe("2026-12-31");
});

test("checkId", () => {
  expect(checkId("monthly", "2026-10", "loyer")).toBe("chk_2026-10_loyer");
  expect(checkId("annual", "2026", "assurance")).toBe("chk_2026_A_assurance");
});

describe("defaultDate", () => {
  test("today when viewing the current period", () => {
    expect(defaultDate("monthly", "2026-10", "2026-10-17")).toBe("2026-10-17");
    expect(defaultDate("annual", "2026", "2026-10-17")).toBe("2026-10-17");
  });
  test("first day otherwise", () => {
    expect(defaultDate("monthly", "2026-09", "2026-10-17")).toBe("2026-09-01");
    expect(defaultDate("annual", "2027", "2026-10-17")).toBe("2027-01-01");
  });
});

describe("trackedMonths", () => {
  test("empty when no monthly expense in that year", () => {
    expect(trackedMonths([exp("2025-12")], 2026, "2026-10-01")).toEqual([]);
  });
  test("from first expense month to the current month", () => {
    expect(trackedMonths([exp("2026-09")], 2026, "2026-11-02")).toEqual(["2026-09", "2026-10", "2026-11"]);
  });
  test("past year runs to December", () => {
    expect(trackedMonths([exp("2025-10")], 2025, "2026-03-01")).toEqual(["2025-10", "2025-11", "2025-12"]);
  });
  test("data dated after today still counts", () => {
    expect(trackedMonths([exp("2026-10"), exp("2026-12")], 2026, "2026-10-20")).toEqual(["2026-10", "2026-11", "2026-12"]);
  });
  test("ignores annual expenses and other years", () => {
    const list = [exp("2026-03", { scope: "annual" }), exp("2027-01"), exp("2026-11")];
    expect(trackedMonths(list, 2026, "2026-11-05")).toEqual(["2026-11"]);
  });
});

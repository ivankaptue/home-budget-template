import { describe, expect, test } from "vitest";
import { centsToInput, formatMoney, parseAmount } from "./money";

const norm = (s: string) => s.replace(/\s/g, " ");

describe("parseAmount", () => {
  test.each([
    ["84,50", 8450],
    ["84,5", 8450],
    ["84.50", 8450],
    ["84", 8400],
    ["0", 0],
    ["1 234,56", 123456],
    ["1 234,56", 123456],
    ["12 $", 1200],
    ["$12", 1200],
    [" 7,05 ", 705],
  ])("%s -> %i cents", (input, cents) => {
    expect(parseAmount(input)).toBe(cents);
  });

  test.each(["", "abc", "-5", "84,555", "1,234.56", "12,", ",5", "1e3"])("%s is rejected", (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe("formatMoney", () => {
  test("whole dollars have no decimals", () => {
    expect(norm(formatMoney(250000))).toBe("2 500 $");
    expect(norm(formatMoney(0))).toBe("0 $");
  });
  test("cents are shown with two decimals", () => {
    expect(norm(formatMoney(8450))).toBe("84,50 $");
    expect(norm(formatMoney(705))).toBe("7,05 $");
  });
});

describe("centsToInput", () => {
  test.each([
    [8450, "84,50"],
    [8405, "84,05"],
    [250000, "2500"],
    [0, "0"],
  ])("%i -> %s", (cents, text) => {
    expect(centsToInput(cents)).toBe(text);
  });
  test("round-trips through parseAmount", () => {
    for (const c of [1, 99, 8450, 123456]) expect(parseAmount(centsToInput(c))).toBe(c);
  });
});

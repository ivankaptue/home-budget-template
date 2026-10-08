import { expect, test } from "vitest";
import { niceStep } from "./scale";

test.each([
  [80, 100], [120, 200], [240, 250], [300, 500], [700, 1000], [95000, 100000], [0.5, 0.5],
])("niceStep(%d) = %d", (raw, step) => {
  expect(niceStep(raw)).toBe(step);
});

import { describe, expect, test } from "vitest";
import { parseEmails, renderRules } from "./rules";

describe("parseEmails", () => {
  test("splits on commas and spaces, trims and drops duplicates", () => {
    expect(parseEmails(" a@example.com, b@example.org  a@example.com,")).toEqual(["a@example.com", "b@example.org"]);
  });

  test.each<[string, string | undefined]>([
    ["missing", undefined],
    ["empty", " , "],
    ["not an email", "a@example.com, bob"],
    ["quote injection", "a@example.com'] || true || ['x@y.z"],
  ])("rejects %s", (_n, raw) => {
    expect(() => parseEmails(raw)).toThrow(/ALLOWED_EMAILS/);
  });
});

describe("renderRules", () => {
  const template = "allow if email in [__ALLOWED_EMAILS__];";

  test("replaces the placeholder with a quoted list", () => {
    expect(renderRules(template, ["a@example.com", "b@example.org"]))
      .toBe("allow if email in ['a@example.com', 'b@example.org'];");
  });

  test("requires exactly one placeholder", () => {
    expect(() => renderRules("no placeholder", ["a@example.com"])).toThrow(/__ALLOWED_EMAILS__/);
    expect(() => renderRules(template + template, ["a@example.com"])).toThrow(/__ALLOWED_EMAILS__/);
  });
});

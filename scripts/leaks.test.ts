import { describe, expect, test } from "vitest";
import { findLeaks, forbiddenTerms } from "./leaks";

describe("forbiddenTerms", () => {
  test("collects emails, Firebase ids, the tagline and extra words; ignores blanks", () => {
    expect(forbiddenTerms({
      ALLOWED_EMAILS: "a@example.com, b@example.org",
      VITE_FIREBASE_PROJECT_ID: "my-budget-123",
      VITE_FIREBASE_API_KEY: "AIzaXYZ",
      VITE_FIREBASE_APP_ID: "",
      VITE_APP_TAGLINE: "Le budget des Dupont",
      SHARE_FORBIDDEN: "Dupont, Marie,,",
    })).toEqual(["a@example.com", "b@example.org", "my-budget-123", "AIzaXYZ", "Le budget des Dupont", "Dupont", "Marie"]);
  });
});

describe("findLeaks", () => {
  test("finds terms case-insensitively, per file", () => {
    const files = [
      { path: "README.md", text: "Built by the DUPONT family" },
      { path: "app/src/x.ts", text: "const projectId = 'my-budget-123';" },
      { path: "clean.ts", text: "nothing here" },
    ];
    expect(findLeaks(files, ["Dupont", "my-budget-123"])).toEqual([
      { path: "README.md", term: "Dupont" },
      { path: "app/src/x.ts", term: "my-budget-123" },
    ]);
  });

  test("matches whole words only, accents included", () => {
    const files = [{ path: "Header.tsx", text: "Relevé du mois · Rémi's · domain.com/rémi" }];
    expect(findLeaks(files, ["Eve", "Rém"])).toEqual([]);
    expect(findLeaks(files, ["rémi"])).toEqual([{ path: "Header.tsx", term: "rémi" }]);
    expect(findLeaks([{ path: "a", text: "url: `my-budget-123.web.app`" }], ["my-budget-123"])).toHaveLength(1);
  });
});

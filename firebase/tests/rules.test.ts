import { readFileSync } from "node:fs";
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { renderRules } from "../../scripts/rules";

let env: RulesTestEnvironment;
// Set by `firebase emulators:exec` from firebase.json (8080 by default, as in CI).
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":") as [string, string];

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-home-budget",
    firestore: { rules: renderRules(readFileSync("firebase/firestore.template.rules", "utf8"), ["alice@example.com", "bob@example.com"]), host, port: Number(port) },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const alice = () => env.authenticatedContext("alice", { email: "alice@example.com", email_verified: true }).firestore();
const bob = () => env.authenticatedContext("bob", { email: "bob@example.com", email_verified: true }).firestore();
const intrus = () => env.authenticatedContext("x", { email: "intrus@example.com", email_verified: true }).firestore();
const unverified = () => env.authenticatedContext("alice", { email: "alice@example.com", email_verified: false }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const valid = (by = "alice") => ({
  kind: "expense", scope: "monthly", item: "alimentation", amount: 8450, note: "épicerie",
  date: "2026-10-03", month: "2026-10", year: 2026, by,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
});

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}
const seeded = (by = "alice") => ({ ...valid(by), createdAt: Timestamp.fromMillis(1), updatedAt: Timestamp.fromMillis(1) });

describe("access", () => {
  test("allowed users can read and create", async () => {
    await assertSucceeds(setDoc(doc(alice(), "expenses/e1"), valid("alice")));
    await assertSucceeds(setDoc(doc(bob(), "expenses/e2"), valid("bob")));
    await assertSucceeds(getDoc(doc(bob(), "expenses/e1")));
  });
  test("others are refused", async () => {
    await seed("expenses/e1", seeded());
    await assertFails(getDoc(doc(intrus(), "expenses/e1")));
    await assertFails(getDoc(doc(unverified(), "expenses/e1")));
    await assertFails(getDoc(doc(anon(), "expenses/e1")));
    await assertFails(setDoc(doc(intrus(), "expenses/e2"), valid("x")));
  });
  test("budgets are read-only from the app", async () => {
    await seed("budgets/2026-09", { effectiveFrom: "2026-09" });
    await assertSucceeds(getDoc(doc(alice(), "budgets/2026-09")));
    await assertFails(setDoc(doc(alice(), "budgets/2026-10"), { effectiveFrom: "2026-10" }));
    await assertFails(getDoc(doc(intrus(), "budgets/2026-09")));
  });
  test("unknown collections are refused", async () => {
    await assertFails(setDoc(doc(alice(), "other/x"), { a: 1 }));
  });
});

describe("expense validation", () => {
  test.each([
    ["negative amount", { amount: -100 }],
    ["zero amount on an expense", { amount: 0 }],
    ["decimal amount", { amount: 84.5 }],
    ["bad date", { date: "2026-10-3" }],
    ["month not matching date", { month: "2026-11" }],
    ["year not matching date", { year: 2027 }],
    ["unknown kind", { kind: "autre" }],
    ["unknown scope", { scope: "hebdo" }],
    ["note too long", { note: "x".repeat(81) }],
    ["empty item", { item: "" }],
    ["spoofed author", { by: "bob" }],
    ["extra field", { extra: true }],
  ])("refuses %s", async (_name, patch) => {
    await assertFails(setDoc(doc(alice(), "expenses/e1"), { ...valid("alice"), ...patch }));
  });

  test("refuses a missing field", async () => {
    const { note: _n, ...rest } = valid("alice");
    await assertFails(setDoc(doc(alice(), "expenses/e1"), rest));
  });

  test("refuses a client-chosen createdAt", async () => {
    await assertFails(setDoc(doc(alice(), "expenses/e1"), { ...valid("alice"), createdAt: Timestamp.fromMillis(5) }));
  });

  test("a check may have a zero amount", async () => {
    await assertSucceeds(setDoc(doc(alice(), "expenses/chk_2026-10_x"), { ...valid("alice"), kind: "check", amount: 0 }));
  });
});

describe("updates and deletes", () => {
  test("either user can edit an expense, author and createdAt stay", async () => {
    await seed("expenses/e1", seeded("alice"));
    await assertSucceeds(updateDoc(doc(bob(), "expenses/e1"), { amount: 9000, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(bob(), "expenses/e1"), { by: "bob", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(bob(), "expenses/e1"), { amount: 9000 }));
  });

  test("a check re-set by the other user is accepted (two phones)", async () => {
    await seed("expenses/chk_2026-10_loyer", { ...seeded("alice"), kind: "check", item: "loyer" });
    await assertSucceeds(setDoc(doc(bob(), "expenses/chk_2026-10_loyer"), { ...valid("bob"), kind: "check", item: "loyer" }));
  });

  test("an expense cannot be overwritten by set from the other user", async () => {
    await seed("expenses/e1", seeded("alice"));
    await assertFails(setDoc(doc(bob(), "expenses/e1"), valid("bob")));
  });

  test("an expense cannot be overwritten as a check by the other user", async () => {
    await seed("expenses/e1", seeded("alice"));
    await assertFails(setDoc(doc(bob(), "expenses/e1"), { ...valid("bob"), kind: "check" }));
  });

  test("allowed users can delete, others cannot", async () => {
    await seed("expenses/e1", seeded("alice"));
    await assertFails(deleteDoc(doc(intrus(), "expenses/e1")));
    await assertSucceeds(deleteDoc(doc(bob(), "expenses/e1")));
  });
});

describe("members", () => {
  test("each user writes only their own profile", async () => {
    await assertSucceeds(setDoc(doc(alice(), "members/alice"), { name: "Alice", photoURL: "" }));
    await assertFails(setDoc(doc(alice(), "members/bob"), { name: "Bob", photoURL: "" }));
    await assertFails(setDoc(doc(alice(), "members/alice"), { name: "Alice", photoURL: "", admin: true }));
    await assertSucceeds(getDoc(doc(bob(), "members/alice")));
    await assertFails(getDoc(doc(intrus(), "members/alice")));
  });
});

const outflow = (by = "alice", extra: Record<string, unknown> = {}) => ({
  scope: "monthly", item: "alimentation", period: "2026-10", year: 2026, by, createdAt: serverTimestamp(), ...extra,
});
const annualOutflow = (by = "alice") => outflow(by, { scope: "annual", item: "assurance", period: "2026" });
const seededOutflow = (by = "alice") => ({ ...outflow(by), createdAt: Timestamp.fromMillis(1) });

describe("outflows", () => {
  test("allowed users tick a monthly and an annual item, and read them", async () => {
    await assertSucceeds(setDoc(doc(alice(), "outflows/out_2026-10_alimentation"), outflow("alice")));
    await assertSucceeds(setDoc(doc(bob(), "outflows/out_2026_A_assurance"), annualOutflow("bob")));
    await assertSucceeds(getDoc(doc(bob(), "outflows/out_2026-10_alimentation")));
    await assertSucceeds(getDocs(query(collection(alice(), "outflows"), where("year", "==", 2026))));
  });

  test.each<[string, string, Record<string, unknown>]>([
    ["id not matching the item", "out_2026-10_essence", {}],
    ["id not matching the period", "out_2026-11_alimentation", {}],
    ["monthly id on an annual outflow", "out_2026_alimentation", { scope: "annual", period: "2026" }],
    ["year period on a monthly outflow", "out_2026_alimentation", { period: "2026" }],
    ["month period on an annual outflow", "out_2026-10_A_alimentation", { scope: "annual" }],
    ["bad month", "out_2026-13_alimentation", { period: "2026-13" }],
    ["year not matching the period", "out_2026-10_alimentation", { year: 2027 }],
    ["year as a string", "out_2026-10_alimentation", { year: "2026" }],
    ["unknown scope", "out_2026-10_alimentation", { scope: "hebdo" }],
    ["empty item", "out_2026-10_", { item: "" }],
    ["spoofed author", "out_2026-10_alimentation", { by: "bob" }],
    ["client-chosen createdAt", "out_2026-10_alimentation", { createdAt: Timestamp.fromMillis(5) }],
    ["extra field", "out_2026-10_alimentation", { amount: 70000 }],
  ])("refuses %s", async (_name, id, patch) => {
    await assertFails(setDoc(doc(alice(), `outflows/${id}`), outflow("alice", patch)));
  });

  test("refuses a missing field", async () => {
    const { year: _y, ...rest } = outflow("alice");
    await assertFails(setDoc(doc(alice(), "outflows/out_2026-10_alimentation"), rest));
  });

  test("a tick re-set by the other user is accepted (two phones)", async () => {
    await seed("outflows/out_2026-10_alimentation", seededOutflow("alice"));
    await assertSucceeds(setDoc(doc(bob(), "outflows/out_2026-10_alimentation"), outflow("bob")));
  });

  test("allowed users can untick", async () => {
    await seed("outflows/out_2026-10_alimentation", seededOutflow("alice"));
    await assertSucceeds(deleteDoc(doc(bob(), "outflows/out_2026-10_alimentation")));
  });

  test("others cannot read, tick or untick", async () => {
    await seed("outflows/out_2026-10_alimentation", seededOutflow("alice"));
    await assertFails(getDoc(doc(intrus(), "outflows/out_2026-10_alimentation")));
    await assertFails(getDocs(query(collection(intrus(), "outflows"), where("year", "==", 2026))));
    await assertFails(getDoc(doc(unverified(), "outflows/out_2026-10_alimentation")));
    await assertFails(setDoc(doc(intrus(), "outflows/out_2026-10_alimentation"), outflow("x")));
    await assertFails(deleteDoc(doc(intrus(), "outflows/out_2026-10_alimentation")));
  });
});

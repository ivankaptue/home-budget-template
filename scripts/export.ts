import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { toCsv, type ExportRow } from "./csv";
import { loadEnv, requireEnv } from "./env";

loadEnv();
initializeApp({ credential: applicationDefault(), projectId: requireEnv("VITE_FIREBASE_PROJECT_ID") });
const db = getFirestore();

const plain = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v instanceof Timestamp ? v.toDate().toISOString() : v]));

const day = new Date().toISOString().slice(0, 10);
const out = join("exports", day);
mkdirSync(out, { recursive: true });

const budgets = (await db.collection("budgets").get()).docs.map((d) => ({ id: d.id, ...plain(d.data()) }));
const expenses = (await db.collection("expenses").orderBy("date").get()).docs.map((d) => ({ id: d.id, ...plain(d.data()) }));

writeFileSync(join(out, "budgets.json"), JSON.stringify(budgets, null, 2));
writeFileSync(join(out, "expenses.json"), JSON.stringify(expenses, null, 2));
writeFileSync(join(out, "expenses.csv"), toCsv(expenses as unknown as ExportRow[]));
console.log(`✓ ${budgets.length} budgets, ${expenses.length} dépenses → ${out}`);

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { checkVersions, parseBudgetFile } from "./budget-file";
import { loadEnv, requireEnv } from "./env";

const dir = "budget";
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const budgets = files.map((f) => parseBudgetFile(JSON.parse(readFileSync(join(dir, f), "utf8")), f));
checkVersions(budgets);

loadEnv();
initializeApp({ credential: applicationDefault(), projectId: requireEnv("VITE_FIREBASE_PROJECT_ID") });
const db = getFirestore();
for (const b of budgets) {
  await db.doc(`budgets/${b.effectiveFrom}`).set(b);
  console.log(`✓ budgets/${b.effectiveFrom}`);
}

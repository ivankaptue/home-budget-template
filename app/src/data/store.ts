import { computed, signal } from "@preact/signals";
import type { User } from "firebase/auth";
import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";
import { outflowId } from "../domain/outflow";
import type { Budget, Expense, ExpenseInput, Outflow, Scope } from "../domain/types";
import { auth, db } from "./firebase";
import { budgetFromDoc, expenseFields, expenseFromDoc, outflowFields, outflowFromDoc } from "./mapping";
import { keepSubscribed, trackPending } from "./sync";

export type Member = { name: string; photoURL: string };

export const budgets = signal<Budget[]>([]);
export const budgetsReady = signal(false);
export const expenses = signal<Expense[]>([]);
export const outflows = signal<Outflow[]>([]);
const pendingExpenses = signal(0);
const pendingOutflows = signal(0);
/** Deletes (expenses and ticks) not yet acknowledged: a deleted doc leaves the snapshot, so it is counted here. */
const pendingDeletes = signal(0);
/** Writes not yet acknowledged by the server (expenses + chequing ticks). */
export const pendingCount = computed(() => pendingExpenses.value + pendingOutflows.value + pendingDeletes.value);
export const members = signal<Record<string, Member>>({});
export const writeError = signal<string | null>(null);
export const syncError = signal<string | null>(null);
/** Outflows listener failure only; cleared as soon as that listener delivers again. */
export const outflowSyncError = signal<string | null>(null);
/** Set when Firestore refuses this account: access is decided by the security rules, not by the client. */
export const accessDenied = signal(false);

function describe(e: unknown): string {
  const code = (e as { code?: string }).code;
  if (code === "permission-denied") return "Tu n’as pas accès à ce carnet, ou la saisie a été refusée.";
  return "L’enregistrement a échoué. Vérifie ta connexion et réessaie.";
}
const report = (e: unknown) => {
  writeError.value = describe(e);
};
const syncFailed = (e: unknown) => {
  if ((e as { code?: string }).code === "permission-denied") {
    accessDenied.value = true;
    return;
  }
  syncError.value = "La synchronisation s’est arrêtée. Recharge l’app.";
};
// Never flips accessDenied: a refusal here (e.g. the outflows rules going live a few seconds after the app) must
// not lock the whole notebook behind the « privé » screen. Real refusals are caught by the budgets listener.
const outflowSyncFailed = (e: unknown) => {
  console.warn("outflows listener failed", (e as { code?: string }).code ?? e);
  outflowSyncError.value = "La synchronisation des coches « sorti » est interrompue. Nouvel essai dans 30 s.";
};
const OUTFLOW_RETRY_MS = 30_000;

/** Clears per-account state when the signed-in user changes. */
export function resetSession(): void {
  accessDenied.value = false;
  budgetsReady.value = false;
  budgets.value = [];
  expenses.value = [];
  outflows.value = [];
  members.value = {};
  writeError.value = null;
  syncError.value = null;
  outflowSyncError.value = null;
}
const nonNull = <T,>(x: T | null): x is T => x !== null;

export function watchBudgets(): () => void {
  return onSnapshot(collection(db, "budgets"), (snap) => {
    budgets.value = snap.docs.map((d) => budgetFromDoc(d.data())).filter(nonNull);
    budgetsReady.value = true;
  }, syncFailed);
}

export function watchYear(year: number): () => void {
  const q = query(collection(db, "expenses"), where("year", "==", year));
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    expenses.value = snap.docs.map((d) => expenseFromDoc(d.id, d.data())).filter(nonNull);
    pendingExpenses.value = snap.docs.filter((d) => d.metadata.hasPendingWrites).length;
  }, syncFailed);
}

/** Re-subscribes by itself after a failure, and clears its banner as soon as it delivers again. */
export function watchOutflows(year: number): () => void {
  const q = query(collection(db, "outflows"), where("year", "==", year));
  return keepSubscribed((fail) => onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    outflowSyncError.value = null;
    outflows.value = snap.docs.map((d) => outflowFromDoc(d.id, d.data())).filter(nonNull);
    pendingOutflows.value = snap.docs.filter((d) => d.metadata.hasPendingWrites).length;
  }, fail), outflowSyncFailed, OUTFLOW_RETRY_MS);
}

export function watchMembers(): () => void {
  return onSnapshot(collection(db, "members"), (snap) => {
    const out: Record<string, Member> = {};
    for (const d of snap.docs) {
      const m = d.data();
      out[d.id] = { name: String(m.name ?? ""), photoURL: String(m.photoURL ?? "") };
    }
    members.value = out;
  }, syncFailed);
}

export function registerMember(user: User): void {
  setDoc(doc(db, "members", user.uid), {
    name: (user.displayName ?? "").slice(0, 100),
    photoURL: (user.photoURL ?? "").slice(0, 2000),
  }).catch(report);
}

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}

/** Add (no id) or edit (id) an expense. Fire-and-forget: works offline. */
export function saveExpense(input: ExpenseInput, id?: string): void {
  if (id) {
    updateDoc(doc(db, "expenses", id), { ...expenseFields(input), updatedAt: serverTimestamp() }).catch(report);
    return;
  }
  const by = uid();
  if (!by) {
    writeError.value = "Tu n’es plus connecté. Reconnecte-toi pour enregistrer.";
    return;
  }
  const ref = doc(collection(db, "expenses"));
  setDoc(ref, { ...expenseFields(input), by, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch(report);
}

/** Create (or re-create) a check document with a deterministic id. */
export function setCheck(id: string, input: ExpenseInput): void {
  const by = uid();
  if (!by) {
    writeError.value = "Tu n’es plus connecté. Reconnecte-toi pour enregistrer.";
    return;
  }
  setDoc(doc(db, "expenses", id), {
    ...expenseFields(input), by, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }).catch(report);
}

export function removeExpense(id: string): void {
  trackPending(pendingDeletes, deleteDoc(doc(db, "expenses", id))).catch(report);
}

/** Tick « sorti du compte chèque ». Fire-and-forget: works offline. */
export function setOutflow(scope: Scope, period: string, item: string): void {
  const by = uid();
  if (!by) {
    writeError.value = "Tu n’es plus connecté. Reconnecte-toi pour enregistrer.";
    return;
  }
  setDoc(doc(db, "outflows", outflowId(scope, period, item)), {
    ...outflowFields(scope, period, item), by, createdAt: serverTimestamp(),
  }).catch(report);
}

export function removeOutflow(id: string): void {
  trackPending(pendingDeletes, deleteDoc(doc(db, "outflows", id))).catch(report);
}

import { monthlyItems } from "../app/src/domain/budget";
import type { Budget, Category, Envelope, Item, Nature } from "../app/src/domain/types";

const ID = /^[a-z0-9-]{1,60}$/;
const toCents = (dollars: number) => Math.round(dollars * 100);

export function parseBudgetFile(raw: unknown, fileName: string): Budget {
  const fail = (path: string, problem: string): never => {
    throw new Error(`${fileName}: ${path} ${problem}`);
  };
  const m = /^(\d{4}-(0[1-9]|1[0-2]))\.json$/.exec(fileName);
  if (!m) throw new Error(`${fileName}: expected file name YYYY-MM.json`);
  if (typeof raw !== "object" || raw === null) fail("", "must be an object");
  const obj = raw as Record<string, unknown>;

  const amount = (v: unknown, path: string, nullable: boolean): number | null => {
    if (v === null && nullable) return null;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) fail(path, "must be an amount ≥ 0");
    return toCents(v as number);
  };
  const text = (v: unknown, path: string): string => {
    if (typeof v !== "string" || v.trim() === "") fail(path, "must be a non-empty string");
    return v as string;
  };
  const id = (v: unknown, path: string): string => {
    const s = text(v, path);
    if (!ID.test(s)) fail(path, "must contain only a-z, 0-9 and -");
    return s;
  };
  const list = (v: unknown, path: string): unknown[] => {
    if (!Array.isArray(v)) fail(path, "must be a list");
    return v as unknown[];
  };
  const unique = (ids: string[], path: string) => {
    const seen = new Set<string>();
    for (const x of ids) {
      if (seen.has(x)) fail(path, `duplicate id "${x}"`);
      seen.add(x);
    }
  };

  const item = (v: unknown, path: string, allowMonthlyFlags: boolean): Item => {
    if (typeof v !== "object" || v === null) fail(path, "must be an object");
    const p = v as Record<string, unknown>;
    if (p.type !== "fixed" && p.type !== "variable") fail(`${path}.type`, "must be fixed or variable");
    const nature = (p.nature ?? "expense") as Nature;
    if (nature !== "expense" && nature !== "savings") fail(`${path}.nature`, "must be expense or savings");
    const out: Item = {
      id: id(p.id, `${path}.id`),
      label: text(p.label, `${path}.label`),
      budget: amount(p.budget, `${path}.budget`, true),
      type: p.type as Item["type"],
      nature,
    };
    if (p.manager !== undefined) {
      if (p.manager !== "I" && p.manager !== "H") fail(`${path}.manager`, "must be I or H");
      out.manager = p.manager as "I" | "H";
    }
    if (p.note !== undefined) out.note = text(p.note, `${path}.note`);
    if (p.leftoverToSavings !== undefined) {
      if (!allowMonthlyFlags) fail(`${path}.leftoverToSavings`, "not allowed for an annual item");
      if (p.leftoverToSavings !== true) fail(`${path}.leftoverToSavings`, "must be true");
      out.leftoverToSavings = true;
    }
    if (p.transferTo !== undefined) {
      if (!allowMonthlyFlags) fail(`${path}.transferTo`, "not allowed for an annual item");
      out.transferTo = id(p.transferTo, `${path}.transferTo`);
    }
    if (p.archived !== undefined) {
      if (p.archived !== true) fail(`${path}.archived`, "must be true");
      out.archived = true;
    }
    return out;
  };

  const category = (c: unknown, path: string): Category => {
    if (typeof c !== "object" || c === null) fail(path, "must be an object");
    const co = c as Record<string, unknown>;
    return {
      id: id(co.id, `${path}.id`),
      label: text(co.label, `${path}.label`),
      items: list(co.items, `${path}.items`).map((p, j) => item(p, `${path}.items[${j}]`, true)),
    };
  };

  const envelopes: Envelope[] = list(obj.envelopes, "envelopes").map((e, i) => {
    const path = `envelopes[${i}]`;
    if (typeof e !== "object" || e === null) fail(path, "must be an object");
    const eo = e as Record<string, unknown>;
    const out: Envelope = {
      id: id(eo.id, `${path}.id`),
      label: text(eo.label, `${path}.label`),
      income: amount(eo.income, `${path}.income`, false) as number,
      categories: list(eo.categories, `${path}.categories`).map((c, j) => category(c, `${path}.categories[${j}]`)),
    };
    if (eo.shortLabel !== undefined) {
      out.shortLabel = text(eo.shortLabel, `${path}.shortLabel`);
      if (out.shortLabel.length > 20) fail(`${path}.shortLabel`, "must be at most 20 characters");
    }
    return out;
  });
  if (envelopes.length === 0) fail("envelopes", "must not be empty");
  const annualItems = list(obj.annualItems, "annualItems").map((p, i) => item(p, `annualItems[${i}]`, false));

  const monthly = envelopes.flatMap((e) => e.categories.flatMap((c) => c.items));
  unique(envelopes.map((e) => e.id), "envelopes");
  unique(envelopes.flatMap((e) => e.categories.map((c) => c.id)), "categories");
  unique(monthly.map((p) => p.id), "monthly items");
  unique(annualItems.map((p) => p.id), "annualItems");

  const envelopeOfItem = new Map<string, string>();
  for (const e of envelopes) {
    for (const c of e.categories) {
      for (const p of c.items) envelopeOfItem.set(p.id, e.id);
    }
  }

  for (const p of monthly) {
    if (!p.transferTo) continue;
    const target = monthly.find((t) => t.id === p.transferTo);
    const sameEnvelope = target !== undefined && envelopeOfItem.get(target.id) === envelopeOfItem.get(p.id);
    if (!target || target.id === p.id || target.transferTo) fail(`item ${p.id}.transferTo`, "must target another monthly item that does not itself transfer");
    if (target?.archived) fail(`item ${p.id}.transferTo`, "must not target an archived item");
    if (sameEnvelope) fail(`item ${p.id}.transferTo`, "must target an item of another envelope");
    if (p.leftoverToSavings) fail(`item ${p.id}.leftoverToSavings`, "incompatible with transferTo");
  }

  const budget: Budget = { effectiveFrom: m[1]!, envelopes, annualItems };
  if (obj.annualNote !== undefined) budget.annualNote = text(obj.annualNote, "annualNote");
  return budget;
}

/** No silent deletion: for budget versions ordered by `effectiveFrom`, an item id (monthly or annual) present
 *  in an earlier version must still be present (possibly archived) in every later one. */
export function checkVersions(budgets: Budget[]): void {
  const sorted = [...budgets].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const ids = (b: Budget): Set<string> => new Set([...monthlyItems(b).map((p) => p.id), ...b.annualItems.map((p) => p.id)]);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const currIds = ids(curr);
    for (const itemId of ids(prev)) {
      if (!currIds.has(itemId)) {
        throw new Error(`${curr.effectiveFrom}.json: item "${itemId}" was removed — set "archived": true instead of deleting it`);
      }
    }
  }
}

export type Cents = number;

export type ItemType = "fixed" | "variable";

export type Nature = "expense" | "savings";

export interface Item {
  id: string;
  label: string;
  budget: Cents | null;
  type: ItemType;
  nature: Nature;
  manager?: "I" | "H";
  note?: string;
  /** Rest of a closed month (budget − spent, if positive) counts as savings. */
  leftoverToSavings?: true;
  /** Id of the monthly item that receives this item's budget every month. */
  transferTo?: string;
  /** No longer used; kept for history. Excluded from planned/budget figures, but its past expenses still count. */
  archived?: true;
}

export interface Category {
  id: string;
  label: string;
  items: Item[];
}

export interface Envelope {
  id: string;
  label: string;
  shortLabel?: string; // envelope tab / chip label, `label` when absent
  income: Cents;
  categories: Category[];
}

export interface Budget {
  effectiveFrom: string; // "YYYY-MM"
  envelopes: Envelope[];
  annualItems: Item[];
  annualNote?: string; // shown next to the annual charges title, e.g. where they are paid from
}

export type Scope = "monthly" | "annual";
export type ExpenseKind = "expense" | "check";

/** What the UI asks to save. month/year are derived from date. */
export interface ExpenseInput {
  kind: ExpenseKind;
  scope: Scope;
  item: string;
  amount: Cents;
  note: string;
  date: string; // "YYYY-MM-DD"
}

export interface Expense extends ExpenseInput {
  id: string;
  month: string; // "YYYY-MM"
  year: number;
  by: string; // Firebase uid
}

/** "This item's own budget has left the chequing account" for one period. Counts in no total. */
export interface Outflow {
  id: string;
  scope: Scope;
  item: string;
  period: string; // "YYYY-MM" (monthly) or "YYYY" (annual)
  year: number;
  by: string; // Firebase uid
}

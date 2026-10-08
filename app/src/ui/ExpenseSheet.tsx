import { useEffect, useRef, useState } from "preact/hooks";
import { annualBudgetFor, budgetFor, monthlyItems } from "../domain/budget";
import { centsToInput, MAX_AMOUNT, parseAmount } from "../domain/money";
import { defaultDate, isISODate, lastDayOfMonth } from "../domain/period";
import type { Budget, Item, Scope } from "../domain/types";
import { budgets, saveExpense } from "../data/store";
import { envelope, openRow, sheet, today, year, ym, type SheetState } from "./state";

function findItemIn(b: Budget | null | undefined, scope: Scope, id: string): Item | undefined {
  if (!b) return undefined;
  return scope === "annual" ? b.annualItems.find((p) => p.id === id) : monthlyItems(b).find((p) => p.id === id);
}

export function ExpenseSheet() {
  const s = sheet.value;
  if (!s) return null;
  return <SheetForm key={s.mode === "edit" ? s.expense.id : `new-${s.scope}-${s.item ?? ""}`} state={s} />;
}

function SheetForm({ state }: { state: NonNullable<SheetState> }) {
  const editing = state.mode === "edit" ? state.expense : null;
  const monthly = budgetFor(budgets.value, ym.value);
  const annual = annualBudgetFor(budgets.value, year.value);
  const scope: Scope = editing?.scope ?? (state.mode === "add" ? state.scope : "monthly");
  const period = scope === "annual" ? String(year.value) : ym.value;
  const isCheck = editing?.kind === "check";

  // One optgroup per envelope of the month's budget, selected envelope first,
  // containing every non-transferTo, non-archived item (fixed and variable); then annual items.
  // An archived item is never offered for a new entry — except when editing one already on it,
  // via the `extra` fallback below (same as an item absent from the current budget).
  const envelopeGroups = (monthly?.envelopes ?? [])
    .map((e) => ({
      id: e.id,
      label: e.label,
      items: e.categories.flatMap((c) => c.items).filter((p) => !p.transferTo && !p.archived),
    }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => (a.id === envelope.value ? -1 : b.id === envelope.value ? 1 : 0));
  const annualItems = (annual?.annualItems ?? []).filter((p) => !p.archived);

  // Keep the edited expense's item selectable even when it is no longer present in the current budget
  // (so editing it never shows a blank/missing option).
  let extra: Item | null = null;
  if (editing) {
    const alreadyListed =
      editing.scope === "annual"
        ? annualItems.some((p) => p.id === editing.item)
        : envelopeGroups.some((g) => g.items.some((p) => p.id === editing.item));
    if (!alreadyListed) {
      const currentBudget = editing.scope === "annual" ? annual : monthly;
      const found =
        findItemIn(currentBudget, editing.scope, editing.item) ??
        budgets.value.map((b) => findItemIn(b, editing.scope, editing.item)).find((p): p is Item => !!p);
      extra = found ?? { id: editing.item, label: editing.item, type: "variable", nature: "expense", budget: null };
    }
  }

  // Default item for "add" without one: honor the active scope.
  // Annual tab: first annual item, falling back to monthly only when there are no annual items.
  // Monthly: first variable item of the selected envelope, else the first option.
  const defaultItemKey = (): string => {
    if (scope === "annual") {
      const firstAnnual = annualItems[0];
      if (firstAnnual) return `annual:${firstAnnual.id}`;
    }
    const preferred = envelopeGroups.find((g) => g.id === envelope.value)?.items.find((p) => p.type === "variable");
    if (preferred) return `monthly:${preferred.id}`;
    const firstMonthly = envelopeGroups[0]?.items[0];
    if (firstMonthly) return `monthly:${firstMonthly.id}`;
    const firstAnnual = annualItems[0];
    return firstAnnual ? `annual:${firstAnnual.id}` : "";
  };

  let initialItemKey: string;
  if (editing) {
    initialItemKey = `${editing.scope}:${editing.item}`;
  } else if (state.mode === "add" && state.item) {
    initialItemKey = `${scope}:${state.item}`;
  } else {
    initialItemKey = defaultItemKey();
  }

  const [amount, setAmountText] = useState(editing ? centsToInput(editing.amount) : "");
  const [itemKey, setItemKey] = useState(initialItemKey);
  const [note, setNote] = useState(editing?.note ?? "");
  const [date, setDate] = useState(editing?.date ?? defaultDate(scope, period, today.value));
  const [error, setError] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  // A check's date must stay inside its period (the month or year it was checked for).
  const checkBounds =
    isCheck && editing
      ? editing.scope === "annual"
        ? { min: `${editing.year}-01-01`, max: `${editing.year}-12-31` }
        : { min: `${editing.month}-01`, max: lastDayOfMonth(editing.month) }
      : null;

  const close = () => (sheet.value = null);
  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!monthly && !annual) {
    return (
      <div class="scrim" onClick={(e) => e.target === e.currentTarget && close()}>
        <div class="sheet" role="dialog" aria-modal="true"><h3>Aucun budget pour cette période</h3>
          <div class="actions"><button type="button" onClick={close}>Fermer</button></div></div>
      </div>
    );
  }

  const submit = (e: Event) => {
    e.preventDefault();
    const cents = parseAmount(amount);
    if (cents === null || cents <= 0) {
      setError("Entre un montant supérieur à 0, par exemple 84,50.");
      amountRef.current?.focus();
      return;
    }
    if (cents > MAX_AMOUNT) {
      setError("Montant trop élevé (maximum 1 000 000 $).");
      amountRef.current?.focus();
      return;
    }
    if (!isISODate(date)) {
      setError("Choisis une date valide.");
      return;
    }
    if (isCheck && editing) {
      const withinPeriod = editing.scope === "annual" ? date.startsWith(String(editing.year)) : date.startsWith(editing.month);
      if (!withinPeriod) {
        setError("La date doit rester dans la période cochée.");
        return;
      }
    }
    const [sc, item] = itemKey.split(":") as [Scope, string];
    if (!item) {
      setError("Choisis un poste.");
      return;
    }
    saveExpense({ kind: editing?.kind ?? "expense", scope: sc, item, amount: cents, note: note.trim().slice(0, 80), date }, editing?.id);
    openRow(`${sc}:${item}`);
    close();
  };

  return (
    <div class="scrim" onClick={(e) => e.target === e.currentTarget && close()}>
      <form class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onSubmit={submit}>
        <h3 id="sheet-title">{editing ? "Modifier la dépense" : "Nouvelle dépense"}</h3>
        <div class="field">
          <label for="f-amount">Montant ($)</label>
          <input id="f-amount" ref={amountRef} class="money" inputMode="decimal" placeholder="0,00" autoComplete="off"
            value={amount} onInput={(e) => setAmountText(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label for="f-item">Poste</label>
          <select id="f-item" value={itemKey} disabled={isCheck} onChange={(e) => setItemKey(e.currentTarget.value)}>
            {envelopeGroups.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {g.items.map((p) => <option key={p.id} value={`monthly:${p.id}`}>{p.label}</option>)}
              </optgroup>
            ))}
            {annualItems.length ? (
              <optgroup label="Charges annuelles">
                {annualItems.map((p) => <option key={p.id} value={`annual:${p.id}`}>{p.label}</option>)}
              </optgroup>
            ) : null}
            {extra ? (
              <optgroup label="Autres">
                <option value={`${editing!.scope}:${extra.id}`}>{extra.label}</option>
              </optgroup>
            ) : null}
          </select>
        </div>
        <div class="two">
          <div class="field">
            <label for="f-note">Note</label>
            <input id="f-note" maxLength={80} placeholder="ex. épicerie, pharmacie" autoComplete="off" value={note} onInput={(e) => setNote(e.currentTarget.value)} />
          </div>
          <div class="field">
            <label for="f-date">Date</label>
            <input id="f-date" type="date" value={date} min={checkBounds?.min} max={checkBounds?.max}
              onInput={(e) => setDate(e.currentTarget.value)} />
          </div>
        </div>
        <div class="err" role="alert">{error}</div>
        <div class="actions">
          <button type="button" onClick={close}>Annuler</button>
          <button type="submit" class="primary">{editing ? "Enregistrer" : "Ajouter"}</button>
        </div>
      </form>
    </div>
  );
}

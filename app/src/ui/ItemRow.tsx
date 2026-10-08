import { useEffect, useState } from "preact/hooks";
import { itemNote } from "../domain/budget";
import { checkId, defaultDate, formatShortDate } from "../domain/period";
import { budgetStatus, sumAmounts } from "../domain/summary";
import type { Cents, Expense, Item, Scope } from "../domain/types";
import { removeExpense, setCheck } from "../data/store";
import { money } from "./amount";
import { CheckIcon, Meter, StatusPill, Who } from "./Common";
import { openRows, sheet, today, toggleRow } from "./state";

type Props = {
  item: Item;
  scope: Scope;
  period: string;
  entries: Expense[];
  budget: Cents | null;
  info?: string;
};

export function ItemLabel({ item, info }: { item: Item; info?: string }) {
  const note = itemNote(item);
  return (
    <>
      <b>
        {item.label}
        {item.manager ? <span class="mgr" title="Manager">{item.manager}</span> : null}
        {item.nature === "savings" ? <span class="badge-savings">épargne</span> : null}
        {item.archived ? <span class="badge-archived">archivé</span> : null}
      </b>
      {note ? <small>{note}</small> : null}
      {info ? <small>{info}</small> : null}
    </>
  );
}

export function ItemRow({ item, scope, period, entries, budget, info }: Props) {
  // An archived item with no entry in this period is never shown (nothing left to see).
  if (item.archived && entries.length === 0) return null;

  const key = `${scope}:${item.id}`;
  const open = openRows.value.has(key);
  const spent = sumAmounts(entries);
  const status = budgetStatus(spent, budget);
  const id = checkId(scope, period, item.id);
  const chk = item.type === "fixed" ? entries.find((e) => e.id === id) : undefined;

  const toggleCheck = (e: Event) => {
    e.stopPropagation();
    if (chk) removeExpense(id);
    else setCheck(id, { kind: "check", scope, item: item.id, amount: budget ?? 0, note: "", date: defaultDate(scope, period, today.value) });
  };

  const classes = ["row"];
  if (item.type === "variable") classes.push("var");
  if (chk) classes.push("done");
  if (status === "over") classes.push("over");
  if (item.archived) classes.push("archived");

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <div
        class={classes.join(" ")}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => toggleRow(key)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleRow(key);
          }
        }}
      >
        {item.type === "fixed" && !item.archived ? (
          <button
            class="chk"
            role="checkbox"
            aria-checked={!!chk}
            aria-label={`${item.label} payé`}
            onClick={toggleCheck}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") e.stopPropagation();
            }}
          >
            <CheckIcon />
          </button>
        ) : null}
        <div class="name">
          <ItemLabel item={item} info={info} />
          <div class="meta">
            <span class="num">{budget === null ? money(spent) : `${money(spent)} / ${money(budget)}`}</span>
            <StatusPill status={status} spent={spent} budget={budget ?? 0} />
          </div>
          {budget ? <Meter value={spent} max={budget} status={status} /> : null}
        </div>
        {item.archived ? null : (
          <button
            class="plus"
            aria-label={`Ajouter une dépense ${item.label}`}
            onClick={(e) => {
              e.stopPropagation();
              sheet.value = { mode: "add", scope, item: item.id };
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") e.stopPropagation();
            }}
          >+</button>
        )}
      </div>
      {open ? (
        <div class="entries">
          {sorted.length ? sorted.map((e) => <EntryLine key={e.id} entry={e} />) : <div class="empty">Aucune dépense pour l’instant.</div>}
        </div>
      ) : null}
    </>
  );
}

export function TransferRow({ item, target }: { item: Item; target: Item }) {
  return (
    <div class="row transfer">
      <div class="name"><small>{item.label} — {money(item.budget ?? 0)} versés à {target.label}</small></div>
    </div>
  );
}

function EntryLine({ entry }: { entry: Expense }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  const isCheck = entry.kind === "check";
  const label = isCheck ? ["Paiement coché", entry.note].filter(Boolean).join(" · ") : (entry.note || "—");
  return (
    <div class="entry">
      <button
        class="entry-main"
        aria-label={`Modifier ${isCheck ? "le paiement coché" : entry.note || "la dépense"} du ${formatShortDate(entry.date)}`}
        onClick={() => (sheet.value = { mode: "edit", expense: entry })}
      >
        <span class="d num">{formatShortDate(entry.date)}</span>
        <span class="n"><Who uid={entry.by} /> {label}</span>
        <span class="num">{money(entry.amount)}</span>
      </button>
      <button
        class={armed ? "x confirm" : "x"}
        aria-label={isCheck ? "Décocher ce paiement" : "Supprimer cette dépense"}
        onClick={() => (armed ? removeExpense(entry.id) : setArmed(true))}
      >
        {armed ? (isCheck ? "Décocher" : "Supprimer") : "✕"}
      </button>
    </div>
  );
}

import { budgetFor, categoryBudget, effectiveBudget, envelopeOfItem, findItem, sourcesOf } from "../domain/budget";
import { monthLabel } from "../domain/period";
import {
  budgetStatus, envelopeSummary, isMonthClosed, leftoverSaved, monthExpenses, projectedLeftover, sumAmounts,
} from "../domain/summary";
import type { Budget, Item } from "../domain/types";
import { budgets, expenses } from "../data/store";
import { money } from "./amount";
import { Notice, Summary, type SummaryStat } from "./Common";
import { ChequingMonth, LedgerSwitch } from "./ChequingView";
import { ItemRow, TransferRow } from "./ItemRow";
import { chipLabel } from "./labels";
import { envelope, ledger, selectEnvelope, today, ym } from "./state";

/** "l’Appoint" (vowel-led short label) or "Secondaire" (as-is), for the transfer info line. */
function withArticle(label: string): string {
  return /^[aeiouéèàâîôûAEIOUÉÈÀÂÎÔÛ]/.test(label) ? `l’${label}` : label;
}

function itemInfo(b: Budget, p: Item, ymValue: string, todayValue: string): string | undefined {
  // An archived source no longer transfers, and leftoverToSavings no longer applies once archived.
  const sources = sourcesOf(b, p.id).filter((x) => !x.archived);
  if (sources.length) {
    const total = sources.reduce((s, x) => s + (x.budget ?? 0), 0);
    const srcEnv = envelopeOfItem(b, sources[0]!.id);
    const label = srcEnv ? withArticle(chipLabel(srcEnv)) : "";
    return `dont ${money(total)} de ${label}`;
  }
  if (p.leftoverToSavings && !p.archived) {
    if (isMonthClosed(ymValue, todayValue)) {
      return `reste → épargne : ${money(leftoverSaved(b, p, expenses.value, ymValue, todayValue))}`;
    }
    return `reste prévu : ${money(projectedLeftover(b, p, expenses.value, ymValue))}`;
  }
  return undefined;
}

export function MonthView() {
  const b = budgetFor(budgets.value, ym.value);
  if (!b) return <Notice>Aucun budget pour {monthLabel(ym.value)}.</Notice>;

  const selectedId = b.envelopes.some((e) => e.id === envelope.value) ? envelope.value : b.envelopes[0]?.id;
  const env = b.envelopes.find((e) => e.id === selectedId) ?? b.envelopes[0];
  if (!env) return <Notice>Aucune enveloppe pour {monthLabel(ym.value)}.</Notice>;

  const list = monthExpenses(expenses.value, ym.value);
  const s = envelopeSummary(b, env, expenses.value, ym.value, today.value);
  const expenseItems = env.categories.flatMap((c) => c.items).filter((p) => !p.transferTo && p.nature === "expense");
  const budgetY = expenseItems.reduce((sum, p) => sum + (effectiveBudget(b, p) ?? 0), 0);

  const stats: SummaryStat[] = [
    {
      label: "Revenu",
      value: s.received > 0 ? `${money(s.income)} (dont ${money(s.received)} reçus)` : money(s.income),
    },
    {
      label: "Épargné",
      value: s.leftoverSaved > 0
        ? `${money(s.savings)} (dont ${money(s.leftoverSaved)} reporté)`
        : money(s.savings),
    },
    ...(s.transferred > 0 ? [{ label: "Versé", value: money(s.transferred) }] : []),
    { label: "Reste", value: money(Math.abs(s.remaining)), tone: s.remaining < 0 ? "neg" as const : undefined },
    { label: "Postes fixes payés", value: `${s.fixedPaid} / ${s.fixedTotal}` },
  ];

  return (
    <>
      <div class="chips" role="tablist" style={{ gridTemplateColumns: `repeat(${b.envelopes.length}, 1fr)` }}>
        {b.envelopes.map((e) => (
          <button key={e.id} role="tab" aria-selected={e.id === env.id} onClick={() => selectEnvelope(e.id)}>
            {chipLabel(e)}
          </button>
        ))}
      </div>
      <LedgerSwitch />
      {ledger.value === "chequing" ? (
        <ChequingMonth b={b} env={env} period={ym.value} />
      ) : (
        <>
          <Summary spent={s.expenses} budget={budgetY} status={budgetStatus(s.expenses, budgetY)} stats={stats} />
          {env.categories.map((c) => {
            const catList = list.filter((e) => c.items.some((p) => p.id === e.item));
            return (
              <section class="cat" key={c.id}>
                <div class="cathead">
                  <h3>{c.label}</h3>
                  <span class="num">{money(sumAmounts(catList))} / {money(categoryBudget(b, c))}</span>
                </div>
                <div class="list">
                  {c.items.map((p) =>
                    p.transferTo ? (
                      // An archived transfer source no longer transfers anything (see effectiveBudget/envelopeSummary);
                      // its row would only mislead, so it is hidden like any other archived item with no entry.
                      p.archived ? null : <TransferRow key={p.id} item={p} target={findItem(b, p.transferTo)!} />
                    ) : (
                      <ItemRow
                        key={p.id}
                        item={p}
                        scope="monthly"
                        period={ym.value}
                        entries={catList.filter((e) => e.item === p.id)}
                        budget={effectiveBudget(b, p)}
                        info={itemInfo(b, p, ym.value, today.value)}
                      />
                    ),
                  )}
                </div>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}

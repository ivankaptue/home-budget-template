import { annualBudgetFor } from "../domain/budget";
import { annualExpenses, annualSummary, budgetStatus } from "../domain/summary";
import { budgets, expenses } from "../data/store";
import { money } from "./amount";
import { Notice, Summary, type SummaryStat } from "./Common";
import { ChequingAnnual, LedgerSwitch } from "./ChequingView";
import { ItemRow } from "./ItemRow";
import { ledger, year } from "./state";

export function AnnualView() {
  const b = annualBudgetFor(budgets.value, year.value);
  if (!b) return <Notice>Aucun budget pour {year.value}.</Notice>;
  const list = annualExpenses(expenses.value, year.value);
  const s = annualSummary(b, expenses.value, year.value);
  const stats: SummaryStat[] = [
    { label: "Épargné", value: money(s.savings) },
    ...(s.undefinedCount ? [{ label: "À définir", value: `${s.undefinedCount} postes` }] : []),
  ];
  return (
    <>
      <LedgerSwitch />
      {ledger.value === "chequing" ? (
        <ChequingAnnual b={b} year={year.value} />
      ) : (
        <>
          <Summary spent={s.spent} budget={s.budget} status={budgetStatus(s.spent, s.budget)} stats={stats} />
          <section class="cat">
            <div class="cathead">
              <h3>Payées une fois par an</h3>
              {b.annualNote ? <span class="num">{b.annualNote}</span> : null}
            </div>
            <div class="list">
              {b.annualItems.map((p) => (
                <ItemRow
                  key={p.id}
                  item={p}
                  scope="annual"
                  period={String(year.value)}
                  entries={list.filter((e) => e.item === p.id)}
                  budget={p.archived ? null : p.budget}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

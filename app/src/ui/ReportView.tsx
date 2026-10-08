import { useState } from "preact/hooks";
import { budgetStatus, computeReport } from "../domain/summary";
import type { Cents } from "../domain/types";
import { budgets, expenses } from "../data/store";
import { money } from "./amount";
import { BarChart, type ChartMonth } from "./BarChart";
import { Meter, Notice, StatusPill } from "./Common";
import { chipLabel } from "./labels";
import { today, year } from "./state";

const ALL = "__all__";

function Signed({ v }: { v: Cents }) {
  return <span class={v < 0 ? "neg" : undefined}>{v < 0 ? "−" : v > 0 ? "+" : ""}{money(Math.abs(v))}</span>;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div class="kpi">
      <span class="lbl">{label}</span>
      <span class="v num">{value}</span>
      <small>{sub}</small>
    </div>
  );
}

export function ReportView() {
  const [filter, setFilter] = useState<string>(ALL);
  const b = computeReport(budgets.value, expenses.value, year.value, today.value);
  const n = b.trackedCount;

  const chipEnvelopes = b.envelopes.filter((e) => e.id !== "autres");
  const selected = filter !== ALL && chipEnvelopes.some((e) => e.id === filter) ? filter : ALL;
  const chartMonths: ChartMonth[] = b.months.map((m) => ({
    ym: m.ym,
    tracked: m.tracked,
    spent: selected === ALL ? m.total : m.expenses[selected] ?? 0,
    budget: selected === ALL ? m.budgetTotal : m.budget[selected] ?? 0,
  }));

  const cardEnvelopes = [...b.envelopes.filter((e) => e.id !== "autres"), ...b.envelopes.filter((e) => e.id === "autres")];

  // Expense-only plan: same basis as the chart's dashed budget line (sum of tracked months' budgetTotal).
  const trackedPlanned = b.months.filter((m) => m.tracked).reduce((s, m) => s + m.budgetTotal, 0);

  const savingsTotal = b.totals.savings + b.annual.savings;
  const savingsSub = [
    b.totals.leftoverSaved > 0 ? `dont ${money(b.totals.leftoverSaved)} reporté` : null,
    b.annual.savings > 0 ? `dont ${money(b.annual.savings)} charges annuelles` : null,
  ].filter((x): x is string => x !== null);

  return (
    <>
      {n === 0 && b.annual.spent === 0 ? <Notice>Aucune dépense enregistrée en {b.year}. Le bilan se remplira au fil des mois.</Notice> : null}
      <div class="kpis">
        <Kpi
          label={`Dépenses ${b.year}`}
          value={money(b.totals.expenses)}
          sub={n ? `prévu ${money(trackedPlanned)} sur ${n} mois` : "aucun mois suivi"}
        />
        <Kpi
          label={`Épargne ${b.year}`}
          value={money(savingsTotal)}
          sub={savingsSub.length ? savingsSub.join(" · ") : "—"}
        />
        <Kpi
          label="Charges annuelles"
          value={money(b.annual.spent)}
          sub={`budget ${money(b.annual.budget)}${b.annual.savings > 0 ? ` · dont ${money(b.annual.savings)} épargne` : ""}`}
        />
      </div>

      <section class="card">
        <h3>Dépenses par mois</h3>
        <p class="sub">Hors épargne et charges annuelles · trait pointillé = budget du mois</p>
        <div class="chips" role="tablist" style={{ gridTemplateColumns: `repeat(${chipEnvelopes.length + 1}, 1fr)` }}>
          <button role="tab" aria-selected={selected === ALL} onClick={() => setFilter(ALL)}>Toutes</button>
          {chipEnvelopes.map((e) => (
            <button key={e.id} role="tab" aria-selected={selected === e.id} onClick={() => setFilter(e.id)}>{chipLabel(e)}</button>
          ))}
        </div>
        <BarChart months={chartMonths} />
        <div class="legend">
          <span><i />Dépensé</span>
          <span><i class="line" />Budget mensuel</span>
        </div>
      </section>

      {cardEnvelopes.map((env) => {
        // Categories mix expense and savings items: status/meter/mark use expense-nature lines only,
        // so a savings overshoot never turns a category red.
        const expenseOf = (c: (typeof env.categories)[number]) => c.items.filter((it) => it.nature === "expense");
        const savingsOf = (c: (typeof env.categories)[number]) => c.items.filter((it) => it.nature === "savings");
        const sumOf = (items: (typeof env.categories)[number]["items"], key: "budget" | "spent") =>
          items.reduce((s, it) => s + it[key], 0);
        const maxCat = Math.max(1, ...env.categories.map((c) => Math.max(sumOf(expenseOf(c), "budget"), sumOf(expenseOf(c), "spent"))));
        return (
          <section class="card" key={env.id}>
            <h3>{env.label}</h3>
            <p class="sub">
              Prévu {money(env.planned)} · Dépensé {money(env.expenses)} · Épargné {money(env.savings)}
              {env.transferred > 0 ? ` · Versé ${money(env.transferred)}` : ""} · Reste {money(env.remaining)}
            </p>
            <div class="catrows">
              {env.categories.map((c) => {
                const expBudget = sumOf(expenseOf(c), "budget");
                const expSpent = sumOf(expenseOf(c), "spent");
                const savBudget = sumOf(savingsOf(c), "budget");
                const savSpent = sumOf(savingsOf(c), "spent");
                const status = budgetStatus(expSpent, expBudget);
                return (
                  <div class="catrow" key={c.id}>
                    <div class="top">
                      <b>{c.label}</b>
                      <span><span class="num">{money(expSpent)} / {money(expBudget)}</span> <StatusPill status={status} spent={expSpent} budget={expBudget} /></span>
                    </div>
                    {savBudget > 0 || savSpent > 0 ? (
                      <div style={{ fontSize: "12.5px", color: "var(--muted)" }}>dont épargne {money(savSpent)} / {money(savBudget)}</div>
                    ) : null}
                    <div style={{ position: "relative" }}>
                      <Meter value={expSpent} max={maxCat} status={status} />
                      {expBudget ? <span class="mark" style={{ position: "absolute", top: "-3px", bottom: "-3px", width: "2px", background: "var(--ink-2)", left: `calc(${(expBudget / maxCat) * 100}% - 1px)` }} /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section class="card">
        <details>
          <summary>Détail par poste</summary>
          <div class="tablewrap">
            <table>
              <thead><tr><th>Poste</th><th>Budget</th><th>Réel</th><th>Écart</th></tr></thead>
              <tbody>
                {cardEnvelopes.flatMap((env) => {
                  const envBudget = env.categories.reduce((s, c) => s + c.budget, 0);
                  const envSpent = env.categories.reduce((s, c) => s + c.spent, 0);
                  return [
                    <tr class="catline" key={env.id}><td>{env.label}</td><td class="num">{money(envBudget)}</td><td class="num">{money(envSpent)}</td><td class="num"><Signed v={envBudget - envSpent} /></td></tr>,
                    ...env.categories.flatMap((c) => [
                      <tr class="catline" key={`${env.id}-${c.id}`}><td>{c.label}</td><td class="num">{money(c.budget)}</td><td class="num">{money(c.spent)}</td><td class="num"><Signed v={c.budget - c.spent} /></td></tr>,
                      ...c.items.map((p) => (
                        <tr key={`${env.id}-${c.id}-${p.id}`}>
                          <td>
                            {p.label}
                            {p.nature === "savings" ? <span class="badge-savings">épargne</span> : null}
                            {p.archived ? <span class="badge-archived">archivé</span> : null}
                          </td>
                          <td class="num">{money(p.budget)}</td><td class="num">{money(p.spent)}</td><td class="num"><Signed v={p.budget - p.spent} /></td>
                        </tr>
                      )),
                    ]),
                  ];
                })}
                <tr class="catline"><td>Charges annuelles</td><td class="num">{money(b.annual.budget)}</td><td class="num">{money(b.annual.spent)}</td><td class="num"><Signed v={b.annual.budget - b.annual.spent} /></td></tr>
                {b.annual.lines.map((l) => (
                  <tr key={`a-${l.id}`}>
                    <td>{l.label}{l.archived ? <span class="badge-archived">archivé</span> : null}</td>
                    <td class="num">{l.budget === null ? "à définir" : money(l.budget)}</td><td class="num">{money(l.spent)}</td><td class="num">{l.budget === null ? "—" : <Signed v={l.budget - l.spent} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </>
  );
}

import { findItem } from "../domain/budget";
import { outflowId, outflowLines, outflowSummary, tickedItems, type OutflowLine, type OutflowSummary } from "../domain/outflow";
import type { Budget, Envelope, Scope } from "../domain/types";
import { outflows, removeOutflow, setOutflow } from "../data/store";
import { money } from "./amount";
import { CheckIcon, Meter, Notice, Stat } from "./Common";
import { ItemLabel } from "./ItemRow";
import { ledger, selectLedger, type Ledger } from "./state";

const LEDGERS: [Ledger, string][] = [["expenses", "Dépenses"], ["chequing", "Compte chèque"]];

export function LedgerSwitch() {
  return (
    <div class="chips ledger" role="tablist" aria-label="Affichage" style={{ gridTemplateColumns: "1fr 1fr" }}>
      {LEDGERS.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={ledger.value === id} onClick={() => selectLedger(id)}>{label}</button>
      ))}
    </div>
  );
}

/** Neutral on purpose: ticking is optional, so this meter never turns orange or red. */
function OutflowSummaryCard({ out, total, left }: OutflowSummary) {
  return (
    <section class="summary">
      <div class="sumrow">
        <div class="stat">
          <span class="lbl">Sorti du compte chèque</span>
          <div>
            <span class="big num">{money(out)}</span> <span class="of num">/ {money(total)}</span>
          </div>
        </div>
        <Stat label="À sortir" value={money(left)} />
      </div>
      <Meter value={out} max={total} status={null} what="sorti du compte chèque" />
    </section>
  );
}

function OutflowRow({ line, scope, period, ticked, target }: {
  line: OutflowLine; scope: Scope; period: string; ticked: boolean; target?: string;
}) {
  const { item, amount } = line;
  const toggle = () => (ticked ? removeOutflow(outflowId(scope, period, item.id)) : setOutflow(scope, period, item.id));
  return (
    <div
      class={ticked ? "row out done" : "row out"}
      role="checkbox"
      aria-checked={ticked}
      aria-label={`${item.label}, ${money(amount)} sorti du compte chèque`}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault(); // Space must not scroll the page
          toggle();
        }
      }}
    >
      <span class="chk" aria-hidden="true"><CheckIcon /></span>
      <div class="name">
        <ItemLabel item={item} info={target ? `→ ${target}` : undefined} />
      </div>
      <span class="num">{money(amount)}</span>
    </div>
  );
}

function OutflowSection({ b, title, lines, scope, period }: {
  b: Budget; title: string; lines: OutflowLine[]; scope: Scope; period: string;
}) {
  const s = outflowSummary(lines, outflows.value, scope, period);
  const ticked = tickedItems(outflows.value, scope, period);
  return (
    <section class="cat">
      <div class="cathead">
        <h3>{title}</h3>
        <span class="num">{money(s.out)} / {money(s.total)}</span>
      </div>
      <div class="list">
        {lines.map((l) => (
          <OutflowRow
            key={l.item.id}
            line={l}
            scope={scope}
            period={period}
            ticked={ticked.has(l.item.id)}
            // A missing target (budget edited) simply shows no arrow.
            target={l.item.transferTo ? findItem(b, l.item.transferTo)?.label : undefined}
          />
        ))}
      </div>
    </section>
  );
}

export function ChequingMonth({ b, env, period }: { b: Budget; env: Envelope; period: string }) {
  const all = outflowLines(env.categories.flatMap((c) => c.items));
  return (
    <>
      <OutflowSummaryCard {...outflowSummary(all, outflows.value, "monthly", period)} />
      {env.categories.map((c) => {
        const lines = outflowLines(c.items);
        return lines.length ? (
          <OutflowSection key={c.id} b={b} title={c.label} lines={lines} scope="monthly" period={period} />
        ) : null;
      })}
    </>
  );
}

export function ChequingAnnual({ b, year }: { b: Budget; year: number }) {
  const period = String(year);
  const lines = outflowLines(b.annualItems);
  if (!lines.length) return <Notice>Aucune charge annuelle avec un budget.</Notice>;
  return (
    <>
      <OutflowSummaryCard {...outflowSummary(lines, outflows.value, "annual", period)} />
      <OutflowSection b={b} title="Payées une fois par an" lines={lines} scope="annual" period={period} />
    </>
  );
}

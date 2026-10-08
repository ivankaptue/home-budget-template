import type { ComponentChildren } from "preact";
import type { Status } from "../domain/summary";
import type { Cents } from "../domain/types";
import { members } from "../data/store";
import { money } from "./amount";

export function Meter({ value, max, status, what = "du budget utilisé" }: { value: Cents; max: Cents; status: Status; what?: string }) {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const cls = status === "over" ? "meter over" : status === "warn" ? "meter warn" : "meter";
  return (
    <div class={cls} role="img" aria-label={`${Math.round(width)} % ${what}`}>
      <i style={{ width: `${width}%` }} />
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "neg" }) {
  return (
    <div class="stat">
      <span class="lbl">{label}</span>
      <span class={tone === "neg" ? "v num neg" : "v num"}>{value}</span>
    </div>
  );
}

export interface SummaryStat {
  label: string;
  value: string;
  tone?: "neg";
}

export function Summary({ spent, budget, status, stats }: { spent: Cents; budget: Cents; status: Status; stats: SummaryStat[] }) {
  return (
    <section class="summary">
      <div class="sumrow">
        <div class="stat">
          <span class="lbl">Dépensé</span>
          <div>
            <span class="big num">{money(spent)}</span> <span class="of num">/ {money(budget)}</span>
          </div>
        </div>
        {stats.map((s) => <Stat key={s.label} label={s.label} value={s.value} tone={s.tone} />)}
      </div>
      <Meter value={spent} max={budget} status={status} />
    </section>
  );
}

export function StatusPill({ status, spent, budget }: { status: Status; spent: Cents; budget: Cents }) {
  if (status === "over") return <span class="pill over">▲ +{money(spent - budget)}</span>;
  if (status === "warn") return <span class="pill warn">● {Math.round((spent / budget) * 100)} %</span>;
  if (status === "ok") return <span class="pill ok">{Math.round((spent / budget) * 100)} %</span>;
  return null;
}

export function Who({ uid }: { uid: string }) {
  const m = members.value[uid];
  const name = m?.name || "Quelqu’un";
  if (m?.photoURL) return <img class="av" src={m.photoURL} alt={name} title={name} referrerpolicy="no-referrer" />;
  return <span class="av" title={name} aria-label={name}>{(m?.name || "?").charAt(0).toUpperCase()}</span>;
}

export function Notice({ children }: { children: ComponentChildren }) {
  return <div class="notice">{children}</div>;
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  );
}

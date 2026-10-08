import { useEffect, useRef, useState } from "preact/hooks";
import { MONTH_NAMES, MONTH_SHORT } from "../domain/period";
import { niceStep } from "../domain/scale";
import type { Cents } from "../domain/types";
import { money } from "./amount";
import { hideAmounts } from "./state";

export interface ChartMonth { ym: string; spent: Cents; budget: Cents; tracked: boolean }

const H = 220;
const M = { t: 18, r: 8, b: 26, l: 48 };

function tickLabel(cents: number): string {
  if (hideAmounts.value) return "";
  const dollars = cents / 100;
  return dollars >= 1000 ? `${(dollars / 1000).toLocaleString("fr-CA")} k` : String(dollars);
}

export function BarChart({ months }: { months: ChartMonth[] }) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(300, Math.round(entry!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const iw = width - M.l - M.r;
  const ih = H - M.t - M.b;
  const maxV = Math.max(1, ...months.map((m) => Math.max(m.spent, m.budget))) * 1.1;
  const step = niceStep(maxV / 4);
  const top = Math.ceil(maxV / step) * step;
  const y = (v: number) => M.t + ih - (v / top) * ih;
  const bw = iw / 12;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 0.5; v += step) ticks.push(v);

  const hovered = hover === null ? null : months[hover]!;
  return (
    <div class="chart" ref={host}>
      <svg viewBox={`0 0 ${width} ${H}`} role="img" aria-label="Dépenses par mois comparées au budget mensuel">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={width - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" stroke-width={v === 0 ? 1.2 : 1} />
            <text x={M.l - 6} y={y(v) + 4} text-anchor="end">{tickLabel(v)}</text>
          </g>
        ))}
        {months.map((m, i) => {
          const cx = M.l + i * bw + bw / 2;
          const w = Math.min(28, bw - 6);
          const y0 = y(m.spent);
          const y1 = y(0);
          const r = Math.min(4, (y1 - y0) / 2, w / 2);
          const x0 = cx - w / 2;
          const over = m.budget > 0 && m.spent > m.budget;
          return (
            <g key={m.ym}>
              <text x={cx} y={H - 8} text-anchor="middle">{MONTH_SHORT[i]}</text>
              {m.budget > 0 ? (
                <line x1={M.l + i * bw + 2} x2={M.l + (i + 1) * bw - 2} y1={y(m.budget)} y2={y(m.budget)} stroke="var(--ink-2)" stroke-width="2" stroke-dasharray="5 4" />
              ) : null}
              {m.tracked && m.spent > 0 ? (
                <path
                  d={`M${x0},${y1} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + w - r} Q${x0 + w},${y0} ${x0 + w},${y0 + r} V${y1} Z`}
                  fill={over ? "var(--over)" : "var(--bar)"}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              ) : null}
              {over ? <text x={cx} y={y0 - 5} text-anchor="middle" style={{ fill: "var(--over)" }}>▲</text> : null}
              {m.tracked ? (
                <rect
                  x={M.l + i * bw} y={M.t} width={bw} height={ih} fill="transparent" {...{ tabindex: 0 }}
                  aria-label={`${MONTH_NAMES[i]} : ${money(m.spent)}, budget ${money(m.budget)}`}
                  onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      {hovered && hover !== null ? (
        <div
          class="tip"
          style={{
            left: `${Math.min(Math.max(((M.l + hover * bw + bw / 2) / width) * 100, 18), 82)}%`,
            top: `${(y(Math.max(hovered.spent, hovered.budget)) / H) * 100}%`,
          }}
        >
          <div><strong>{money(hovered.spent)}</strong></div>
          <div>{MONTH_NAMES[hover]} · budget {money(hovered.budget)}</div>
          <div>{hovered.spent > hovered.budget ? `▲ ${money(hovered.spent - hovered.budget)} au-dessus` : `${money(hovered.budget - hovered.spent)} sous le budget`}</div>
        </div>
      ) : null}
    </div>
  );
}

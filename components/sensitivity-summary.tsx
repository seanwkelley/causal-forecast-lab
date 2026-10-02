"use client";

import type { AggregateMetrics, ProbeResult } from "@/lib/types";
import { describeProbe, logitShift } from "@/lib/probes";
import { cn, formatPp, mean } from "@/lib/utils";

const CONTROL_THRESHOLD = 0.05;

function PairBars({
  rows,
  scale,
}: {
  rows: Array<{ label: string; value: number | null; strong?: boolean }>;
  scale: number;
}) {
  return (
    <dl className="mt-3 space-y-2">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <dt className="text-ink-2">{r.label}</dt>
            <dd className="num text-ink">{r.value != null ? formatPp(r.value) : "—"}</dd>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-surface-2">
            {r.value != null && (
              <div
                className={cn("h-full rounded-full", r.strong ? "bg-accent" : "bg-ink-3")}
                style={{ width: `${Math.min(100, (r.value / scale) * 100)}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </dl>
  );
}

function Block({
  title,
  value,
  children,
  caption,
}: {
  title: string;
  value: React.ReactNode;
  children: React.ReactNode;
  caption: string;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-rule bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-medium text-ink">{title}</h4>
        <span className="num text-xl font-semibold text-ink">{value}</span>
      </div>
      {children}
      <p className="mt-auto pt-3 text-xs leading-relaxed text-ink-3">{caption}</p>
    </div>
  );
}

export function SensitivitySummary({
  metrics,
  results,
  initialProbability,
}: {
  metrics: AggregateMetrics;
  results: ProbeResult[];
  initialProbability: number;
}) {
  const scored = results.filter((r) => r.updated_probability != null && r.absolute_shift != null);
  const controls = scored.filter((r) => describeProbe(r).kind === "control");
  const controlMoved = controls.filter((r) => r.absolute_shift! > CONTROL_THRESHOLD);

  const meanAbs = mean(scored.map((r) => r.absolute_shift!));
  const meanLogit = mean(
    scored.map((r) => Math.abs(logitShift(initialProbability, r.updated_probability!)))
  );

  const strNeg =
    metrics.mean_shift_negate > 0 ? metrics.mean_shift_strengthen / metrics.mean_shift_negate : null;
  const scale = Math.max(
    0.05,
    metrics.mean_shift_high,
    metrics.mean_shift_low,
    metrics.mean_shift_strengthen,
    metrics.mean_shift_negate
  );

  return (
    <section aria-labelledby="summary-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 id="summary-heading" className="font-display text-xl text-ink">
          What moved the forecast
        </h3>
        {meanAbs != null && (
          <p className="text-xs text-ink-2">
            Average shift across {scored.length} probes:{" "}
            <span className="num text-ink">{formatPp(meanAbs)}</span>
            {meanLogit != null && (
              <>
                {" "}
                · <span className="num text-ink">{meanLogit.toFixed(2)}</span> in log-odds
              </>
            )}
          </p>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Block
          title="Structural sensitivity ratio"
          value={metrics.ssr != null ? `${metrics.ssr.toFixed(2)}×` : "—"}
          caption="Central ÷ peripheral. Above 1× means probes aimed at the most central factors and shortest-path links moved the forecast more than probes aimed at peripheral ones."
        >
          <PairBars
            scale={scale}
            rows={[
              { label: "Central targets", value: metrics.mean_shift_high, strong: true },
              { label: "Peripheral targets", value: metrics.mean_shift_low },
            ]}
          />
        </Block>
        <Block
          title="Strengthen vs. negate"
          value={strNeg != null ? `${strNeg.toFixed(2)}×` : "—"}
          caption="Above 1× means evidence reinforcing the model's causal story moved the forecast more than evidence challenging it."
        >
          <PairBars
            scale={scale}
            rows={[
              { label: "Strengthen probes", value: metrics.mean_shift_strengthen, strong: true },
              { label: "Negate probes", value: metrics.mean_shift_negate },
            ]}
          />
        </Block>
        <Block
          title="Control probes"
          value={
            controls.length > 0 ? (
              <>
                {controlMoved.length}
                <span className="text-sm font-normal text-ink-3"> of {controls.length}</span>
              </>
            ) : (
              "—"
            )
          }
          caption={`Irrelevant information should leave the forecast where it was. Counts the control probes that moved it by more than ${CONTROL_THRESHOLD * 100}pp.`}
        >
          <ul className="mt-3 space-y-2">
            {controls.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-ink-2">Control {i + 1}</span>
                <span
                  className={cn(
                    "num rounded px-1.5 py-0.5",
                    r.absolute_shift! > CONTROL_THRESHOLD ? "bg-warn-soft text-warn" : "text-ink"
                  )}
                >
                  {formatPp(r.absolute_shift!)}
                </span>
              </li>
            ))}
            {controls.length === 0 && <li className="text-xs text-ink-3">No control probes in this run.</li>}
          </ul>
        </Block>
      </div>
    </section>
  );
}

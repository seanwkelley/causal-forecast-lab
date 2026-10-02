"use client";

import { Fragment, useMemo, useState } from "react";
import type { ProbeResult } from "@/lib/types";
import {
  KIND_META,
  KIND_ORDER,
  type ProbeKind,
  describeProbe,
  logitShift,
  targetLabel,
} from "@/lib/probes";
import { cn, deltaClass, formatDelta, formatPp, formatProbability, formatSigned, mean } from "@/lib/utils";

type Order = "design" | "shift";

interface Row {
  index: number;
  r: ProbeResult;
  kind: ProbeKind;
  action: string;
  tierLabel?: string;
  order: number;
  target: string;
  p1: number | null;
  delta: number | null;
  dLogit: number | null;
}

function niceTicks(lo: number, hi: number): number[] {
  const span = hi - lo;
  const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25];
  const step = steps.find((s) => span / s <= 5) ?? 0.25;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step - 1e-9) * step; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return ticks;
}

function domainFor(p0: number, values: number[]): [number, number] {
  const all = [p0, ...values];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  const pad = Math.max(0.02, (hi - lo) * 0.08);
  lo = Math.max(0, lo - pad);
  hi = Math.min(1, hi + pad);
  if (hi - lo < 0.12) {
    const mid = (hi + lo) / 2;
    lo = Math.max(0, mid - 0.06);
    hi = Math.min(1, lo + 0.12);
    lo = Math.max(0, hi - 0.12);
  }
  return [lo, hi];
}

function Track({ p0, p1, lo, hi, ticks }: { p0: number; p1: number | null; lo: number; hi: number; ticks: number[] }) {
  const x = (p: number) => `${((p - lo) / (hi - lo)) * 100}%`;
  const up = p1 != null && p1 > p0 + 0.0005;
  const down = p1 != null && p1 < p0 - 0.0005;
  return (
    <span className="relative block h-5 w-full" aria-hidden>
      {ticks.map((t) => (
        <span key={t} className="absolute inset-y-0.5 w-px bg-rule" style={{ left: x(t) }} />
      ))}
      <span className="absolute inset-y-0 w-px bg-ink-3" style={{ left: x(p0) }} />
      {p1 != null && (up || down) && (
        <span
          className={cn("absolute top-1/2 h-[2px] -translate-y-1/2", up ? "bg-up" : "bg-down")}
          style={{ left: x(Math.min(p0, p1)), width: `${(Math.abs(p1 - p0) / (hi - lo)) * 100}%` }}
        />
      )}
      {p1 != null && (
        <span
          className={cn(
            "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
            up ? "bg-up" : down ? "bg-down" : "border-2 border-ink-3 bg-surface"
          )}
          style={{ left: x(p1) }}
        />
      )}
    </span>
  );
}

export function ProbeLedger({
  results,
  initialProbability: p0,
  selectedId,
  onSelectTarget,
  isTargetInGraph,
}: {
  results: ProbeResult[];
  initialProbability: number;
  selectedId?: string | null;
  onSelectTarget?: (id: string) => void;
  isTargetInGraph?: (id: string) => boolean;
}) {
  const [order, setOrder] = useState<Order>("design");
  const [filter, setFilter] = useState<ProbeKind | "all">("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const rows: Row[] = useMemo(
    () =>
      results.map((r, index) => {
        const info = describeProbe(r);
        const p1 = r.updated_probability;
        return {
          index,
          r,
          kind: info.kind,
          action: info.action,
          tierLabel: info.tierLabel,
          order: info.order,
          target: targetLabel(r),
          p1,
          delta: p1 != null ? p1 - p0 : null,
          dLogit: p1 != null ? logitShift(p0, p1) : null,
        };
      }),
    [results, p0]
  );

  const [lo, hi] = useMemo(
    () => domainFor(p0, rows.filter((r) => r.p1 != null).map((r) => r.p1!)),
    [rows, p0]
  );
  const ticks = useMemo(() => niceTicks(lo, hi), [lo, hi]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.kind] = (c[r.kind] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = rows.filter((r) => filter === "all" || r.kind === filter);
  const byShift = (a: Row, b: Row) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0);

  const groups: Array<{ kind: ProbeKind | null; rows: Row[] }> =
    order === "design"
      ? KIND_ORDER.map((kind) => ({
          kind,
          rows: visible.filter((r) => r.kind === kind).sort((a, b) => a.order - b.order || byShift(a, b)),
        })).filter((g) => g.rows.length > 0)
      : [{ kind: null, rows: [...visible].sort(byShift) }];

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const gridCols =
    "sm:grid sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(150px,1.1fr)_4.5rem_4.5rem] sm:items-center sm:gap-4";

  return (
    <section aria-labelledby="ledger-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h3 id="ledger-heading" className="font-display text-xl text-ink">
            Every probe, and where it moved the forecast
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-2">
            Each probe was shown to the model in a fresh conversation alongside its original network. On each track,
            the thin mark is the baseline forecast ({formatProbability(p0)}) and the dot is the new forecast. Open a
            row to read the probe and the model&apos;s response.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Order" className="inline-flex rounded-md border border-rule bg-surface-2 p-0.5">
            {(
              [
                ["design", "By probe type"],
                ["shift", "Largest shift first"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="radio"
                aria-checked={order === key}
                onClick={() => setOrder(key)}
                className={cn(
                  "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
                  order === key ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", ...KIND_ORDER] as const).map((k) =>
          counts[k] ? (
            <button
              key={k}
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                filter === k
                  ? "border-ink bg-ink text-paper"
                  : "border-rule bg-surface text-ink-2 hover:border-rule-strong hover:text-ink"
              )}
            >
              {k === "all" ? "All probes" : KIND_META[k].label}
              <span className="num ml-1.5 opacity-60">{counts[k]}</span>
            </button>
          ) : null
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-rule bg-surface">
        {/* Column header */}
        <div className={cn("hidden border-b border-rule bg-surface-2/60 px-4 py-2", gridCols)}>
          <span className="eyebrow">Probe</span>
          <span className="eyebrow">Target</span>
          <div className="relative h-4">
            {ticks.map((t) => (
              <span
                key={t}
                className="num absolute top-0 -translate-x-1/2 text-[10px] text-ink-3"
                style={{ left: `${((t - lo) / (hi - lo)) * 100}%` }}
              >
                {Math.round(t * 100)}%
              </span>
            ))}
          </div>
          <span className="eyebrow text-right">Change</span>
          <span className="eyebrow text-right" title="Change in log-odds, the paper's main outcome measure">
            Log-odds
          </span>
        </div>

        {groups.map((g) => {
          const groupMean = mean(g.rows.filter((r) => r.delta != null).map((r) => Math.abs(r.delta!)));
          return (
            <Fragment key={g.kind ?? "all"}>
              {g.kind && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-rule bg-paper/60 px-4 py-2">
                  <p className="text-xs">
                    <span className="font-semibold text-ink">{KIND_META[g.kind].label}</span>
                    <span className="ml-2 text-ink-3">{KIND_META[g.kind].blurb}</span>
                  </p>
                  {groupMean != null && (
                    <p className="text-[11px] text-ink-3">
                      avg <span className="num text-ink-2">{formatPp(groupMean)}</span>
                    </p>
                  )}
                </div>
              )}
              {g.rows.map((row) => {
                const isOpen = expanded.has(row.index);
                const isSelected = selectedId != null && row.r.target_id === selectedId;
                const canShow = isTargetInGraph?.(row.r.target_id) ?? false;
                return (
                  <div
                    key={row.index}
                    className={cn(
                      "border-b border-rule last:border-b-0",
                      isSelected && "bg-accent-soft/60"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(row.index)}
                      aria-expanded={isOpen}
                      className={cn(
                        "relative block w-full px-4 py-2.5 text-left transition-colors hover:bg-surface-2/70",
                        gridCols
                      )}
                    >
                      {isSelected && <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
                      <span className="flex items-baseline justify-between gap-3 sm:block">
                        <span className="text-[13px] leading-snug text-ink">
                          {row.action}
                          {row.tierLabel && (
                            <span className="block text-[11px] text-ink-3 sm:inline sm:before:content-['_·_']">
                              {row.tierLabel}
                            </span>
                          )}
                        </span>
                        {/* Mobile-only change */}
                        <span className={cn("num shrink-0 text-sm sm:hidden", row.delta != null ? deltaClass(row.delta) : "text-ink-3")}>
                          {row.delta != null ? formatDelta(row.delta) : "failed"}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate font-cond text-[13px] text-ink-2 sm:mt-0">
                        {row.target}
                      </span>
                      <span className="mt-2 block sm:mt-0">
                        <Track p0={p0} p1={row.p1} lo={lo} hi={hi} ticks={ticks} />
                      </span>
                      <span className={cn("num hidden text-right text-sm sm:block", row.delta != null ? deltaClass(row.delta) : "text-ink-3")}>
                        {row.delta != null ? formatDelta(row.delta) : "failed"}
                      </span>
                      <span className="num hidden text-right text-xs text-ink-2 sm:block">
                        {row.dLogit != null ? formatSigned(row.dLogit) : "—"}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="grid gap-4 border-t border-dashed border-rule bg-paper/40 px-4 py-4 md:grid-cols-2">
                        <div>
                          <p className="eyebrow mb-1.5">Probe given to the model</p>
                          <blockquote className="border-l-2 border-accent pl-3 font-display text-[15px] italic leading-relaxed text-ink">
                            {row.r.probe_text || "—"}
                          </blockquote>
                        </div>
                        <div>
                          <p className="eyebrow mb-1.5">
                            Model&apos;s response
                            {row.p1 != null && (
                              <span className="num ml-2 normal-case tracking-normal text-ink-2">
                                {formatProbability(p0)} → {formatProbability(row.p1)}
                              </span>
                            )}
                          </p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
                            {row.r.reasoning || "No reasoning recorded."}
                          </p>
                          {canShow && onSelectTarget && (
                            <button
                              type="button"
                              onClick={() => onSelectTarget(row.r.target_id)}
                              className="mt-3 text-xs font-medium text-accent hover:underline"
                            >
                              {isSelected ? "Selected in the network" : "Show target in the network ↑"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

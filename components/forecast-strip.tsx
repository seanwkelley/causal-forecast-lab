"use client";

import { modelLabel, modelShort, sortModelKeys } from "@/lib/models";
import { cn, formatProbability } from "@/lib/utils";

interface StripProps {
  /** model key -> probability */
  probabilities: Record<string, number>;
  activeModel?: string;
  marketProbability?: number | null;
  onSelectModel?: (key: string) => void;
}

/** Group models whose forecasts land within ~1.5pp so their dots can stack. */
function stackOffsets(entries: Array<[string, number]>) {
  const sorted = [...entries].sort((a, b) => a[1] - b[1]);
  const offsets = new Map<string, number>();
  let groupStart = -1;
  let index = 0;
  for (const [key, p] of sorted) {
    if (groupStart < 0 || p - groupStart > 0.015) {
      groupStart = p;
      index = 0;
    } else index++;
    offsets.set(key, index);
  }
  return offsets;
}

/** Full-width strip with axis, labelled active model and market marker. */
export function ForecastStrip({ probabilities, activeModel, marketProbability, onSelectModel }: StripProps) {
  const entries = sortModelKeys(Object.keys(probabilities)).map(
    (k) => [k, probabilities[k]] as [string, number]
  );
  const offsets = stackOffsets(entries);
  const active = activeModel != null ? probabilities[activeModel] : undefined;

  return (
    <div className="w-full">
      <div className="relative h-24">
        {/* Active model label */}
        {active != null && activeModel && (
          <div
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-center"
            style={{ left: `clamp(56px, ${active * 100}%, calc(100% - 56px))` }}
          >
            <span className="num text-sm font-semibold text-accent">{formatProbability(active)}</span>
            <span className="ml-1.5 text-xs text-ink-2">{modelShort(activeModel)}</span>
          </div>
        )}

        {/* Track */}
        <div className="absolute inset-x-0 top-[44px] h-px bg-rule-strong" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <div key={t} className="absolute top-[40px] h-[9px] w-px bg-rule-strong" style={{ left: `${t * 100}%` }} />
        ))}

        {/* Model dots */}
        {entries.map(([key, p]) => {
          const isActive = key === activeModel;
          const stack = offsets.get(key) ?? 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectModel?.(key)}
              title={`${modelLabel(key)}: ${formatProbability(p)}`}
              aria-label={`${modelLabel(key)}: ${formatProbability(p)}`}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-125",
                isActive
                  ? "z-10 h-3.5 w-3.5 bg-accent ring-4 ring-accent/20"
                  : "h-2.5 w-2.5 border border-ink-2 bg-surface"
              )}
              style={{ left: `${p * 100}%`, top: 44 - stack * 9 }}
            />
          );
        })}

        {/* Market marker */}
        {marketProbability != null && (
          <span
            className="absolute top-[52px] block h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-ink"
            style={{ left: `${marketProbability * 100}%` }}
            title={`Market forecast: ${formatProbability(marketProbability)}`}
          />
        )}
        {marketProbability != null && (
          <div
            className="absolute top-[66px] -translate-x-1/2 whitespace-nowrap text-xs text-ink-2"
            style={{ left: `clamp(48px, ${marketProbability * 100}%, calc(100% - 48px))` }}
          >
            Market <span className="num text-ink">{formatProbability(marketProbability)}</span>
          </div>
        )}

        {/* Axis labels */}
        {[0, 0.5, 1].map((t) => (
          <span
            key={t}
            className={cn(
              "num absolute top-[86px] text-[10px] text-ink-3",
              t === 0 ? "left-0" : t === 1 ? "right-0" : "-translate-x-1/2"
            )}
            style={t === 0.5 ? { left: "50%" } : undefined}
          >
            {t * 100}%
          </span>
        ))}
      </div>
    </div>
  );
}

/** Compact strip for list rows: one dot per model, market as a diamond. */
export function MiniStrip({
  probabilities,
  activeModel,
  marketProbability,
  className,
}: Omit<StripProps, "onSelectModel"> & { className?: string }) {
  const entries = Object.entries(probabilities);
  return (
    <div className={cn("relative h-4", className)} aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-px bg-rule-strong" />
      <div className="absolute left-1/2 top-[3px] h-[10px] w-px bg-rule-strong" />
      {entries.map(([key, p]) =>
        key === activeModel ? null : (
          <span
            key={key}
            className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink-2 bg-surface"
            style={{ left: `${p * 100}%` }}
          />
        )
      )}
      {marketProbability != null && (
        <span
          className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink"
          style={{ left: `${marketProbability * 100}%` }}
        />
      )}
      {activeModel && probabilities[activeModel] != null && (
        <span
          className="absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: `${probabilities[activeModel] * 100}%` }}
        />
      )}
    </div>
  );
}

/** Model buttons that double as the per-model forecast list. */
export function ModelPicker({
  probabilities,
  available,
  activeModel,
  onSelectModel,
}: {
  probabilities: Record<string, number>;
  available: string[];
  activeModel: string;
  onSelectModel: (key: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Model" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
      {sortModelKeys(available).map((key) => {
        const isActive = key === activeModel;
        const p = probabilities[key];
        return (
          <button
            key={key}
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelectModel(key)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
              isActive
                ? "border-accent bg-accent-soft text-ink"
                : "border-rule bg-surface text-ink-2 hover:border-rule-strong hover:text-ink"
            )}
          >
            <span className="text-xs font-medium leading-tight">{modelLabel(key)}</span>
            {p != null && (
              <span className={cn("num text-xs", isActive ? "font-semibold text-accent" : "text-ink-3")}>
                {formatProbability(p)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

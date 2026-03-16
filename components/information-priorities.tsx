"use client";

import { useState } from "react";

interface EpistemicRating {
  factor_id: string;
  confidence: number;
  reason: string;
  betweenness: number;
  value_of_information: number;
}

function confidenceLabel(c: number): string {
  if (c <= 1) return "Very uncertain";
  if (c <= 2) return "Uncertain";
  if (c <= 3) return "Moderate";
  if (c <= 4) return "Fairly confident";
  return "Very confident";
}

function confidenceColor(c: number): string {
  if (c <= 1) return "text-red-400";
  if (c <= 2) return "text-orange-400";
  if (c <= 3) return "text-yellow-400";
  if (c <= 4) return "text-blue-400";
  return "text-green-400";
}

function voiBar(voi: number, maxVoi: number): number {
  if (maxVoi <= 0) return 0;
  return Math.round((voi / maxVoi) * 100);
}

const PREVIEW_COUNT = 3;

export function InformationPriorities({
  ratings,
}: {
  ratings: EpistemicRating[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (!ratings || ratings.length === 0) return null;

  const maxVoi = Math.max(...ratings.map((r) => r.value_of_information), 0.001);
  const visible = expanded ? ratings : ratings.slice(0, PREVIEW_COUNT);
  const hasMore = ratings.length > PREVIEW_COUNT;

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
          Information Priorities
        </h3>
        <span className="text-[10px] text-[var(--color-muted-foreground)]">
          {ratings.length} factors
        </span>
      </div>
      <p className="text-[10px] text-[var(--color-muted-foreground)]">
        High structural importance + low epistemic confidence = highest priority for research.
      </p>
      <div className="space-y-1.5">
        {visible.map((r, i) => (
          <div
            key={r.factor_id}
            className="flex items-center gap-2 text-xs"
          >
            <span className="font-mono text-[var(--color-muted-foreground)] w-4 shrink-0 text-right">
              {i + 1}.
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">
                  {r.factor_id.replace(/_/g, " ")}
                </span>
                <span
                  className={`font-mono text-[10px] shrink-0 ${confidenceColor(r.confidence)}`}
                >
                  {confidenceLabel(r.confidence)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)]"
                    style={{ width: `${voiBar(r.value_of_information, maxVoi)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-[var(--color-muted-foreground)] w-8 text-right shrink-0">
                  {r.value_of_information.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-[var(--color-primary)] hover:underline"
        >
          {expanded ? "Show less" : `Show all ${ratings.length} factors`}
        </button>
      )}
    </div>
  );
}

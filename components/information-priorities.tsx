"use client";

import { useState } from "react";
import { humanize } from "@/lib/probes";

export interface EpistemicRating {
  factor_id: string;
  confidence: number;
  reason: string;
  betweenness: number;
  value_of_information: number;
}

const CONFIDENCE = ["", "Very unsure", "Unsure", "Moderate", "Fairly sure", "Very sure"];

const PREVIEW_COUNT = 4;

export function InformationPriorities({ ratings }: { ratings: EpistemicRating[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!ratings || ratings.length === 0) return null;

  const maxVoi = Math.max(...ratings.map((r) => r.value_of_information), 0.001);
  const visible = expanded ? ratings : ratings.slice(0, PREVIEW_COUNT);

  return (
    <div>
      <p className="eyebrow mb-1">What to research first</p>
      <p className="mb-3 text-xs leading-relaxed text-ink-2">
        The model rated its confidence in each factor. Central factors it is unsure about rank highest.
      </p>
      <ol className="space-y-2.5">
        {visible.map((r) => (
          <li key={r.factor_id} title={r.reason}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-cond font-medium text-ink">{humanize(r.factor_id)}</span>
              <span className="shrink-0 text-[11px] text-ink-3">
                {CONFIDENCE[Math.round(Math.min(5, Math.max(1, r.confidence)))]}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.round((r.value_of_information / maxVoi) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
      {ratings.length > PREVIEW_COUNT && (
        <button onClick={() => setExpanded(!expanded)} className="mt-3 text-xs font-medium text-accent hover:underline">
          {expanded ? "Show fewer" : `Show all ${ratings.length} factors`}
        </button>
      )}
    </div>
  );
}

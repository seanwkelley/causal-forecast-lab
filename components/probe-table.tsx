"use client";

import { useState, useMemo, Fragment } from "react";
import type { ProbeResult } from "@/lib/types";
import {
  formatProbability,
  formatDelta,
  deltaColor,
  probeTypeLabel,
  probeCategoryLabel,
  truncate,
} from "@/lib/utils";

type SortKey = "probe_type" | "absolute_shift" | "target_importance";

export function ProbeTable({
  results,
  initialProbability,
  onSelectProbe,
  selectedTargetId,
}: {
  results: ProbeResult[];
  initialProbability: number;
  onSelectProbe?: (targetId: string) => void;
  selectedTargetId?: string | null;
}) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("absolute_shift");
  const [sortDesc, setSortDesc] = useState(true);
  const [expandedProbeIdx, setExpandedProbeIdx] = useState<number | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(results.map((r) => r.probe_category));
    return ["all", ...Array.from(cats)];
  }, [results]);

  const filtered = useMemo(() => {
    let list =
      activeCategory === "all"
        ? results
        : results.filter((r) => r.probe_category === activeCategory);

    list = [...list].sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "absolute_shift") {
        av = a.absolute_shift ?? 0;
        bv = b.absolute_shift ?? 0;
      } else if (sortKey === "target_importance") {
        av = a.target_importance;
        bv = b.target_importance;
      } else {
        return a.probe_type.localeCompare(b.probe_type) * (sortDesc ? -1 : 1);
      }
      return sortDesc ? bv - av : av - bv;
    });

    return list;
  }, [results, activeCategory, sortKey, sortDesc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDesc ? " ↓" : " ↑") : "";

  return (
    <div>
      {/* Category tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              setExpandedProbeIdx(null);
            }}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap ${
              activeCategory === cat
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {cat === "all" ? "All Probes" : probeCategoryLabel(cat)}
            <span className="ml-1 opacity-60">
              (
              {cat === "all"
                ? results.length
                : results.filter((r) => r.probe_category === cat).length}
              )
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-secondary)]">
              <th
                className="px-3 py-2 text-left text-xs font-medium text-[var(--color-muted-foreground)] cursor-pointer hover:text-[var(--color-foreground)]"
                onClick={() => handleSort("probe_type")}
              >
                Probe Type{sortIndicator("probe_type")}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-muted-foreground)]">
                Target
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-muted-foreground)]">
                Baseline
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-muted-foreground)]">
                Updated
              </th>
              <th
                className="px-3 py-2 text-right text-xs font-medium text-[var(--color-muted-foreground)] cursor-pointer hover:text-[var(--color-foreground)]"
                onClick={() => handleSort("absolute_shift")}
              >
                |Δ|{sortIndicator("absolute_shift")}
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-[var(--color-muted-foreground)]">
                Direction
              </th>
              <th
                className="px-3 py-2 text-right text-xs font-medium text-[var(--color-muted-foreground)] cursor-pointer hover:text-[var(--color-foreground)]"
                onClick={() => handleSort("target_importance")}
              >
                Importance{sortIndicator("target_importance")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const delta =
                r.updated_probability != null
                  ? r.updated_probability - initialProbability
                  : null;
              const isSelected = selectedTargetId === r.target_id;
              const isExpanded = expandedProbeIdx === i;

              return (
                <Fragment key={i}>
                  <tr
                    onClick={() => {
                      onSelectProbe?.(r.target_id);
                      setExpandedProbeIdx(isExpanded ? null : i);
                    }}
                    className={`border-b border-[var(--color-border)] hover:bg-[var(--color-secondary)]/50 cursor-pointer transition-colors ${
                      isSelected ? "bg-[var(--color-primary)]/10" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            r.probe_category === "node"
                              ? "bg-blue-500"
                              : r.probe_category === "edge"
                                ? "bg-purple-500"
                                : r.probe_category === "control"
                                  ? "bg-gray-400"
                                  : "bg-orange-500"
                          }`}
                        />
                        <span className="font-mono text-xs">
                          {probeTypeLabel(r.probe_type)}
                        </span>
                        <span className="text-[var(--color-muted-foreground)] text-xs ml-1">
                          {isExpanded ? "▾" : "▸"}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--color-muted-foreground)] max-w-[200px]">
                      {truncate(r.target_id, 30)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {formatProbability(initialProbability)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {r.updated_probability != null
                        ? formatProbability(r.updated_probability)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {delta != null ? (
                        <span className={`font-mono text-xs font-medium ${deltaColor(delta)}`}>
                          {formatDelta(delta)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.shift_direction === "increased" && (
                        <span className="text-[var(--color-positive)]">↑</span>
                      )}
                      {r.shift_direction === "decreased" && (
                        <span className="text-[var(--color-negative)]">↓</span>
                      )}
                      {r.shift_direction === "unchanged" && (
                        <span className="text-[var(--color-neutral-shift)]">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-[var(--color-muted-foreground)]">
                      {r.target_importance.toFixed(3)}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-[var(--color-border)]">
                      <td colSpan={7} className="px-4 py-3 bg-[var(--color-secondary)]/30">
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
                              Probe Text
                            </span>
                            <p className="text-sm text-[var(--color-foreground)] mt-0.5 italic leading-relaxed">
                              &ldquo;{r.probe_text}&rdquo;
                            </p>
                          </div>
                          {r.reasoning && (
                            <div>
                              <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
                                Model Reasoning
                              </span>
                              <p className="text-sm text-[var(--color-foreground)] mt-0.5 leading-relaxed whitespace-pre-wrap">
                                {r.reasoning}
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

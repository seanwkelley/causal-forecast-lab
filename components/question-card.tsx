"use client";

import Link from "next/link";
import { truncate, formatProbability, probToColor } from "@/lib/utils";

interface QuestionEntry {
  question_id: string;
  question_text: string;
  source: string;
  models?: string[];
  // Legacy fields
  initial_probability?: number;
  n_nodes?: number;
  n_edges?: number;
  mean_absolute_shift?: number | null;
  ssr?: number | null;
}

export function QuestionCard({
  q,
  model,
}: {
  q: QuestionEntry;
  model?: string;
}) {
  const href = model
    ? `/explore/${q.question_id}?model=${model}`
    : `/explore/${q.question_id}`;

  return (
    <Link
      href={href}
      className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-card)]/80 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug group-hover:text-[var(--color-primary)] transition-colors">
            {truncate(q.question_text, 120)}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-muted-foreground)]">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-secondary)] px-2 py-0.5">
              {q.source}
            </span>
            {q.n_nodes != null && <span>{q.n_nodes} nodes</span>}
            {q.n_edges != null && <span>{q.n_edges} edges</span>}
            {q.models && (
              <span>
                {q.models.length} model{q.models.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          {q.initial_probability != null && (
            <p
              className="text-lg font-mono font-bold"
              style={{ color: probToColor(q.initial_probability) }}
            >
              {formatProbability(q.initial_probability)}
            </p>
          )}
          {q.ssr != null && (
            <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
              SSR: {q.ssr.toFixed(2)}x
            </p>
          )}
        </div>
      </div>
      {q.mean_absolute_shift != null && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)] mb-1">
            <span>Mean |Delta|</span>
            <span className="font-mono">
              {(q.mean_absolute_shift * 100).toFixed(1)}pp
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[var(--color-secondary)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-primary)]"
              style={{
                width: `${Math.min(q.mean_absolute_shift * 100 * 3, 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </Link>
  );
}

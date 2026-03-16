"use client";

import Link from "next/link";
import { truncate } from "@/lib/utils";

interface QuestionEntry {
  question_id: string;
  question_text: string;
  source: string;
  models?: string[];
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
            {q.models && (
              <span>
                {q.models.length} model{q.models.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 space-y-1">
          {q.ssr != null && (
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-[10px] text-[var(--color-muted-foreground)]">SSR</span>
              <span className={`font-mono text-xs font-medium ${
                q.ssr >= 2 ? "text-[var(--color-positive)]" :
                q.ssr >= 1.5 ? "text-[var(--color-primary)]" :
                "text-[var(--color-muted-foreground)]"
              }`}>
                {q.ssr.toFixed(1)}x
              </span>
            </div>
          )}
          {q.mean_absolute_shift != null && (
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-[10px] text-[var(--color-muted-foreground)]">Avg |Δ|</span>
              <span className="font-mono text-xs">
                {(q.mean_absolute_shift * 100).toFixed(1)}pp
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

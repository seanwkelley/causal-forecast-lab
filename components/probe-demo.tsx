"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EdgeMetrics, NodeMetrics } from "@/lib/types";
import { CausalNetwork } from "./causal-network";
import { cn, formatDelta, formatProbability } from "@/lib/utils";

export interface DemoProbe {
  key: string;
  label: string;
  caption: string;
  targetId: string | null;
  text: string;
  p1: number;
}

export interface DemoData {
  questionId: string;
  modelKey: string;
  modelLabel: string;
  question: string;
  p0: number;
  nodes: NodeMetrics[];
  edges: EdgeMetrics[];
  probes: DemoProbe[];
  totalProbes: number;
}

/** Home-page figure: one real question, three probes, one moving forecast. */
export function ProbeDemo({ demo }: { demo: DemoData }) {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % demo.probes.length), 5200);
    return () => clearInterval(t);
  }, [auto, demo.probes.length]);

  const probe = demo.probes[index];
  const delta = probe.p1 - demo.p0;
  const moved = Math.abs(delta) > 0.004;
  const tone = delta > 0 ? "bg-up" : "bg-down";
  const lo = 0;
  const hi = Math.min(1, Math.max(0.5, ...demo.probes.map((p) => p.p1 + 0.08)));
  const x = (p: number) => `${((p - lo) / (hi - lo)) * 100}%`;

  return (
    <figure className="rounded-2xl border border-rule bg-surface p-4 shadow-[0_1px_0_var(--rule),0_12px_40px_-24px_rgba(20,22,27,0.35)] sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Example from the data</p>
        <p className="text-[11px] text-ink-3">{demo.modelLabel}</p>
      </div>
      <p className="mt-1.5 font-display text-lg leading-snug text-ink">{demo.question}</p>

      <div className="mt-3 rounded-lg bg-paper/70 p-2">
        <CausalNetwork nodes={demo.nodes} edges={demo.edges} highlightId={probe.targetId} compact />
      </div>

      <div role="tablist" aria-label="Example probes" className="mt-4 grid grid-cols-3 gap-1.5">
        {demo.probes.map((p, i) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={i === index}
            onClick={() => {
              setIndex(i);
              setAuto(false);
            }}
            className={cn(
              "rounded-md border px-2 py-1.5 text-left transition-colors",
              i === index ? "border-accent bg-accent-soft" : "border-rule hover:border-rule-strong"
            )}
          >
            <span className="block text-[11px] font-medium leading-tight text-ink">{p.label}</span>
            <span className={cn("num text-xs", i === index ? "text-accent-ink" : "text-ink-3")}>
              {formatDelta(p.p1 - demo.p0)}
            </span>
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-3 min-h-[7.5rem]">
        <p className="text-[11px] text-ink-3">{probe.caption}</p>
        <blockquote className="mt-1 line-clamp-3 border-l-2 border-accent pl-3 font-display text-[15px] italic leading-snug text-ink">
          {probe.text}
        </blockquote>
      </div>

      <figcaption className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-ink-2">Forecast</span>
          <span className="num text-ink">
            {formatProbability(demo.p0)} →{" "}
            <strong className={!moved ? "text-ink" : delta > 0 ? "text-up" : "text-down"}>
              {formatProbability(probe.p1)}
            </strong>
          </span>
        </div>
        <div className="relative mt-2 h-3">
          <div className="absolute inset-x-0 top-1/2 h-px bg-rule-strong" />
          <div className="absolute top-0 h-3 w-px bg-ink-3" style={{ left: x(demo.p0) }} />
          <div
            className={cn("absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full transition-all duration-700 ease-out", tone)}
            style={{ left: x(Math.min(demo.p0, probe.p1)), width: `${(Math.abs(delta) / (hi - lo)) * 100}%` }}
          />
          <div
            className={cn(
              "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-700 ease-out",
              moved ? tone : "border-2 border-ink-3 bg-surface"
            )}
            style={{ left: x(probe.p1) }}
          />
        </div>
        <div className="num mt-1 flex justify-between text-[10px] text-ink-3">
          <span>0%</span>
          <span>{Math.round(hi * 100)}%</span>
        </div>
        <Link
          href={`/explore/${encodeURIComponent(demo.questionId)}?model=${demo.modelKey}`}
          className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
        >
          See all {demo.totalProbes} probes for this question →
        </Link>
      </figcaption>
    </figure>
  );
}

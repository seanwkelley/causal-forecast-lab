"use client";

import { useMemo, useState } from "react";
import type { AggregateMetrics, QuestionDetail } from "@/lib/types";
import { humanize } from "@/lib/probes";
import { cn } from "@/lib/utils";
import { CausalNetwork } from "./causal-network";
import { InteractiveProbe } from "./interactive-probe";
import { ProbeLedger } from "./probe-ledger";
import { SensitivitySummary } from "./sensitivity-summary";
import { TargetDetails } from "./target-details";

export interface AnalysisData extends QuestionDetail {
  aggregate_metrics: AggregateMetrics;
}

/**
 * The per-model analysis: causal network + selection panel, the sensitivity
 * summary, and the full probe ledger. Shared by the explorer and live mode.
 */
export function QuestionAnalysis({
  data,
  modelId,
  sidebarExtra,
}: {
  data: AnalysisData;
  /** OpenRouter ID of the model that produced this network */
  modelId: string;
  sidebarExtra?: React.ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const na = data.network_analysis;

  const elementIds = useMemo(
    () =>
      new Set([
        ...na.node_metrics.filter((n) => n.role !== "outcome").map((n) => n.node_id),
        ...na.edge_metrics.map((e) => `${e.source}->${e.target}`),
      ]),
    [na]
  );

  const selectedType: "node" | "edge" | null = selectedId ? (selectedId.includes("->") ? "edge" : "node") : null;
  const selectedLabel = selectedId
    ? selectedId.includes("->")
      ? selectedId.split("->").map(humanize).join(" → ")
      : humanize(selectedId)
    : null;

  const selectAndReveal = (id: string) => {
    setSelectedId(id);
    document.getElementById("network")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const factorCount = na.node_metrics.filter((n) => n.role !== "outcome").length;

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <section id="network" aria-labelledby="network-heading" className="min-w-0 scroll-mt-20 rounded-xl border border-rule bg-surface p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 id="network-heading" className="font-display text-xl text-ink">
              The model&apos;s causal network
            </h3>
            <p className="text-xs text-ink-3">
              {factorCount} factors · {na.n_edges} links · arrows run from cause to effect
            </p>
          </div>
          <CausalNetwork
            nodes={na.node_metrics}
            edges={na.edge_metrics}
            probeResults={data.probe_results}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>

        <aside className="space-y-4">
          <div className={cn("rounded-xl border bg-surface p-4", selectedId ? "border-accent/40" : "border-rule")}>
            <TargetDetails
              selectedId={selectedId}
              nodes={na.node_metrics}
              edges={na.edge_metrics}
              probeResults={data.probe_results}
              initialProbability={data.initial_probability}
              onClear={() => setSelectedId(null)}
            />
          </div>
          <div className="rounded-xl border border-rule bg-surface p-4">
            <InteractiveProbe
              questionText={data.question_text}
              initialProbability={data.initial_probability}
              reasoning={data.reasoning}
              nodes={data.nodes}
              edges={data.edges}
              selectedTargetId={selectedId}
              selectedTargetType={selectedType}
              selectedTargetLabel={selectedLabel}
              defaultModel={modelId}
            />
          </div>
          {sidebarExtra && <div className="rounded-xl border border-rule bg-surface p-4">{sidebarExtra}</div>}
        </aside>
      </div>

      <SensitivitySummary
        metrics={data.aggregate_metrics}
        results={data.probe_results}
        initialProbability={data.initial_probability}
      />

      <ProbeLedger
        results={data.probe_results}
        initialProbability={data.initial_probability}
        selectedId={selectedId}
        onSelectTarget={selectAndReveal}
        isTargetInGraph={(id) => elementIds.has(id)}
      />
    </div>
  );
}

/** The model's baseline forecast with its stated reasoning. */
export function BaselineCard({
  probability,
  reasoning,
  modelName,
}: {
  probability: number;
  reasoning: string;
  modelName: string;
}) {
  const [open, setOpen] = useState(false);
  const long = reasoning.length > 420;
  return (
    <section className="grid gap-4 rounded-xl border border-rule bg-surface p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8 sm:p-5">
      <div>
        <p className="eyebrow">{modelName} forecast</p>
        <p className="num mt-1 text-5xl font-medium tracking-tight text-ink">
          {Math.round(probability * 1000) / 10}
          <span className="text-2xl text-ink-3">%</span>
        </p>
        <p className="mt-1 text-xs text-ink-3">probability of “Yes”</p>
      </div>
      <div className="min-w-0">
        <p className="eyebrow mb-1.5">Its reasoning</p>
        <p className={cn("whitespace-pre-wrap text-sm leading-relaxed text-ink-2", !open && long && "line-clamp-4")}>
          {reasoning}
        </p>
        {long && (
          <button onClick={() => setOpen(!open)} className="mt-1.5 text-xs font-medium text-accent hover:underline">
            {open ? "Show less" : "Read all"}
          </button>
        )}
      </div>
    </section>
  );
}

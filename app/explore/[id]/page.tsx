"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { QuestionDetail, AggregateMetrics } from "@/lib/types";
import { CausalNetwork } from "@/components/causal-network";
import { ProbeTable } from "@/components/probe-table";
import { DeltaBarChart } from "@/components/probe-chart";
import { MetricsPanel } from "@/components/metrics-panel";
import { ProbabilityBar } from "@/components/probability-bar";
import { InteractiveProbe } from "@/components/interactive-probe";
import { formatProbability, probToColor } from "@/lib/utils";

interface DetailWithMetrics extends QuestionDetail {
  aggregate_metrics: AggregateMetrics;
  model?: string;
  model_label?: string;
}

const MODEL_LABELS: Record<string, string> = {
  "llama-8b": "Llama 3.1 8B",
  "llama-70b": "Llama 3.3 70B",
  "deepseek-v3": "DeepSeek V3",
  "qwen-235b": "Qwen3 235B",
  "gemini-flash": "Gemini 2.5 Flash Lite",
};

const MODEL_IDS: Record<string, string> = {
  "llama-8b": "meta-llama/llama-3.1-8b-instruct",
  "llama-70b": "meta-llama/llama-3.3-70b-instruct",
  "deepseek-v3": "deepseek/deepseek-chat-v3-0324",
  "qwen-235b": "qwen/qwen3-235b-a22b-2507",
  "gemini-flash": "google/gemini-2.5-flash-lite",
};

export default function QuestionDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const initialModel = searchParams.get("model") || "llama-70b";

  const [activeModel, setActiveModel] = useState(initialModel);
  const [data, setData] = useState<DetailWithMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelProbabilities, setModelProbabilities] = useState<Record<string, number>>({});
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  // Load available models for this question
  useEffect(() => {
    fetch("/data/summary.json")
      .then((r) => r.json())
      .then((summary) => {
        const q = summary.questions?.find(
          (q: { question_id: string }) => q.question_id === id
        );
        if (q?.models) {
          setAvailableModels(q.models);
        }
        if (q?.model_probabilities) {
          setModelProbabilities(q.model_probabilities);
        }
      })
      .catch(() => {});
  }, [id]);

  // Load question data for active model
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!data) setLoading(true);
    setSwitching(true);
    fetch(`/data/questions/${activeModel}/${id}.json`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
        setSwitching(false);
      })
      .catch(() => {
        // Fallback: try old flat structure
        fetch(`/data/questions/${id}.json`)
          .then((r) => {
            if (!r.ok) throw new Error("Not found");
            return r.json();
          })
          .then((d) => {
            setData(d);
            setLoading(false);
            setSwitching(false);
          })
          .catch(() => {
            setLoading(false);
            setSwitching(false);
          });
      });
  }, [id, activeModel]);

  // Determine selected target type and description
  const selectedInfo = useMemo(() => {
    if (!data || !selectedTargetId) return { type: null, description: null };

    const node = data.network_analysis.node_metrics.find(
      (n) => n.node_id === selectedTargetId
    );
    if (node) {
      return { type: "node" as const, description: node.description };
    }

    const edge = data.network_analysis.edge_metrics.find(
      (e) => `${e.source}->${e.target}` === selectedTargetId
    );
    if (edge) {
      return { type: "edge" as const, description: edge.mechanism };
    }

    return { type: null, description: null };
  }, [data, selectedTargetId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <div className="animate-pulse text-[var(--color-muted-foreground)]">
          Loading question detail...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Question Not Found</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Could not find question with ID: {id}
        </p>
        <Link
          href="/explore"
          className="mt-4 inline-block text-[var(--color-primary)] hover:underline"
        >
          Back to Explore
        </Link>
      </div>
    );
  }

  const modelLabel = data.model_label || MODEL_LABELS[activeModel] || activeModel;

  return (
    <div className={`mx-auto max-w-7xl px-4 py-6 transition-opacity duration-150 ${switching ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)] mb-4">
        <Link href="/explore" className="hover:text-[var(--color-foreground)]">
          ForecastBench Examples
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">{id}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold leading-snug">{data.question_text}</h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-[var(--color-muted-foreground)]">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-secondary)] px-2 py-0.5 text-xs">
            {data.source}
          </span>
          <span className="font-mono text-xs">{data.condition}</span>
        </div>

        {/* Model switcher */}
        {availableModels.length > 1 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Model:
            </span>
            {availableModels.map((m) => (
              <button
                key={m}
                onClick={() => setActiveModel(m)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  activeModel === m
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                }`}
              >
                {MODEL_LABELS[m] || m}
              </button>
            ))}
          </div>
        )}
        {availableModels.length <= 1 && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] px-2 py-0.5 text-xs font-medium">
              {modelLabel}
            </span>
          </div>
        )}
      </div>

      {/* Probability Estimate + Cross-Model Comparison */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--color-muted-foreground)]">Probability Estimate:</span>
          <span
            className="text-2xl font-mono font-bold"
            style={{ color: probToColor(data.initial_probability) }}
          >
            {formatProbability(data.initial_probability)}
          </span>
        </div>
        <div className="mt-1.5 max-w-xs">
          <ProbabilityBar probability={data.initial_probability} showValue={false} size="sm" />
        </div>
        {Object.keys(modelProbabilities).length > 1 && (
          <div className="mt-2 flex items-center gap-4 text-xs text-[var(--color-muted-foreground)]">
            {Object.entries(modelProbabilities).map(([m, prob]) => (
              <span
                key={m}
                className={`font-mono ${m === activeModel ? "text-[var(--color-foreground)] font-medium" : ""}`}
              >
                {MODEL_LABELS[m] || m}: {formatProbability(prob)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Reasoning */}
      {data.reasoning && (
        <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <h3 className="text-sm font-semibold mb-2">Original Reasoning</h3>
          <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed whitespace-pre-wrap">
            {data.reasoning}
          </p>
        </div>
      )}

      {/* Top row: network + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mb-6">
        {/* Causal Network */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Causal Network</h3>
          </div>
          <CausalNetwork
            nodes={data.network_analysis.node_metrics}
            edges={data.network_analysis.edge_metrics}
            probeResults={data.probe_results}
            selectedNodeId={selectedTargetId}
            onNodeClick={(nodeId) => {
              // Don't allow selecting the outcome node as a probe target
              const node = data.network_analysis.node_metrics.find((n) => n.node_id === nodeId);
              if (node?.role === "outcome") return;
              setSelectedTargetId(nodeId);
            }}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Interactive Probe Panel */}
          <div className="rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-4">
            <InteractiveProbe
              questionText={data.question_text}
              initialProbability={data.initial_probability}
              reasoning={data.reasoning}
              nodes={data.nodes}
              edges={data.edges}
              selectedTargetId={selectedTargetId}
              selectedTargetType={selectedInfo.type}
              selectedTargetDescription={selectedInfo.description}
              defaultModel={MODEL_IDS[activeModel] || "meta-llama/llama-3.3-70b-instruct"}
            />
          </div>

          {/* Metrics */}
          <MetricsPanel
            metrics={data.aggregate_metrics}
            network={data.network_analysis}
          />
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="text-sm font-semibold mb-3">Probability Shift by Probe</h3>
        <DeltaBarChart
          results={data.probe_results}
          initialProbability={data.initial_probability}
        />
      </div>

      {/* Probe Table */}
      <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="text-sm font-semibold mb-3">Probe Results</h3>
        <ProbeTable
          results={data.probe_results}
          initialProbability={data.initial_probability}
          onSelectProbe={(id) => setSelectedTargetId(id)}
          selectedTargetId={selectedTargetId}
        />
      </div>

    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import type { QuestionDetail, AggregateMetrics } from "@/lib/types";
import { CausalNetwork } from "@/components/causal-network";
import { ProbeTable } from "@/components/probe-table";
import { DeltaBarChart } from "@/components/probe-chart";
import { MetricsPanel } from "@/components/metrics-panel";
import { ProbabilityBar } from "@/components/probability-bar";
import { InteractiveProbe } from "@/components/interactive-probe";
import { useApiKey } from "@/lib/api-key-context";
import { InformationPriorities } from "@/components/information-priorities";
import { formatProbability, probToColor } from "@/lib/utils";
import { DebatePanel } from "@/components/debate-panel";
import type { DebateRound } from "@/lib/debate-pipeline";

interface DetailWithMetrics extends QuestionDetail {
  aggregate_metrics: AggregateMetrics;
  epistemic_ratings?: Array<{
    factor_id: string;
    confidence: number;
    reason: string;
    betweenness: number;
    value_of_information: number;
  }>;
}

const MODELS = [
  { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { value: "qwen/qwen3-235b-a22b-2507", label: "Qwen3 235B" },
  { value: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek V3" },
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "openai/gpt-4o", label: "GPT-4o" },
  { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { value: "mistralai/mistral-large-2411", label: "Mistral Large" },
];

interface ModelProgress {
  stage: string;
  current?: number;
  total?: number;
}

interface ModelRun {
  model: string;
  label: string;
  result: DetailWithMetrics | null;
  loading: boolean;
  error: string | null;
  progress: ModelProgress | null;
}

export default function LivePage() {
  const [question, setQuestion] = useState("");
  const [background, setBackground] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [customModel, setCustomModel] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const { apiKey } = useApiKey();
  const [runs, setRuns] = useState<ModelRun[]>([]);
  const [debateEnabled, setDebateEnabled] = useState(false);
  const [debateRounds, setDebateRounds] = useState<DebateRound[]>([]);
  const [debateLoading, setDebateLoading] = useState(false);
  const [debateCurrentRound, setDebateCurrentRound] = useState(0);

  function toggleModel(value: string) {
    setSelectedModels((prev) => {
      if (prev.includes(value)) {
        return prev.filter((m) => m !== value);
      }
      const maxModels = debateEnabled ? 2 : 4;
      if (prev.length >= maxModels) return prev;
      return [...prev, value];
    });
  }

  async function handleDebate() {
    if (selectedModels.length !== 2 || !apiKey.trim()) return;
    const completedRuns = runs.filter((r) => r.result != null);
    if (completedRuns.length < 2) return;

    const runA = completedRuns.find((r) => r.model === selectedModels[0]);
    const runB = completedRuns.find((r) => r.model === selectedModels[1]);
    if (!runA?.result || !runB?.result) return;

    setDebateLoading(true);
    setDebateRounds([]);

    let stateA = {
      probability: runA.result.initial_probability,
      nodes: runA.result.nodes,
      edges: runA.result.edges,
    };
    let stateB = {
      probability: runB.result.initial_probability,
      nodes: runB.result.nodes,
      edges: runB.result.edges,
    };

    const probeEvidenceA = (runA.result.probe_results || [])
      .filter((p) => p.success && p.absolute_shift != null)
      .map((p) => ({
        probe_type: p.probe_type,
        target_id: p.target_id,
        target_importance: p.target_importance,
        absolute_shift: p.absolute_shift!,
        probe_text: p.probe_text || "",
      }));
    const probeEvidenceB = (runB.result.probe_results || [])
      .filter((p) => p.success && p.absolute_shift != null)
      .map((p) => ({
        probe_type: p.probe_type,
        target_id: p.target_id,
        target_importance: p.target_importance,
        absolute_shift: p.absolute_shift!,
        probe_text: p.probe_text || "",
      }));

    let prevCritiqueOfA: string | undefined;
    let prevCritiqueOfB: string | undefined;
    const allRounds: DebateRound[] = [];

    for (let round = 1; round <= 5; round++) {
      setDebateCurrentRound(round);
      try {
        const resp = await fetch("/api/debate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            roundNum: round,
            modelAId: selectedModels[0],
            modelBId: selectedModels[1],
            apiKey,
            stateA,
            stateB,
            probeEvidenceA,
            probeEvidenceB,
            previousCritiqueOfA: prevCritiqueOfA,
            previousCritiqueOfB: prevCritiqueOfB,
          }),
        });
        const roundResult: DebateRound = await resp.json();
        allRounds.push(roundResult);
        setDebateRounds([...allRounds]);

        // Update state for next round
        stateA = {
          probability: roundResult.modelA.revisedProbability,
          nodes: roundResult.modelA.revisedNodes,
          edges: roundResult.modelA.revisedEdges,
        };
        stateB = {
          probability: roundResult.modelB.revisedProbability,
          nodes: roundResult.modelB.revisedNodes,
          edges: roundResult.modelB.revisedEdges,
        };
        prevCritiqueOfA = roundResult.modelB.critique;
        prevCritiqueOfB = roundResult.modelA.critique;
      } catch (err) {
        console.error(`Debate round ${round} failed:`, err);
        break;
      }
    }

    setDebateLoading(false);
  }

  const anyLoading = runs.some((r) => r.loading);

  async function handleAnalyze() {
    if (!question.trim() || selectedModels.length === 0 || !apiKey.trim()) return;

    const newRuns: ModelRun[] = selectedModels.map((m) => ({
      model: m,
      label: MODELS.find((mod) => mod.value === m)?.label ?? m,
      result: null,
      loading: true,
      error: null,
      progress: null,
    }));
    setRuns(newRuns);

    // Run all models in parallel via SSE streams
    for (let i = 0; i < selectedModels.length; i++) {
      const model = selectedModels[i];
      (async () => {
        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: question.trim(),
              background: background.trim() || undefined,
              model,
              api_key: apiKey.trim(),
            }),
          });

          if (!res.ok) {
            const text = await res.text();
            let errorMsg = `HTTP ${res.status}`;
            try {
              const errData = JSON.parse(text);
              if (errData.error) errorMsg = errData.error;
            } catch { /* use default */ }
            throw new Error(errorMsg);
          }

          const reader = res.body?.getReader();
          if (!reader) throw new Error("No response body");

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() ?? "";

            for (const chunk of lines) {
              const line = chunk.trim();
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6);
              let parsed;
              try {
                parsed = JSON.parse(json);
              } catch {
                // Skip malformed SSE chunks (partial data, split packets)
                continue;
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.done && parsed.result) {
                setRuns((prev) =>
                  prev.map((r) =>
                    r.model === model
                      ? { ...r, result: parsed.result, loading: false, progress: null }
                      : r
                  )
                );
              } else if (parsed.stage) {
                setRuns((prev) =>
                  prev.map((r) =>
                    r.model === model ? { ...r, progress: parsed } : r
                  )
                );
              }
            }
          }
        } catch (err) {
          setRuns((prev) =>
            prev.map((r) =>
              r.model === model
                ? {
                    ...r,
                    error: err instanceof Error ? err.message : "Unknown error",
                    loading: false,
                    progress: null,
                  }
                : r
            )
          );
        }
      })();
    }
  }

  // Completed runs for comparison table
  const completedRuns = runs.filter((r) => r.result != null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Live Analysis Mode</h1>
      <p className="text-sm text-[var(--color-muted-foreground)] mb-6">
        Enter a custom forecasting question, select one or more models, and
        generate causal networks with sensitivity probes in real-time via
        OpenRouter. Requires your own{" "}
        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
          OpenRouter API key
        </a>
        {" "}(free to create, pay-per-use).
      </p>

      {!apiKey && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4 mb-6 flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-400 shrink-0">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
          <div>
            <p className="text-sm font-medium text-orange-400">API key required</p>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
              Click the key icon in the top-right corner of the navigation bar to set your OpenRouter API key.
              You can get one for free at{" "}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
                openrouter.ai/keys
              </a>.
            </p>
          </div>
        </div>
      )}

      {/* Question format guidance */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-secondary)]/50 p-4 mb-6">
        <h3 className="text-sm font-medium mb-2">Question Format</h3>
        <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed mb-2">
          This tool works best with{" "}
          <strong className="text-[var(--color-foreground)]">
            complex, multi-cause binary questions
          </strong>{" "}
          where the outcome depends on multiple interacting factors across
          different domains (e.g., geopolitical conflicts, multi-stakeholder
          policy decisions, technology ecosystem dynamics). The model builds a
          causal DAG with 6&ndash;10 factor nodes, so questions need enough
          causal structure to produce a meaningful network. Simple questions
          with one or two drivers won&apos;t generate useful sensitivity
          profiles.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-[var(--color-positive)] font-medium mb-1">
              Good examples (complex, multi-cause)
            </p>
            <ul className="space-y-1 text-[var(--color-muted-foreground)]">
              <li>
                &ldquo;Will the U.S. enter a recession in Trump&apos;s second term?&rdquo;
              </li>
              <li>
                &ldquo;Will China attempt to invade Taiwan by 2027?&rdquo;
              </li>
              <li>
                &ldquo;Will a new pandemic emerge in 2026?&rdquo;
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[var(--color-destructive)] font-medium mb-1">
              Won&apos;t work well
            </p>
            <ul className="space-y-1 text-[var(--color-muted-foreground)]">
              <li>
                &ldquo;What will Trump do about tariffs?&rdquo; (open-ended)
              </li>
              <li>
                &ldquo;Who will win the 2028 election?&rdquo; (multi-outcome)
              </li>
              <li>
                &ldquo;Will AAPL close above $200 on Friday?&rdquo; (single-factor)
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Input form */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Question{" "}
              <span className="text-[var(--color-destructive)]">*</span>
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Will [event] happen before [date]?"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Background Context
            </label>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="Additional context about the question..."
              rows={3}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] resize-y"
            />
          </div>

          {/* Model selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Models
            </label>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {debateEnabled
                  ? "Select exactly 2 models for debate."
                  : "Select up to 4 models to compare."}
                <span className="ml-1 font-mono text-[var(--color-primary)]">
                  {selectedModels.length}/{debateEnabled ? 2 : 4} selected
                </span>
              </p>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={debateEnabled}
                  onChange={(e) => {
                    setDebateEnabled(e.target.checked);
                    setDebateRounds([]);
                    if (e.target.checked && selectedModels.length > 2) {
                      setSelectedModels(selectedModels.slice(0, 2));
                    }
                  }}
                  className="rounded"
                />
                <span className="font-medium text-[var(--color-primary)]">Multi-model debate</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {MODELS.map((m) => {
                const selected = selectedModels.includes(m.value);
                const maxModels = debateEnabled ? 2 : 4;
                const atMax = selectedModels.length >= maxModels && !selected;
                return (
                  <button
                    key={m.value}
                    onClick={() => toggleModel(m.value)}
                    disabled={atMax}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                      selected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
                        : atMax
                          ? "border-[var(--color-border)] bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] opacity-40 cursor-not-allowed"
                          : "border-[var(--color-border)] bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--color-muted-foreground)]"
                    }`}
                  >
                    {selected ? <span className="mr-1">✓</span> : <span className="mr-1 opacity-40">○</span>}
                    {m.label}
                  </button>
                );
              })}
              {/* Custom models already added */}
              {selectedModels
                .filter((m) => !MODELS.some((mod) => mod.value === m))
                .map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleModel(m)}
                    className="px-3 py-1.5 text-xs rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
                  >
                    <span className="mr-1">✓</span>
                    {m.split("/").pop()}
                  </button>
                ))}
              <button
                onClick={() => setShowCustom(!showCustom)}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  showCustom
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
                    : "border-[var(--color-border)] bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--color-muted-foreground)]"
                }`}
              >
                Other...
              </button>
            </div>
            {showCustom && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="OpenRouter model ID (e.g. anthropic/claude-sonnet-4)"
                  className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
                <button
                  onClick={() => {
                    const id = customModel.trim();
                    if (id && !selectedModels.includes(id) && selectedModels.length < 4) {
                      setSelectedModels((prev) => [...prev, id]);
                      setCustomModel("");
                      setShowCustom(false);
                    }
                  }}
                  disabled={!customModel.trim() || selectedModels.length >= 4}
                  className="px-3 py-1.5 text-xs rounded-md bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={anyLoading || !question.trim() || !apiKey.trim() || selectedModels.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {anyLoading
              ? "Analyzing..."
              : selectedModels.length > 1
                ? `Analyze with ${selectedModels.length} Models`
                : "Analyze"}
          </button>
        </div>
      </div>

      {/* Loading indicators */}
      {runs.some((r) => r.loading) && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 mb-6">
          <div className="space-y-4">
            {runs.map((r) => {
              const pct =
                r.progress?.current != null && r.progress?.total
                  ? Math.round((r.progress.current / r.progress.total) * 100)
                  : null;
              // Estimate percentage for non-probe stages
              const displayPct = r.result
                ? 100
                : pct != null
                  ? pct
                  : r.progress?.stage?.includes("Computing")
                    ? 95
                    : r.progress?.stage?.includes("Analyzing")
                      ? 15
                      : r.progress?.stage?.includes("generated")
                        ? 12
                        : r.progress?.stage?.includes("Generating")
                          ? 5
                          : 0;

              return (
                <div key={r.model}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {r.result ? (
                        <span className="text-[var(--color-positive)]">&#10003;</span>
                      ) : r.error ? (
                        <span className="text-[var(--color-destructive)]">&#10007;</span>
                      ) : (
                        <span className="text-[var(--color-muted-foreground)]">&#9676;</span>
                      )}
                    </span>
                    <span
                      className={`text-sm font-medium ${r.loading ? "text-[var(--color-foreground)]" : "text-[var(--color-muted-foreground)]"}`}
                    >
                      {r.label}
                    </span>
                    {r.result && (
                      <span className="text-xs ml-auto font-mono" style={{ color: probToColor(r.result.initial_probability) }}>
                        {formatProbability(r.result.initial_probability)}
                      </span>
                    )}
                    {r.error && (
                      <span className="text-xs text-[var(--color-destructive)] ml-auto">
                        Failed
                      </span>
                    )}
                    {r.loading && displayPct != null && (
                      <span className="text-xs text-[var(--color-muted-foreground)] ml-auto font-mono">
                        {displayPct}%
                      </span>
                    )}
                  </div>
                  {r.loading && (
                    <div className="ml-6">
                      <div className="h-1.5 w-full bg-[var(--color-secondary)] rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${displayPct ?? 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {r.progress?.stage ?? "Starting pipeline..."}
                        {r.progress?.current != null && r.progress?.total != null && (
                          <span className="font-mono ml-1">
                            ({r.progress.current}/{r.progress.total})
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi-model comparison table */}
      {completedRuns.length > 1 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 mb-6">
          <h3 className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3">
            Model Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[var(--color-muted-foreground)]">
                  <th className="text-left py-1 pr-4">Metric</th>
                  {completedRuns.map((r) => (
                    <th key={r.model} className="text-right py-1 px-3">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                <tr className="border-t border-[var(--color-border)]">
                  <td className="py-1.5 pr-4 text-[var(--color-muted-foreground)]">Baseline P</td>
                  {completedRuns.map((r) => (
                    <td
                      key={r.model}
                      className="py-1.5 px-3 text-right"
                      style={{ color: probToColor(r.result!.initial_probability) }}
                    >
                      {formatProbability(r.result!.initial_probability)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-[var(--color-border)]">
                  <td className="py-1.5 pr-4 text-[var(--color-muted-foreground)]">Nodes / Edges</td>
                  {completedRuns.map((r) => (
                    <td key={r.model} className="py-1.5 px-3 text-right">
                      {r.result!.network_analysis.n_nodes} / {r.result!.network_analysis.n_edges}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-[var(--color-border)]">
                  <td className="py-1.5 pr-4 text-[var(--color-muted-foreground)]">SSR</td>
                  {completedRuns.map((r) => (
                    <td key={r.model} className="py-1.5 px-3 text-right">
                      {r.result!.aggregate_metrics.ssr?.toFixed(2) ?? "N/A"}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-[var(--color-border)]">
                  <td className="py-1.5 pr-4 text-[var(--color-muted-foreground)]">Mean |Δ|</td>
                  {completedRuns.map((r) => (
                    <td key={r.model} className="py-1.5 px-3 text-right">
                      {r.result!.summary.mean_absolute_shift != null
                        ? (r.result!.summary.mean_absolute_shift * 100).toFixed(1) + "pp"
                        : "N/A"}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-[var(--color-border)]">
                  <td className="py-1.5 pr-4 text-[var(--color-muted-foreground)]">Asymmetry</td>
                  {completedRuns.map((r) => (
                    <td key={r.model} className="py-1.5 px-3 text-right">
                      {r.result!.aggregate_metrics.asymmetry_index?.toFixed(2) ?? "N/A"}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-[var(--color-border)]">
                  <td className="py-1.5 pr-4 text-[var(--color-muted-foreground)]">FNAR</td>
                  {completedRuns.map((r) => (
                    <td key={r.model} className="py-1.5 px-3 text-right">
                      {r.result!.aggregate_metrics.fnar != null
                        ? (r.result!.aggregate_metrics.fnar * 100).toFixed(0) + "%"
                        : "N/A"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-model results */}
      <div className={debateEnabled && completedRuns.length === 2 ? "grid grid-cols-2 gap-4" : ""}>
      {runs
        .filter((r) => r.result || r.error)
        .map((run) => (
          <div key={run.model} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold">{run.label}</h2>
              {run.result && (
                <span
                  className="text-lg font-mono font-bold"
                  style={{ color: probToColor(run.result.initial_probability) }}
                >
                  {formatProbability(run.result.initial_probability)}
                </span>
              )}
            </div>

            {run.error && (
              <div className="rounded-lg border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 p-4">
                <p className="text-sm text-[var(--color-destructive)]">
                  {run.error}
                </p>
              </div>
            )}

            {run.result && (
              <LiveResultPanel
                result={run.result}
                apiKey={apiKey}
                model={run.model}
              />
            )}
          </div>
        ))}
      </div>

      {/* Debate section */}
      {debateEnabled && completedRuns.length === 2 && (
        <div className="mt-8">
          {debateRounds.length === 0 && !debateLoading && (
            <div className="rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">Start Debate</h3>
              <p className="text-sm text-[var(--color-muted-foreground)] mb-4">
                Both models have completed their independent analysis. Start a 5-round debate
                where they critique each other&apos;s causal networks using probe evidence.
              </p>
              <button
                onClick={handleDebate}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary)]/90 transition-colors"
              >
                Start 5-Round Debate
              </button>
            </div>
          )}
          {(debateRounds.length > 0 || debateLoading) && (
            <DebatePanel
              rounds={debateRounds}
              modelALabel={runs.find((r) => r.model === selectedModels[0])?.label ?? selectedModels[0]}
              modelBLabel={runs.find((r) => r.model === selectedModels[1])?.label ?? selectedModels[1]}
              initialProbA={completedRuns[0]?.result?.initial_probability ?? 0.5}
              initialProbB={completedRuns[1]?.result?.initial_probability ?? 0.5}
              loading={debateLoading}
              currentRound={debateCurrentRound}
            />
          )}
        </div>
      )}
    </div>
  );
}

function LiveResultPanel({
  result,
  apiKey,
  model,
}: {
  result: DetailWithMetrics;
  apiKey: string;
  model: string;
}) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const selectedInfo = useMemo(() => {
    if (!selectedNode) return { type: null, description: null };
    const node = result.network_analysis.node_metrics.find(
      (n) => n.node_id === selectedNode
    );
    if (node) return { type: "node" as const, description: node.description };
    const edge = result.network_analysis.edge_metrics.find(
      (e) => `${e.source}->${e.target}` === selectedNode
    );
    if (edge) return { type: "edge" as const, description: edge.mechanism };
    return { type: null, description: null };
  }, [result, selectedNode]);

  return (
    <div className="space-y-6">
      {/* Baseline */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <ProbabilityBar probability={result.initial_probability} label="Baseline" />
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)] leading-relaxed">
          {result.reasoning}
        </p>
      </div>

      {/* Network + Interactive Probe + Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <h3 className="text-sm font-semibold mb-3">
            Causal Network
            <span className="font-normal text-[var(--color-muted-foreground)] ml-2">
              Click a node to probe it
            </span>
          </h3>
          <CausalNetwork
            nodes={result.network_analysis.node_metrics}
            edges={result.network_analysis.edge_metrics}
            probeResults={result.probe_results}
            onNodeClick={setSelectedNode}
            selectedNodeId={selectedNode}
            height={400}
          />
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-4">
            <InteractiveProbe
              questionText={result.question_text}
              initialProbability={result.initial_probability}
              reasoning={result.reasoning}
              nodes={result.nodes}
              edges={result.edges}
              selectedTargetId={selectedNode}
              selectedTargetType={selectedInfo.type}
              selectedTargetDescription={selectedInfo.description}
              defaultModel={model}
            />
          </div>

          <MetricsPanel
            metrics={result.aggregate_metrics}
            network={result.network_analysis}
          />

          {result.epistemic_ratings && result.epistemic_ratings.length > 0 && (
            <InformationPriorities ratings={result.epistemic_ratings} />
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="text-sm font-semibold mb-3">Delta Distribution</h3>
        <DeltaBarChart
          results={result.probe_results}
          initialProbability={result.initial_probability}
        />
      </div>

      {/* Probes */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Automated Probe Results</h3>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(result, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `live-${result.question_id}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-xs text-[var(--color-primary)] hover:underline"
          >
            Export JSON
          </button>
        </div>
        <ProbeTable
          results={result.probe_results}
          initialProbability={result.initial_probability}
          onSelectProbe={setSelectedNode}
          selectedTargetId={selectedNode}
        />
      </div>
    </div>
  );
}

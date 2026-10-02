"use client";

import { useState } from "react";
import { Check, Download, Plus } from "lucide-react";
import { useApiKey } from "@/lib/api-key-context";
import { OTHER_LIVE_MODELS, PAPER_MODELS, openRouterLabel } from "@/lib/models";
import { ApiKeyField } from "@/components/api-key-settings";
import { BaselineCard, QuestionAnalysis, type AnalysisData } from "@/components/question-analysis";
import { InformationPriorities, type EpistemicRating } from "@/components/information-priorities";
import { cn, formatPp, formatProbability } from "@/lib/utils";

interface LiveResult extends AnalysisData {
  epistemic_ratings?: EpistemicRating[];
}

interface ModelProgress {
  stage: string;
  current?: number;
  total?: number;
}

interface ModelRun {
  model: string;
  label: string;
  result: LiveResult | null;
  loading: boolean;
  error: string | null;
  progress: ModelProgress | null;
}

const MAX_MODELS = 4;

const EXAMPLES_GOOD = [
  "Will the U.S. enter a recession before the end of 2027?",
  "Will China attempt to invade Taiwan by 2027?",
  "Will a new pandemic be declared by the WHO in 2026?",
];
const EXAMPLES_BAD = [
  ["What will Trump do about tariffs?", "open-ended, not yes/no"],
  ["Who will win the 2028 election?", "more than two outcomes"],
  ["Will AAPL close above $200 on Friday?", "one dominant driver"],
];

/** Rough overall progress from the pipeline's stage messages. */
function progressPercent(p: ModelProgress | null): number {
  if (!p) return 2;
  if (p.current != null && p.total) return Math.round(15 + (p.current / p.total) * 73);
  if (p.stage.includes("Computing")) return 96;
  if (p.stage.includes("Rating")) return 90;
  if (p.stage.includes("Analyzing")) return 14;
  if (p.stage.includes("generated")) return 12;
  if (p.stage.includes("Generating")) return 5;
  return 2;
}

export default function LivePage() {
  const { apiKey } = useApiKey();
  const [question, setQuestion] = useState("");
  const [background, setBackground] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([PAPER_MODELS[1].openrouter]);
  const [customModel, setCustomModel] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [runs, setRuns] = useState<ModelRun[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const anyLoading = runs.some((r) => r.loading);
  const atMax = selectedModels.length >= MAX_MODELS;

  function toggleModel(value: string) {
    setSelectedModels((prev) =>
      prev.includes(value) ? prev.filter((m) => m !== value) : prev.length >= MAX_MODELS ? prev : [...prev, value]
    );
  }

  function updateRun(model: string, patch: Partial<ModelRun>) {
    setRuns((prev) => prev.map((r) => (r.model === model ? { ...r, ...patch } : r)));
  }

  async function runModel(model: string) {
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
        let message = `Request failed (HTTP ${res.status})`;
        try {
          const errData = JSON.parse(text);
          if (errData.error) message = errData.error;
        } catch {
          /* keep default */
        }
        throw new Error(message);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("The server returned no data.");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data: ")) continue;
          let parsed;
          try {
            parsed = JSON.parse(line.slice(6));
          } catch {
            continue; // partial packet
          }
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.done && parsed.result) updateRun(model, { result: parsed.result, loading: false, progress: null });
          else if (parsed.stage) updateRun(model, { progress: parsed });
        }
      }
    } catch (err) {
      updateRun(model, {
        error: err instanceof Error ? err.message : "Unknown error",
        loading: false,
        progress: null,
      });
    }
  }

  function handleAnalyze() {
    if (!question.trim() || selectedModels.length === 0 || !apiKey.trim()) return;
    setRuns(
      selectedModels.map((m) => ({
        model: m,
        label: openRouterLabel(m),
        result: null,
        loading: true,
        error: null,
        progress: null,
      }))
    );
    setActiveTab(selectedModels[0]);
    selectedModels.forEach((m) => void runModel(m));
  }

  const completed = runs.filter((r) => r.result != null);
  const shown = runs.find((r) => r.model === activeTab) ?? runs[0];
  const canRun = !anyLoading && question.trim() && apiKey.trim() && selectedModels.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6">
      <header className="max-w-3xl">
        <h1 className="font-display text-4xl tracking-tight text-ink sm:text-5xl">Run your own question</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          Enter a yes/no forecasting question and pick up to four models. Each one builds a causal network, writes
          and answers up to 16 probes, and reports the same measures as the question pages. Calls go through
          OpenRouter with your own API key.
        </p>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-rule bg-surface p-5 sm:p-6">
          <div className="space-y-5">
            <div>
              <label htmlFor="q" className="block text-sm font-medium text-ink">
                Question
              </label>
              <input
                id="q"
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canRun && handleAnalyze()}
                placeholder="Will [event] happen before [date]?"
                className="mt-1.5 w-full rounded-md border border-rule bg-paper px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="bg" className="block text-sm font-medium text-ink">
                Background <span className="font-normal text-ink-3">(optional)</span>
              </label>
              <textarea
                id="bg"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                placeholder="Context the model should know, such as recent events or how the question resolves."
                rows={3}
                className="mt-1.5 w-full resize-y rounded-md border border-rule bg-paper px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
              />
            </div>

            <fieldset>
              <legend className="flex w-full items-baseline justify-between text-sm font-medium text-ink">
                Models
                <span className="num text-xs font-normal text-ink-3">
                  {selectedModels.length} of {MAX_MODELS}
                </span>
              </legend>
              <p className="eyebrow mb-1.5 mt-3">From the paper</p>
              <div className="flex flex-wrap gap-1.5">
                {PAPER_MODELS.map((m) => (
                  <ModelChip
                    key={m.key}
                    label={m.label}
                    selected={selectedModels.includes(m.openrouter)}
                    disabled={atMax && !selectedModels.includes(m.openrouter)}
                    onClick={() => toggleModel(m.openrouter)}
                  />
                ))}
              </div>
              <p className="eyebrow mb-1.5 mt-3">Other models</p>
              <div className="flex flex-wrap gap-1.5">
                {OTHER_LIVE_MODELS.map((m) => (
                  <ModelChip
                    key={m.openrouter}
                    label={m.label}
                    selected={selectedModels.includes(m.openrouter)}
                    disabled={atMax && !selectedModels.includes(m.openrouter)}
                    onClick={() => toggleModel(m.openrouter)}
                  />
                ))}
                {selectedModels
                  .filter((m) => !PAPER_MODELS.some((p) => p.openrouter === m) && !OTHER_LIVE_MODELS.some((o) => o.openrouter === m))
                  .map((m) => (
                    <ModelChip key={m} label={m} selected onClick={() => toggleModel(m)} />
                  ))}
                <button
                  type="button"
                  onClick={() => setShowCustom(!showCustom)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-rule-strong px-3 py-1 text-xs text-ink-2 hover:text-ink"
                >
                  <Plus size={12} aria-hidden /> Another OpenRouter model
                </button>
              </div>
              {showCustom && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="OpenRouter model ID, e.g. moonshotai/kimi-k2"
                    aria-label="OpenRouter model ID"
                    className="min-w-0 flex-1 rounded-md border border-rule bg-paper px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const id = customModel.trim();
                      if (id && !selectedModels.includes(id) && !atMax) {
                        setSelectedModels((prev) => [...prev, id]);
                        setCustomModel("");
                        setShowCustom(false);
                      }
                    }}
                    disabled={!customModel.trim() || atMax}
                    className="rounded-md bg-ink px-3 text-xs font-medium text-paper disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              )}
            </fieldset>

            {!apiKey && (
              <div className="rounded-lg border border-accent/30 bg-accent-soft/50 p-4">
                <ApiKeyField compact />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-5">
              <button
                onClick={handleAnalyze}
                disabled={!canRun}
                className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {anyLoading
                  ? "Running…"
                  : selectedModels.length > 1
                    ? `Run with ${selectedModels.length} models`
                    : "Run analysis"}
              </button>
              {!question.trim() && <span className="text-xs text-ink-3">Enter a question to start.</span>}
            </div>
          </div>
        </section>

        <aside className="self-start rounded-xl border border-rule bg-paper p-5 text-sm">
          <h2 className="font-display text-lg text-ink">What works well</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-2">
            Yes/no questions whose outcome depends on several interacting causes. The model builds a network of 6–10
            factors, so a question with one or two drivers gives little to probe.
          </p>
          <p className="eyebrow mb-1.5 mt-4">Good questions</p>
          <ul className="space-y-1.5">
            {EXAMPLES_GOOD.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => setQuestion(q)}
                  className="text-left text-xs leading-snug text-ink hover:text-accent-ink"
                  title="Use this question"
                >
                  “{q}”
                </button>
              </li>
            ))}
          </ul>
          <p className="eyebrow mb-1.5 mt-4">Less useful</p>
          <ul className="space-y-1.5 text-xs leading-snug text-ink-2">
            {EXAMPLES_BAD.map(([q, why]) => (
              <li key={q}>
                “{q}” <span className="text-ink-3">· {why}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {runs.length > 0 && (
        <section aria-label="Run status" className="mt-8 rounded-xl border border-rule bg-surface p-4 sm:p-5">
          <ul className="space-y-3">
            {runs.map((r) => {
              const pct = r.result ? 100 : progressPercent(r.progress);
              return (
                <li key={r.model}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-ink">
                      {r.result ? (
                        <Check size={14} className="text-[#2f9e6b]" aria-hidden />
                      ) : r.error ? (
                        <span className="text-up" aria-hidden>
                          ✕
                        </span>
                      ) : (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden />
                      )}
                      {r.label}
                    </span>
                    <span className="num text-xs text-ink-2">
                      {r.result
                        ? `forecast ${formatProbability(r.result.initial_probability)}`
                        : r.error
                          ? "failed"
                          : `${pct}%`}
                    </span>
                  </div>
                  {r.loading && (
                    <>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-ink-3">
                        {r.progress?.stage ?? "Starting…"}
                        {r.progress?.current != null && r.progress?.total != null && (
                          <span className="num ml-1">
                            ({r.progress.current}/{r.progress.total})
                          </span>
                        )}
                      </p>
                    </>
                  )}
                  {r.error && <p className="mt-1 text-xs text-up">{r.error}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {completed.length > 1 && (
        <section aria-labelledby="compare-heading" className="mt-6 overflow-x-auto rounded-xl border border-rule bg-surface p-4 sm:p-5">
          <h2 id="compare-heading" className="font-display text-xl text-ink">
            Side by side
          </h2>
          <table className="mt-3 w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="eyebrow py-2 pr-4 text-left font-semibold">Measure</th>
                {completed.map((r) => (
                  <th key={r.model} className="py-2 pl-3 text-right text-xs font-medium text-ink">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="num text-xs">
              {(
                [
                  ["Baseline forecast", (r: LiveResult) => formatProbability(r.initial_probability)],
                  ["Factors / links", (r: LiveResult) => `${r.network_analysis.n_nodes - 1} / ${r.network_analysis.n_edges}`],
                  [
                    "Average shift",
                    (r: LiveResult) => (r.summary.mean_absolute_shift != null ? formatPp(r.summary.mean_absolute_shift) : "—"),
                  ],
                  ["Structural sensitivity ratio", (r: LiveResult) => (r.aggregate_metrics.ssr != null ? `${r.aggregate_metrics.ssr.toFixed(2)}×` : "—")],
                  [
                    "Strengthen vs. negate",
                    (r: LiveResult) =>
                      r.aggregate_metrics.mean_shift_negate > 0
                        ? `${(r.aggregate_metrics.mean_shift_strengthen / r.aggregate_metrics.mean_shift_negate).toFixed(2)}×`
                        : "—",
                  ],
                  [
                    "Control probes > 5pp",
                    (r: LiveResult) =>
                      r.aggregate_metrics.control_sensitivity != null
                        ? `${Math.round(r.aggregate_metrics.control_sensitivity * 100)}%`
                        : "—",
                  ],
                ] as Array<[string, (r: LiveResult) => string]>
              ).map(([label, fn]) => (
                <tr key={label} className="border-b border-rule last:border-b-0">
                  <td className="py-2 pr-4 font-sans text-ink-2">{label}</td>
                  {completed.map((r) => (
                    <td key={r.model} className="py-2 pl-3 text-right text-ink">
                      {fn(r.result!)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {runs.some((r) => r.result) && shown && (
        <section className="mt-10">
          {runs.length > 1 && (
            <div role="tablist" aria-label="Model results" className="mb-6 flex gap-1 overflow-x-auto border-b border-rule">
              {runs.map((r) => (
                <button
                  key={r.model}
                  role="tab"
                  aria-selected={r.model === shown.model}
                  disabled={!r.result}
                  onClick={() => setActiveTab(r.model)}
                  className={cn(
                    "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors disabled:opacity-40",
                    r.model === shown.model ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink"
                  )}
                >
                  {r.label}
                  {r.result && <span className="num ml-2 text-xs text-ink-3">{formatProbability(r.result.initial_probability)}</span>}
                </button>
              ))}
            </div>
          )}
          {shown.result && (
            <div key={shown.model}>
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(shown.result, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `causal-forecast-${shown.model.replace(/\//g, "_")}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-xs text-ink-2 hover:text-ink"
                >
                  <Download size={13} aria-hidden /> Download results (JSON)
                </button>
              </div>
              <BaselineCard
                probability={shown.result.initial_probability}
                reasoning={shown.result.reasoning}
                modelName={shown.label}
              />
              <div className="mt-6">
                <QuestionAnalysis
                  data={shown.result}
                  modelId={shown.model}
                  sidebarExtra={
                    shown.result.epistemic_ratings?.length ? (
                      <InformationPriorities ratings={shown.result.epistemic_ratings} />
                    ) : undefined
                  }
                />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ModelChip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        selected
          ? "border-accent bg-accent-soft font-medium text-accent-ink"
          : "border-rule bg-paper text-ink-2 hover:border-rule-strong hover:text-ink",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      {selected && <Check size={12} aria-hidden />}
      {label}
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useApiKey } from "@/lib/api-key-context";
import { OTHER_LIVE_MODELS, PAPER_MODELS, openRouterLabel } from "@/lib/models";
import { cn, deltaClass, formatDelta, formatProbability } from "@/lib/utils";
import { ApiKeyField } from "./api-key-settings";

interface InteractiveProbeProps {
  questionText: string;
  initialProbability: number;
  reasoning: string;
  nodes: Array<{ id: string; description: string; role: string }>;
  edges: Array<{ from: string; to: string; mechanism: string }>;
  selectedTargetId: string | null;
  selectedTargetType: "node" | "edge" | null;
  /** Readable name of the selected factor or link */
  selectedTargetLabel: string | null;
  /** OpenRouter model ID used for the original forecast */
  defaultModel: string;
}

interface ProbeResponse {
  updated_probability: number;
  shift_direction: string;
  reasoning: string;
}

interface HistoryItem {
  target: string;
  model: string;
  probeText: string;
  response: ProbeResponse;
}

export function InteractiveProbe({
  questionText,
  initialProbability,
  reasoning,
  nodes,
  edges,
  selectedTargetId,
  selectedTargetType,
  selectedTargetLabel,
  defaultModel,
}: InteractiveProbeProps) {
  const { apiKey } = useApiKey();
  const [probeText, setProbeText] = useState("");
  const [model, setModel] = useState(defaultModel);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => setModel(defaultModel), [defaultModel]);

  const knownModel =
    PAPER_MODELS.some((m) => m.openrouter === model) || OTHER_LIVE_MODELS.some((m) => m.openrouter === model);

  async function handleProbe() {
    if (!probeText.trim() || !apiKey.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questionText,
          initial_probability: initialProbability,
          reasoning,
          nodes,
          edges,
          probe_text: probeText.trim(),
          target_id: selectedTargetId,
          target_type: selectedTargetType,
          model,
          api_key: apiKey,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (HTTP ${res.status})`);
      }
      const data: ProbeResponse = await res.json();
      setHistory((prev) => [
        { target: selectedTargetLabel ?? "Whole network", model, probeText: probeText.trim(), response: data },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const latest = history[0];

  return (
    <div className="space-y-3">
      <div>
        <p className="eyebrow mb-1">Write your own probe</p>
        <p className="text-xs leading-relaxed text-ink-2">
          {selectedTargetLabel ? (
            <>
              Aimed at <span className="font-cond font-semibold text-ink">{selectedTargetLabel}</span>. The model
              sees its original network and your text, then gives a new probability.
            </>
          ) : (
            "Select a factor or link first, or write a probe about the network as a whole. The model sees its original network and your text, then gives a new probability."
          )}
        </p>
      </div>

      {!apiKey ? (
        <div className="rounded-md border border-rule bg-paper p-3">
          <ApiKeyField compact />
        </div>
      ) : (
        <>
          <textarea
            value={probeText}
            onChange={(e) => setProbeText(e.target.value)}
            placeholder={
              selectedTargetLabel
                ? `e.g. New evidence suggests ${selectedTargetLabel} matters far less than assumed, because…`
                : "e.g. A new report finds that…"
            }
            rows={4}
            className="w-full resize-y rounded-md border border-rule bg-paper px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          <div className="flex gap-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              aria-label="Model"
              className="min-w-0 flex-1 rounded-md border border-rule bg-paper px-2 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              {!knownModel && <option value={model}>{openRouterLabel(model)}</option>}
              <optgroup label="Models from the paper">
                {PAPER_MODELS.map((m) => (
                  <option key={m.key} value={m.openrouter}>
                    {m.label}
                    {m.openrouter === defaultModel ? " (original)" : ""}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Other models">
                {OTHER_LIVE_MODELS.map((m) => (
                  <option key={m.openrouter} value={m.openrouter}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <button
              onClick={handleProbe}
              disabled={loading || !probeText.trim()}
              className="shrink-0 rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Running…" : "Run probe"}
            </button>
          </div>
          {model !== defaultModel && (
            <p className="text-[11px] text-ink-3">
              Note: this network was built by a different model. Results show how {openRouterLabel(model)} reads it.
            </p>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-up/30 bg-up-soft px-3 py-2 text-xs text-up">
          {error}
        </p>
      )}

      {latest && (
        <div className="rounded-md border border-rule bg-paper p-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="num text-sm text-ink">
              {formatProbability(initialProbability)} → <strong>{formatProbability(latest.response.updated_probability)}</strong>
            </span>
            <span className={cn("num text-sm font-medium", deltaClass(latest.response.updated_probability - initialProbability))}>
              {formatDelta(latest.response.updated_probability - initialProbability)}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-2">{latest.response.reasoning}</p>
        </div>
      )}

      {history.length > 1 && (
        <div>
          <p className="eyebrow mb-1.5">Earlier probes</p>
          <ul className="space-y-1.5">
            {history.slice(1).map((h, i) => {
              const d = h.response.updated_probability - initialProbability;
              return (
                <li key={i} className="rounded-md border border-rule px-2.5 py-2 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-cond text-ink">{h.target}</span>
                    <span className={cn("num shrink-0", deltaClass(d))}>{formatDelta(d)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-ink-3">{h.probeText}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

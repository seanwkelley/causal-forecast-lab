"use client";

import { useState } from "react";
import { ProbabilityBar } from "./probability-bar";
import { formatProbability, formatDelta, deltaColor } from "@/lib/utils";

interface InteractiveProbeProps {
  questionText: string;
  initialProbability: number;
  reasoning: string;
  nodes: Array<{ id: string; description: string; role: string }>;
  edges: Array<{ from: string; to: string; mechanism: string }>;
  selectedTargetId: string | null;
  selectedTargetType: "node" | "edge" | null;
  selectedTargetDescription: string | null;
  defaultApiKey?: string;
  defaultModel?: string;
}

interface ProbeResponse {
  updated_probability: number;
  shift_direction: string;
  reasoning: string;
}

export function InteractiveProbe({
  questionText,
  initialProbability,
  reasoning,
  nodes,
  edges,
  selectedTargetId,
  selectedTargetType,
  selectedTargetDescription,
  defaultApiKey,
  defaultModel,
}: InteractiveProbeProps) {
  const [probeText, setProbeText] = useState("");
  const [apiKey, setApiKey] = useState(() => {
    if (defaultApiKey) return defaultApiKey;
    if (typeof window !== "undefined") {
      return localStorage.getItem("openrouter_api_key") ?? "";
    }
    return "";
  });
  const [model, setModel] = useState(defaultModel ?? "meta-llama/llama-3.3-70b-instruct");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProbeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{
      targetId: string;
      probeText: string;
      response: ProbeResponse;
    }>
  >([]);

  async function handleProbe() {
    if (!probeText.trim() || !apiKey.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

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
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data: ProbeResponse = await res.json();
      setResult(data);
      setHistory((prev) => [
        {
          targetId: selectedTargetId || "general",
          probeText: probeText.trim(),
          response: data,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Interactive Probe</h3>
        {selectedTargetId && (
          <span className="text-xs text-[var(--color-primary)] font-mono">
            Target: {selectedTargetId}
          </span>
        )}
      </div>

      {selectedTargetDescription && (
        <p className="text-xs text-[var(--color-muted-foreground)] italic">
          {selectedTargetDescription}
        </p>
      )}

      {/* API key (persisted in localStorage) */}
      <p className="text-[10px] text-[var(--color-muted-foreground)]">
        Your key is stored locally in your browser. We recommend regenerating it on{" "}
        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">OpenRouter</a>{" "}
        when you&apos;re done.
      </p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            localStorage.setItem("openrouter_api_key", e.target.value);
          }}
          placeholder="OpenRouter API key (sk-or-...)"
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        >
          <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B</option>
          <option value="deepseek/deepseek-chat-v3-0324">DeepSeek V3</option>
          <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
          <option value="openai/gpt-4o">GPT-4o</option>
        </select>
      </div>

      {/* Probe input */}
      <textarea
        value={probeText}
        onChange={(e) => setProbeText(e.target.value)}
        placeholder={
          selectedTargetId
            ? `Write a counterfactual challenging "${selectedTargetId}"...\n\nExample: "What if this factor actually had the opposite effect..."`
            : "Select a node or edge in the network, then write a counterfactual here..."
        }
        rows={3}
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] resize-y placeholder:text-[var(--color-muted-foreground)]/60"
      />

      <button
        onClick={handleProbe}
        disabled={loading || !probeText.trim() || !apiKey.trim()}
        className="w-full rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Probing..." : "Run Probe"}
      </button>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 p-3">
          <p className="text-xs text-[var(--color-destructive)]">{error}</p>
        </div>
      )}

      {/* Current result */}
      {result && (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Updated Probability
            </span>
            <span className="font-mono text-sm font-bold">
              {formatProbability(result.updated_probability)}
            </span>
          </div>
          <ProbabilityBar
            probability={result.updated_probability}
            showValue={false}
            size="sm"
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-muted-foreground)]">
              Baseline: {formatProbability(initialProbability)}
            </span>
            <span
              className={`font-mono font-medium ${deltaColor(result.updated_probability - initialProbability)}`}
            >
              {formatDelta(result.updated_probability - initialProbability)}
            </span>
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed mt-2">
            {result.reasoning}
          </p>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
            Probe History
          </h4>
          {history.slice(1).map((h, i) => {
            const delta = h.response.updated_probability - initialProbability;
            return (
              <div
                key={i}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[var(--color-primary)]">
                    {h.targetId}
                  </span>
                  <span className={`font-mono font-medium ${deltaColor(delta)}`}>
                    {formatDelta(delta)}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--color-muted-foreground)] mt-1 line-clamp-2">
                  {h.probeText}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

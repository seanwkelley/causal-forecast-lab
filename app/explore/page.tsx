"use client";

import { useState, useEffect, useMemo } from "react";
import { QuestionCard } from "@/components/question-card";

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
  max_absolute_shift?: number | null;
  ssr?: number | null;
}

interface ModelInfo {
  label: string;
  total_questions: number;
  avg_ssr: number | null;
}

interface SummaryData {
  total_questions: number;
  // New multi-model format
  models?: Record<string, ModelInfo>;
  default_model?: string;
  // Legacy single-model format
  model?: string;
  questions: QuestionEntry[];
}

export default function ExplorePage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [search, setSearch] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/summary.json")
      .then((r) => r.json())
      .then((d: SummaryData) => {
        setData(d);
        // Set default model
        if (d.models) {
          setSelectedModel(d.default_model || Object.keys(d.models)[0] || "");
        } else if (d.model) {
          setSelectedModel(d.model);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const isMultiModel = !!(data?.models && Object.keys(data.models).length > 0);
  const modelKeys = isMultiModel ? Object.keys(data!.models!) : [];

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.questions;

    // Filter to questions available for selected model (multi-model only)
    if (isMultiModel && selectedModel) {
      list = list.filter((q) => q.models?.includes(selectedModel));
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (item) =>
          item.question_text.toLowerCase().includes(q) ||
          item.question_id.toLowerCase().includes(q) ||
          item.source.toLowerCase().includes(q)
      );
    }

    return list;
  }, [data, search, selectedModel, isMultiModel]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <div className="animate-pulse text-[var(--color-muted-foreground)]">
          Loading questions...
        </div>
      </div>
    );
  }

  if (!data || data.questions.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Pre-Selected Questions</h1>
        <p className="text-[var(--color-muted-foreground)]">
          No pre-computed data found. Run{" "}
          <code className="font-mono bg-[var(--color-secondary)] px-1 rounded">
            npm run prepare-data
          </code>{" "}
          to generate data from sensitivity pipeline outputs.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pre-Selected Questions</h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
            {filtered.length} questions
            {!isMultiModel && data.model && <> &middot; {data.model}</>}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        {/* Model selector (multi-model only) */}
        {isMultiModel && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Model:
            </span>
            <div className="flex items-center gap-1">
              {modelKeys.map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedModel(key)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    selectedModel === key
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                  }`}
                >
                  {data.models![key].label}
                </button>
              ))}
            </div>
          </div>
        )}

        <input
          type="text"
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 gap-3">
        {filtered.map((q) => (
          <QuestionCard
            key={q.question_id}
            q={q}
            model={isMultiModel ? selectedModel : undefined}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-[var(--color-muted-foreground)] py-8">
          No questions match your search.
        </p>
      )}
    </div>
  );
}

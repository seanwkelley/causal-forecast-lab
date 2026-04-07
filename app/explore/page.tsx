"use client";

import { useState, useEffect, useMemo } from "react";
import { QuestionCard } from "@/components/question-card";

interface QuestionEntry {
  question_id: string;
  question_text: string;
  source: string;
  category?: string;
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

const CATEGORY_ORDER = [
  "Conflict & Security",
  "Politics & Governance",
  "Finance & Economics",
  "Climate & Energy",
  "Health & Science",
  "Technology",
  "Society & Culture",
  "Other",
];

export default function ExplorePage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [search, setSearch] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
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

    if (selectedCategory !== "all") {
      list = list.filter((q) => (q.category || "Other") === selectedCategory);
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
  }, [data, search, selectedModel, selectedCategory, isMultiModel]);

  // Group filtered questions by category
  const grouped = useMemo(() => {
    const groups: Record<string, QuestionEntry[]> = {};
    for (const q of filtered) {
      const cat = q.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(q);
    }
    // Sort by predefined order
    const sorted: [string, QuestionEntry[]][] = [];
    for (const cat of CATEGORY_ORDER) {
      if (groups[cat]) sorted.push([cat, groups[cat]]);
    }
    // Add any categories not in the predefined order
    for (const cat of Object.keys(groups)) {
      if (!CATEGORY_ORDER.includes(cat)) sorted.push([cat, groups[cat]]);
    }
    return sorted;
  }, [filtered]);

  // Available categories (with counts) for the filter
  const categoryOptions = useMemo(() => {
    if (!data) return [];
    let list = data.questions;
    if (isMultiModel && selectedModel) {
      list = list.filter((q) => q.models?.includes(selectedModel));
    }
    const counts: Record<string, number> = {};
    for (const q of list) {
      const cat = q.category || "Other";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return CATEGORY_ORDER.filter((cat) => counts[cat]).map((cat) => ({
      key: cat,
      count: counts[cat],
    }));
  }, [data, selectedModel, isMultiModel]);

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
        <h1 className="text-2xl font-bold mb-4">ForecastBench Examples</h1>
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
          <h1 className="text-2xl font-bold">ForecastBench Examples</h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
            {filtered.length} questions
            {!isMultiModel && data.model && <> &middot; {data.model}</>}
            {" "}&middot; Sampled from{" "}
            <a
              href="https://forecastbench.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] hover:underline"
            >
              ForecastBench
            </a>

            . All questions are binary yes/no with a resolution date. Data-source
            questions (stock prices, economic indicators, weather) are framed as
            directional comparisons (e.g. &ldquo;will X be higher than Y?&rdquo;)
            by the benchmark
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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

        {/* Category filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--color-muted-foreground)]">
            Topic:
          </span>
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              selectedCategory === "all"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            }`}
          >
            All
          </button>
          {categoryOptions.map(({ key, count }) => (
            <button
              key={key}
              onClick={() =>
                setSelectedCategory(selectedCategory === key ? "all" : key)
              }
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                selectedCategory === key
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {key} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Results grouped by category */}
      <div className="space-y-8">
        {grouped.map(([category, questions]) => (
          <div key={category}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
                {category}
              </h2>
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {questions.length}
              </span>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
            </div>
            <div className="grid grid-cols-1 gap-3">
              {questions.map((q) => (
                <QuestionCard
                  key={q.question_id}
                  q={q}
                  model={isMultiModel ? selectedModel : undefined}
                />
              ))}
            </div>
          </div>
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

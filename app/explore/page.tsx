"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { MiniStrip } from "@/components/forecast-strip";
import { DEFAULT_MODEL_KEY, PAPER_MODELS, modelLabel } from "@/lib/models";
import {
  type QuestionEntry,
  type SummaryData,
  TOPIC_ORDER,
  loadSummary,
  marketForecast,
  modelSpread,
  sourceLabel,
} from "@/lib/questions";
import { cn, formatPp } from "@/lib/utils";

type SortKey = "topic" | "spread" | "shift" | "ssr";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "topic", label: "Topic" },
  { key: "spread", label: "Most model disagreement" },
  { key: "shift", label: "Largest average shift" },
  { key: "ssr", label: "Highest SSR" },
];

export default function ExplorePage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ExploreInner />
    </Suspense>
  );
}

function ListSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="h-10 w-48 animate-pulse rounded bg-surface-2" />
      <div className="mt-8 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-2" />
        ))}
      </div>
    </div>
  );
}

function ExploreInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<SummaryData | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");

  const topic = params.get("topic") ?? "all";
  const sort = (params.get("sort") as SortKey) || "topic";
  const model = params.get("model") || DEFAULT_MODEL_KEY;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value == null) next.delete(key);
    else next.set(key, value);
    router.replace(`/explore${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  useEffect(() => {
    loadSummary()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of data?.questions ?? []) {
      const t = q.category || "Other";
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return TOPIC_ORDER.filter((t) => counts[t]).map((t) => ({ topic: t, count: counts[t] }));
  }, [data]);

  const filtered = useMemo(() => {
    let list = data?.questions ?? [];
    if (topic !== "all") list = list.filter((q) => (q.category || "Other") === topic);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (q) => q.question_text.toLowerCase().includes(s) || sourceLabel(q.source).toLowerCase().includes(s)
      );
    }
    const val = (q: QuestionEntry) =>
      sort === "spread"
        ? modelSpread(q) ?? -1
        : sort === "shift"
          ? q.model_mean_shift?.[model] ?? -1
          : sort === "ssr"
            ? q.model_ssr?.[model] ?? -1
            : 0;
    if (sort === "topic") {
      return [...list].sort(
        (a, b) => TOPIC_ORDER.indexOf(a.category ?? "Other") - TOPIC_ORDER.indexOf(b.category ?? "Other")
      );
    }
    return [...list].sort((a, b) => val(b) - val(a));
  }, [data, topic, search, sort, model]);

  const groups = useMemo(() => {
    if (sort !== "topic") return [{ topic: null as string | null, items: filtered }];
    const map = new Map<string, QuestionEntry[]>();
    for (const q of filtered) {
      const t = q.category || "Other";
      map.set(t, [...(map.get(t) ?? []), q]);
    }
    return [...map.entries()].map(([t, items]) => ({ topic: t as string | null, items }));
  }, [filtered, sort]);

  if (failed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="font-display text-3xl text-ink">Questions could not be loaded</h1>
        <p className="mt-3 text-sm text-ink-2">
          The question index (<span className="num">/data/summary.json</span>) is missing. Run{" "}
          <code className="num rounded bg-surface-2 px-1">npm run prepare-data</code> to generate it.
        </p>
      </div>
    );
  }
  if (!data) return <ListSkeleton />;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
      <header className="max-w-3xl">
        <h1 className="font-display text-4xl tracking-tight text-ink sm:text-5xl">Questions</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          {data.total_questions} binary forecasting questions from{" "}
          <a href="https://forecastbench.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            ForecastBench
          </a>
          , chosen because each outcome depends on several interacting causes. Every question was answered by all
          seven models. Open one to see each model&apos;s causal network and how its forecast moved under about 21
          probes.
        </p>
      </header>

      <div className="sticky top-14 z-30 -mx-4 mt-8 border-b border-rule bg-paper/90 px-4 pb-3 pt-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search questions</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions"
              className="w-full rounded-md border border-rule bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 items-center gap-2 text-xs text-ink-3 sm:flex-none">
              Sort
              <select
                value={sort}
                onChange={(e) => setParam("sort", e.target.value === "topic" ? null : e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-rule bg-surface px-2 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 items-center gap-2 text-xs text-ink-3 sm:flex-none">
              Model
              <select
                value={model}
                onChange={(e) => setParam("model", e.target.value === DEFAULT_MODEL_KEY ? null : e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-rule bg-surface px-2 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                {PAPER_MODELS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
          <TopicChip label="All topics" count={data.questions.length} active={topic === "all"} onClick={() => setParam("topic", null)} />
          {topicCounts.map(({ topic: t, count }) => (
            <TopicChip key={t} label={t} count={count} active={topic === t} onClick={() => setParam("topic", topic === t ? null : t)} />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[7px] w-[7px] rounded-full border border-ink-2" /> a model&apos;s forecast
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[9px] w-[9px] rounded-full bg-accent" /> {modelLabel(model)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[7px] w-[7px] rotate-45 bg-ink" /> market forecast
        </span>
        <span>
          Avg shift and SSR are for {modelLabel(model)}.{" "}
          <Link href="/#measures" className="text-accent hover:underline">
            What these mean
          </Link>
        </span>
      </div>

      {/* Column header */}
      <div className="mt-5 hidden grid-cols-[minmax(0,1fr)_200px_80px_64px] gap-6 border-b border-rule px-4 pb-2 md:grid">
        <span className="eyebrow">Question</span>
        <span className="eyebrow flex justify-between">
          <span>0%</span>
          <span>Forecasts</span>
          <span>100%</span>
        </span>
        <span className="eyebrow text-right">Avg shift</span>
        <span className="eyebrow text-right">SSR</span>
      </div>

      {filtered.length === 0 && (
        <p className="py-16 text-center text-sm text-ink-2">
          No questions match “{search}”.{" "}
          <button className="text-accent hover:underline" onClick={() => setSearch("")}>
            Clear search
          </button>
        </p>
      )}

      {groups.map((g) => (
        <section key={g.topic ?? "all"} aria-label={g.topic ?? "Questions"}>
          {g.topic && topic === "all" && (
            <h2 className="mt-8 flex items-baseline gap-3 px-4 pb-1">
              <span className="font-display text-lg text-ink">{g.topic}</span>
              <span className="num text-xs text-ink-3">{g.items.length}</span>
            </h2>
          )}
          <ul className="divide-y divide-rule">
            {g.items.map((q) => (
              <QuestionRow key={q.question_id} q={q} model={model} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TopicChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-ink bg-ink text-paper" : "border-rule bg-surface text-ink-2 hover:border-rule-strong hover:text-ink"
      )}
    >
      {label}
      <span className="num ml-1.5 opacity-60">{count}</span>
    </button>
  );
}

function QuestionRow({ q, model }: { q: QuestionEntry; model: string }) {
  const shift = q.model_mean_shift?.[model];
  const ssr = q.model_ssr?.[model];
  return (
    <li>
      <Link
        href={`/explore/${encodeURIComponent(q.question_id)}?model=${model}`}
        className="group grid gap-x-6 gap-y-2 rounded-md px-4 py-3.5 transition-colors hover:bg-surface md:grid-cols-[minmax(0,1fr)_200px_80px_64px] md:items-center"
      >
        <div className="min-w-0">
          <p className="text-[15px] leading-snug text-ink group-hover:text-accent-ink">{q.question_text}</p>
          <p className="mt-1 text-xs text-ink-3">{sourceLabel(q.source)}</p>
        </div>
        <MiniStrip
          probabilities={q.model_probabilities ?? {}}
          activeModel={model}
          marketProbability={marketForecast(q)}
          className="max-w-[260px] md:max-w-none"
        />
        <div className="flex gap-5 text-xs md:contents">
          <span className="num text-ink-2 md:text-right">
            <span className="mr-1 text-ink-3 md:hidden">Avg shift</span>
            {shift != null ? formatPp(shift) : "—"}
          </span>
          <span className={cn("num md:text-right", ssr != null && ssr >= 1 ? "text-ink" : "text-ink-3")}>
            <span className="mr-1 text-ink-3 md:hidden">SSR</span>
            {ssr != null ? `${ssr.toFixed(2)}×` : "—"}
          </span>
        </div>
      </Link>
    </li>
  );
}

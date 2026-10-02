"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BaselineCard, QuestionAnalysis, type AnalysisData } from "@/components/question-analysis";
import { ForecastStrip, ModelPicker } from "@/components/forecast-strip";
import { DEFAULT_MODEL_KEY, getModel, modelLabel, sortModelKeys } from "@/lib/models";
import { type QuestionEntry, type SummaryData, loadSummary, marketForecast, sourceLabel, TOPIC_ORDER } from "@/lib/questions";
import { truncate } from "@/lib/utils";

interface DetailWithMeta extends AnalysisData {
  model?: string;
  model_label?: string;
}

export default function QuestionDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const modelParam = searchParams.get("model");

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [data, setData] = useState<DetailWithMeta | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    loadSummary().then(setSummary).catch(() => {});
  }, []);

  const entry: QuestionEntry | undefined = summary?.questions.find((q) => q.question_id === id);
  const available = useMemo(() => sortModelKeys(entry?.models ?? []), [entry]);
  const activeModel =
    modelParam && (available.length === 0 || available.includes(modelParam))
      ? modelParam
      : available.includes(DEFAULT_MODEL_KEY) || available.length === 0
        ? DEFAULT_MODEL_KEY
        : available[0];

  useEffect(() => {
    let cancelled = false;
    setSwitching(true);
    fetch(`/data/questions/${activeModel}/${id}.json`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d: DetailWithMeta) => {
        if (cancelled) return;
        setData(d);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus((s) => (s === "ready" ? s : "missing")))
      .finally(() => !cancelled && setSwitching(false));
    return () => {
      cancelled = true;
    };
  }, [id, activeModel]);

  // Previous / next question in the list's default (topic) order
  const neighbours = useMemo(() => {
    if (!summary) return { prev: undefined, next: undefined };
    const ordered = [...summary.questions].sort(
      (a, b) => TOPIC_ORDER.indexOf(a.category ?? "Other") - TOPIC_ORDER.indexOf(b.category ?? "Other")
    );
    const i = ordered.findIndex((q) => q.question_id === id);
    return { prev: i > 0 ? ordered[i - 1] : undefined, next: i >= 0 ? ordered[i + 1] : undefined };
  }, [summary, id]);

  useEffect(() => {
    if (data?.question_text) document.title = `${truncate(data.question_text, 70)} · Causal Forecast Lab`;
  }, [data?.question_text]);

  const selectModel = (key: string) => {
    router.replace(`/explore/${encodeURIComponent(id)}?model=${key}`, { scroll: false });
  };

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
        <div className="mt-6 h-10 w-3/4 animate-pulse rounded bg-surface-2" />
        <div className="mt-10 h-28 animate-pulse rounded-xl bg-surface-2" />
        <div className="mt-6 h-96 animate-pulse rounded-xl bg-surface-2" />
      </div>
    );
  }

  if (status === "missing" || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="font-display text-3xl text-ink">Question not found</h1>
        <p className="mt-3 text-sm text-ink-2">
          There are no results for question <span className="num">{id}</span>
          {modelParam ? ` with model ${modelParam}` : ""}.
        </p>
        <Link href="/explore" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
          Back to all questions
        </Link>
      </div>
    );
  }

  const topic = entry?.category;
  const market = entry ? marketForecast(entry) : null;
  const probabilities = entry?.model_probabilities ?? { [activeModel]: data.initial_probability };
  const modelName = data.model_label || modelLabel(activeModel);
  const openRouterId = getModel(activeModel)?.openrouter ?? "meta-llama/llama-3.3-70b-instruct";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-xs text-ink-3">
        <Link href="/explore" className="hover:text-ink">
          Questions
        </Link>
        {topic && (
          <>
            <span aria-hidden>/</span>
            <Link href={`/explore?topic=${encodeURIComponent(topic)}`} className="hover:text-ink">
              {topic}
            </Link>
          </>
        )}
      </nav>

      <header className="max-w-4xl">
        <h1 className="font-display text-3xl leading-[1.15] tracking-tight text-ink sm:text-[2.6rem]">
          {data.question_text}
        </h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          <span>
            Source: <span className="text-ink-2">{sourceLabel(data.source)}</span>
          </span>
          {topic && <span>Topic: <span className="text-ink-2">{topic}</span></span>}
          <span className="num">ID {truncate(id, 18)}</span>
        </p>
      </header>

      <section aria-labelledby="forecasts-heading" className="mt-8 rounded-xl border border-rule bg-surface p-4 sm:p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="forecasts-heading" className="font-display text-xl text-ink">
            Forecasts by model
          </h2>
          <p className="text-xs text-ink-3">
            ● baseline forecast per model{market != null && <> · ◆ market forecast at the question source</>}
          </p>
        </div>
        <ForecastStrip
          probabilities={probabilities}
          activeModel={activeModel}
          marketProbability={market}
          onSelectModel={selectModel}
        />
        <p className="mb-2 mt-1 text-xs text-ink-2">Choose a model to see its causal network and probe results:</p>
        <ModelPicker
          probabilities={probabilities}
          available={available.length ? available : [activeModel]}
          activeModel={activeModel}
          onSelectModel={selectModel}
        />
      </section>

      <div className={switching ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"}>
        <div className="mt-6">
          <BaselineCard probability={data.initial_probability} reasoning={data.reasoning} modelName={modelName} />
        </div>
        <div className="mt-6">
          <QuestionAnalysis key={`${id}-${activeModel}`} data={data} modelId={openRouterId} />
        </div>
      </div>

      {(neighbours.prev || neighbours.next) && (
        <nav aria-label="More questions" className="mt-14 grid gap-3 border-t border-rule pt-6 sm:grid-cols-2">
          {neighbours.prev ? (
            <Link
              href={`/explore/${encodeURIComponent(neighbours.prev.question_id)}?model=${activeModel}`}
              className="group rounded-lg border border-rule bg-surface p-4 hover:border-rule-strong"
            >
              <span className="flex items-center gap-1.5 text-xs text-ink-3">
                <ArrowLeft size={13} aria-hidden /> Previous question
              </span>
              <span className="mt-1 block text-sm text-ink group-hover:text-accent-ink">
                {truncate(neighbours.prev.question_text, 110)}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {neighbours.next && (
            <Link
              href={`/explore/${encodeURIComponent(neighbours.next.question_id)}?model=${activeModel}`}
              className="group rounded-lg border border-rule bg-surface p-4 text-right hover:border-rule-strong"
            >
              <span className="flex items-center justify-end gap-1.5 text-xs text-ink-3">
                Next question <ArrowRight size={13} aria-hidden />
              </span>
              <span className="mt-1 block text-sm text-ink group-hover:text-accent-ink">
                {truncate(neighbours.next.question_text, 110)}
              </span>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

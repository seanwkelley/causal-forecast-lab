import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProbeDemo, type DemoProbe } from "@/components/probe-demo";
import { MethodVideo, type VideoData } from "@/components/method-video";
import { PAPER_MODELS } from "@/lib/models";
import type { QuestionDetail } from "@/lib/types";
import { humanize } from "@/lib/probes";

// The home-page figure uses a real run. Qwen3 235B on US unemployment has a
// clean network and shows the pattern the paper tests for in one place.
const DEMO_QUESTION = "18664";
const DEMO_MODEL = "qwen-235b";

function loadDemo(): VideoData | null {
  try {
    const file = path.join(process.cwd(), "public", "data", "questions", DEMO_MODEL, `${DEMO_QUESTION}.json`);
    const d: QuestionDetail & { model_label?: string; aggregate_metrics?: { ssr: number | null } } = JSON.parse(
      fs.readFileSync(file, "utf-8")
    );
    const pick = (type: string, target?: string) =>
      d.probe_results.find(
        (r) => r.probe_type === type && r.updated_probability != null && (!target || r.target_id === target)
      );
    const central = pick("node_strengthen", "recession_risk") ?? pick("node_strengthen");
    const peripheral = pick("node_strengthen_low") ?? pick("node_negate_low");
    const control = pick("irrelevant");
    if (!central || !peripheral || !control) return null;
    const probes: DemoProbe[] = [
      {
        key: "central",
        label: "Central factor",
        caption: `Strengthens “${humanize(central.target_id)}”, a central factor in this network.`,
        targetId: central.target_id,
        text: central.probe_text,
        p1: central.updated_probability!,
      },
      {
        key: "peripheral",
        label: "Peripheral factor",
        caption: `Strengthens “${humanize(peripheral.target_id)}”, the least central factor.`,
        targetId: peripheral.target_id,
        text: peripheral.probe_text,
        p1: peripheral.updated_probability!,
      },
      {
        key: "control",
        label: "Irrelevant info",
        caption: "A control: sounds related, but has no causal bearing on the outcome.",
        targetId: null,
        text: control.probe_text,
        p1: control.updated_probability!,
      },
    ];
    return {
      questionId: DEMO_QUESTION,
      modelKey: DEMO_MODEL,
      modelLabel: d.model_label ?? "Qwen3 235B",
      question: d.question_text,
      p0: d.initial_probability,
      nodes: d.network_analysis.node_metrics,
      edges: d.network_analysis.edge_metrics,
      probes,
      totalProbes: d.probe_results.length,
      ssr: d.aggregate_metrics?.ssr ?? null,
    };
  } catch {
    return null;
  }
}

const STEPS = [
  {
    title: "Forecast with a causal network",
    body: "The model gives a probability and the network behind it: 6–10 factors, the outcome, and directed links, each with a stated mechanism.",
  },
  {
    title: "Measure the structure",
    body: "We compute each factor’s betweenness centrality and outcome mediation, then pick about 21 targets from central to peripheral. No model is involved in this step.",
  },
  {
    title: "Write probes",
    body: "For each target the model writes a short counterfactual: negate or strengthen a factor or link, challenge the network’s structure, or add irrelevant information. It is never told how central a target is.",
  },
  {
    title: "Forecast again",
    body: "Each probe goes back to the model in a fresh conversation together with its original network. We record the new probability.",
  },
];

const MEASURES: Array<{ term: string; body: React.ReactNode }> = [
  {
    term: "Forecast shift",
    body: (
      <>
        The change from the baseline probability to the probed one, in percentage points (pp). The paper’s main
        measure is the absolute change in <em>log-odds</em>, which counts a move from 2% to 4% as larger than one
        from 50% to 52%. The explorer shows both.
      </>
    ),
  },
  {
    term: "Betweenness and outcome mediation",
    body: (
      <>
        Two measures of how central a factor is. <em>Betweenness</em> is the share of all shortest paths in the
        network that pass through the factor. <em>Outcome mediation</em> is the share of shortest paths from a factor
        to the outcome that pass through it. A link is <em>on the shortest path</em> if it lies on at least one
        shortest factor-to-outcome path; otherwise it is <em>peripheral</em>.
      </>
    ),
  },
  {
    term: "Structural sensitivity ratio (SSR)",
    body: (
      <>
        The average shift from probes aimed at central targets (the two highest-betweenness factors and
        shortest-path links) divided by the average shift from probes aimed at peripheral ones (the lowest-betweenness
        factor and peripheral links). Above 1× means central targets moved the forecast more.
      </>
    ),
  },
  {
    term: "Strengthen vs. negate",
    body: (
      <>
        The average shift from probes that reinforce a factor or link, divided by the average from probes that
        challenge one. Above 1× means the model moved more for supporting evidence than for counter-evidence.
      </>
    ),
  },
  {
    term: "Control probes",
    body: (
      <>
        Two probes per run add information that sounds related but has no causal bearing on the outcome. A careful
        forecaster leaves its number alone; the explorer flags control probes that moved it by more than 5pp.
      </>
    ),
  },
];

export default function Home() {
  const demo = loadDemo();

  return (
    <div className="pb-24">
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-center lg:gap-14 lg:pt-20">
        <div>
          <p className="eyebrow">Companion to Kelley &amp; Riedl (2026)</p>
          <h1 className="mt-4 font-display text-[2.6rem] leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Do LLM forecasts move with the causes the model says matter most?
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2">
            Ask a language model for a probability and it can explain itself as a network of causes. We then
            challenge or reinforce one cause or link at a time and measure how far the forecast moves. A model that
            means what its network says should move most when its central causes are probed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90"
            >
              Browse 116 questions <ArrowRight size={15} aria-hidden />
            </Link>
            <Link
              href="/live"
              className="inline-flex items-center gap-2 rounded-md border border-rule-strong px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface"
            >
              Run your own question
            </Link>
          </div>
        </div>
        {demo && <ProbeDemo demo={demo} />}
      </section>

      {/* Pipeline */}
      <section className="border-y border-rule bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl tracking-tight text-ink">How each run works</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
            The example above, step by step. The same four stages run for every question and model; only the second
            is pure computation.
          </p>
          {demo && (
            <div className="mx-auto mt-8 max-w-5xl">
              <MethodVideo data={demo} />
            </div>
          )}
          <ol className="mt-14 grid gap-8 md:grid-cols-4 md:gap-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent text-xs font-semibold text-accent">
                    {i + 1}
                  </span>
                  {i < STEPS.length - 1 && <span aria-hidden className="hidden h-px flex-1 bg-rule-strong md:block" />}
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Measures */}
      <section id="measures" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div>
            <h2 className="font-display text-3xl tracking-tight text-ink">What the explorer measures</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              Every question page reports these for the selected model. The paper’s statistical tests (mixed-effects
              models across all questions) are in the paper, not here.
            </p>
          </div>
          <dl className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {MEASURES.map((m) => (
              <div key={m.term} className="border-t border-rule pt-4">
                <dt className="text-[15px] font-semibold text-ink">{m.term}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-ink-2">{m.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Data */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 rounded-2xl border border-rule bg-surface p-6 sm:p-8 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl tracking-tight text-ink">The data</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              <span className="num text-ink">116</span> questions × <span className="num text-ink">7</span> models ={" "}
              <span className="num text-ink">812</span> runs and <span className="num text-ink">16,570</span> probes.
              Questions come from ForecastBench and were selected for outcomes that depend on several interacting
              causes. All models ran at temperature 0.7.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              In the paper, six of the seven models moved further when probes targeted more central factors. The
              exception was the smallest model, Llama 3.1 8B.
            </p>
          </div>
          <div>
            <p className="eyebrow mb-3">Models</p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-ink">
              {PAPER_MODELS.map((m) => (
                <li key={m.key} className="border-b border-rule pb-2">
                  {m.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Live CTA */}
      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 border-t border-rule pt-10 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl tracking-tight text-ink">Try it on a question of your own</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Run the full pipeline live on any yes/no question with several interacting causes, with up to four
              models side by side. Requires an OpenRouter API key (free to create, pay per use).
            </p>
          </div>
          <Link
            href="/live"
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90"
          >
            Run your own question <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}

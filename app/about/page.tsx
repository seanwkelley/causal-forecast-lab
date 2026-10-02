import type { Metadata } from "next";
import Link from "next/link";
import { PAPER_MODELS } from "@/lib/models";
import { CopyButton } from "@/components/copy-button";

export const metadata: Metadata = {
  title: "About",
};

const BIBTEX = `@inproceedings{kelley2026belief,
  author    = {Kelley, Sean W. and Riedl, Christoph},
  title     = {Probing Belief Sensitivity in {LLM} Forecasters: Do Causal
               Structure and Importance Predict Belief Updates?},
  booktitle = {Proceedings of EMNLP 2026},
  year      = {2026},
  note      = {Under review}
}`;

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-12 sm:px-6">
      <h1 className="font-display text-4xl tracking-tight text-ink sm:text-5xl">About</h1>

      <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-ink-2">
        <p>
          <strong className="font-semibold text-ink">Causal Forecast Lab</strong> is the companion to our paper on
          whether language-model forecasts are faithful to the causal reasoning the models give for them. Each model
          explains its forecast as a causal network of factors and links. We then probe that network one element at a
          time and record how the forecast responds.
        </p>
        <p>
          A run has four stages. The model first gives a probability together with a causal network of 6–10 factors.
          We then compute betweenness centrality and outcome mediation for every factor, without any model involved.
          Next, the model writes about 21 probes that strengthen or negate a factor or link, challenge the
          network&apos;s structure, or add irrelevant information as a control. Finally, each probe is shown to the
          model in a separate conversation and it gives a new probability.
        </p>
        <p>
          The explorer covers 116 high-complexity binary questions from{" "}
          <strong className="font-semibold text-ink">ForecastBench</strong>, chosen because their outcomes depend on
          several interacting causes, answered by seven models. You can also run the full pipeline on a question of
          your own on the{" "}
          <Link href="/live" className="text-accent hover:underline">
            Run your own
          </Link>{" "}
          page.
        </p>
        <p>
          All questions have resolution dates in late 2025. Every model was released between July 2024 and August
          2025, and training cutoffs are no later than release dates, so the models are forecasting rather than
          recalling known outcomes.
        </p>
      </div>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink">Models</h2>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left">
              <th className="eyebrow pb-2 font-semibold">Model</th>
              <th className="eyebrow pb-2 font-semibold">OpenRouter ID</th>
            </tr>
          </thead>
          <tbody>
            {PAPER_MODELS.map((m) => (
              <tr key={m.key} className="border-b border-rule">
                <td className="py-2 pr-4 text-ink">{m.label}</td>
                <td className="num py-2 text-xs text-ink-2">{m.openrouter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink">Authors</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {["Sean Kelley", "Christoph Riedl"].map((name) => (
            <li key={name} className="rounded-lg border border-rule bg-surface p-4">
              <p className="font-medium text-ink">{name}</p>
              <p className="text-sm text-ink-3">Northeastern University</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl text-ink">Citation</h2>
          <CopyButton text={BIBTEX} label="Copy BibTeX" />
        </div>
        <pre className="num mt-4 overflow-x-auto rounded-lg border border-rule bg-surface p-4 text-xs leading-relaxed text-ink-2">
          {BIBTEX}
        </pre>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink">Data</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
          Forecasting questions are drawn from{" "}
          <a href="https://forecastbench.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            ForecastBench
          </a>
          , a dynamic benchmark of AI forecasting built from prediction markets, forecasting platforms and public
          data series.
        </p>
        <p className="mt-2 text-sm text-ink-3">
          Karger, E., Bastani, H., Chen, Y.-H., Jacobs, Z., Halawi, D., Zhang, F., &amp; Tetlock, P. E. (2025).
          ForecastBench: A Dynamic Benchmark of AI Forecasting Capabilities. <em>ICLR 2025</em>.
        </p>
      </section>

      <section className="mt-12 border-t border-rule pt-8">
        <h2 className="font-display text-2xl text-ink">Contact</h2>
        <p className="mt-3 text-[15px] text-ink-2">
          Questions or feedback:{" "}
          <a href="mailto:se.kelley@northeastern.edu" className="text-accent hover:underline">
            se.kelley@northeastern.edu
          </a>
        </p>
      </section>
    </div>
  );
}

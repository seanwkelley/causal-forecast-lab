import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">About</h1>

      <div className="mt-8 space-y-6 text-sm text-[var(--color-muted-foreground)] leading-relaxed">
        <p>
          <strong className="text-[var(--color-foreground)]">Causal Forecast Lab</strong> is
          an interactive companion to our research on belief sensitivity in large
          language model forecasting. It lets you explore how LLM probability
          estimates shift when assumptions about causal structure are
          systematically challenged through targeted counterfactual probes.
        </p>

        <p>
          The pipeline works in three stages: the model first produces a
          probability estimate together with an explicit causal network, graph
          analysis then identifies structurally important nodes and edges, and
          finally a battery of ~23 probes negate, strengthen, sever, or
          fabricate individual causal beliefs to measure the resulting
          probability shift.
        </p>

        <p>
          Pre-computed results cover 100 binary forecasting questions from{" "}
          <strong className="text-[var(--color-foreground)]">ForecastBench</strong>,
          evaluated across four models (Llama 3.1 8B, Llama 3.3 70B, DeepSeek
          V3, and Qwen3 235B). You can also run the full pipeline on any custom
          question in real time via the{" "}
          <Link href="/live" className="text-[var(--color-primary)] hover:underline">
            Custom Question
          </Link>{" "}
          page.
        </p>
      </div>

      {/* Authors */}
      <div className="mt-12">
        <h2 className="text-lg font-semibold mb-4">Authors</h2>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5 space-y-3">
          <div>
            <p className="font-medium">Sean Kelley</p>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Northeastern University
            </p>
          </div>
          <div>
            <p className="font-medium">Christoph Riedl</p>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Northeastern University
            </p>
          </div>
        </div>
      </div>

      {/* Data Attribution */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Data Attribution</h2>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-sm text-[var(--color-muted-foreground)] leading-relaxed">
          <p>
            Forecasting questions are drawn from{" "}
            <a
              href="https://forecastbench.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] hover:underline font-medium"
            >
              ForecastBench
            </a>
            , a dynamic benchmark of AI forecasting capabilities sourced from
            active prediction markets.
          </p>
          <p className="mt-2 text-xs">
            Karger, E., Bastani, H., Chen, Y.-H., Jacobs, Z., Halawi, D.,
            Zhang, F., &amp; Tetlock, P. E. (2025). ForecastBench: A Dynamic
            Benchmark of AI Forecasting Capabilities. <em>ICLR 2025</em>.
          </p>
        </div>
      </div>

      {/* Contact */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Contact</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Questions or feedback? Reach out at{" "}
          <a
            href="mailto:se.kelley@northeastern.edu"
            className="text-[var(--color-primary)] hover:underline"
          >
            se.kelley@northeastern.edu
          </a>
        </p>
      </div>
    </div>
  );
}

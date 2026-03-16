import Link from "next/link";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <p className="text-sm text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
      {sub && (
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          {sub}
        </p>
      )}
    </div>
  );
}

export default function Home() {

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          Causal Forecast Lab
        </h1>
        <p className="mt-4 text-lg text-[var(--color-muted-foreground)] max-w-2xl mx-auto leading-relaxed">
          Explore how language model probability estimates shift when
          assumptions about causal structure &mdash; individual factors, causal
          links, and network topology &mdash; are challenged through targeted
          counterfactual probes.
        </p>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)] max-w-xl mx-auto">
          Designed for <strong className="text-[var(--color-foreground)]">binary yes/no forecasting questions</strong> with
          a resolution date &mdash; the model estimates a single probability that
          the event occurs.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary)]/90 transition-colors"
          >
            Pre-Selected Questions
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/live"
            className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--color-secondary)] transition-colors"
          >
            Custom Question
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Questions"
          value="100"
          sub="From ForecastBench"
        />
        <StatCard
          label="Models"
          value="4"
          sub="Llama 8B, 70B, DeepSeek V3, Qwen3"
        />
        <StatCard
          label="Probes per Question"
          value="~23"
          sub="Symmetric negate + strengthen"
        />
        <StatCard
          label="Total Probe Responses"
          value="~9,200"
          sub="Across all models and questions"
        />
      </div>

      {/* Method overview */}
      <div className="mt-16">
        <h2 className="text-xl font-semibold mb-6">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              step: "1",
              title: "Causal Forecast",
              desc: "The LLM generates a probability estimate along with an explicit causal network — nodes representing factors and directed edges representing causal mechanisms.",
            },
            {
              step: "2",
              title: "Network Analysis",
              desc: "Betweenness centrality ranks which nodes and edges are structurally most important; path relevance flags elements on the critical path to the outcome.",
            },
            {
              step: "3",
              title: "Probe Experiments",
              desc: "~23 targeted probes challenge and reinforce individual beliefs — negating and strengthening nodes, severing and reinforcing edges, introducing spurious connections — and measure the resulting probability shift.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-sm font-bold">
                  {item.step}
                </div>
                <h3 className="font-medium">{item.title}</h3>
              </div>
              <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics overview */}
      <div className="mt-16">
        <h2 className="text-xl font-semibold mb-6">Key Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              name: "SSR (Structural Sensitivity Ratio)",
              desc: "Ratio of mean shift from high-importance probes vs low-importance probes. SSR > 1 means the model differentiates between structurally important and peripheral challenges.",
            },
            {
              name: "Importance-Sensitivity ρ",
              desc: "Spearman correlation between a node's betweenness centrality and the probe shift it causes. Positive ρ means structurally important nodes produce larger shifts.",
            },
            {
              name: "Control Sensitivity",
              desc: "Fraction of irrelevant probes that cause a shift > 5pp. Lower is better — indicates the model ignores causally irrelevant information.",
            },
          ].map((m) => (
            <div
              key={m.name}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <h3 className="text-sm font-medium font-mono text-[var(--color-primary)]">
                {m.name}
              </h3>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                {m.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

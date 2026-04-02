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
          Designed for <strong className="text-[var(--color-foreground)]">complex, multi-cause binary forecasting questions</strong> where
          the outcome depends on multiple interacting causal factors &mdash; the regime where
          LLM-assisted forecasting is most valuable.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary)]/90 transition-colors"
          >
            ForecastBench Examples
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/live"
            className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--color-secondary)] transition-colors"
          >
            Ask Your Own Question
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Questions"
          value="116"
          sub="High-complexity questions from ForecastBench"
        />
        <StatCard
          label="Models"
          value="7"
          sub="Llama 8B/70B, DeepSeek V3, Qwen3 235B/32B, Gemini FL, GPT-OSS"
        />
        <StatCard
          label="Probes per Question"
          value="~21"
          sub="Strengthen, negate, structural challenge, and control"
        />
        <StatCard
          label="Probe Types"
          value="14"
          sub="Node and edge probes across 4 categories at varying importance"
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
              desc: "Betweenness centrality and outcome mediation rank which factors are structurally most important; probe targets are selected across the full importance spectrum.",
            },
            {
              step: "3",
              title: "Probe Experiments",
              desc: "~21 targeted probes challenge and reinforce individual beliefs — negating and strengthening factors at varying importance levels, challenging edge relationships, proposing missing nodes, and introducing irrelevant information as controls — measuring the resulting probability shift.",
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
              definition: "Ratio of mean probability shift from high-importance probes to low-importance probes.",
              interpretation: "SSR > 1 means the model differentiates between structurally important and peripheral challenges. SSR near 1 suggests undifferentiated updating.",
            },
            {
              name: "Strengthen / Negate Ratio",
              definition: "Ratio of mean probability shift from strengthen probes to negate probes.",
              interpretation: "Ratio > 1 means the model shifts more on confirmatory evidence than disconfirmatory. Reveals directional asymmetry in updating.",
            },
            {
              name: "Control Sensitivity",
              definition: "Fraction of irrelevant (control) probes that cause a probability shift greater than 5 percentage points.",
              interpretation: "Lower is better. A low value indicates the model resists updating on causally irrelevant information.",
            },
          ].map((m) => (
            <div
              key={m.name}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <h3 className="text-sm font-medium font-mono text-[var(--color-primary)]">
                {m.name}
              </h3>
              <p className="mt-2 text-sm text-[var(--color-foreground)]">
                {m.definition}
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                {m.interpretation}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Try your own */}
      <div className="mt-16 rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-8 text-center">
        <h2 className="text-xl font-semibold mb-3">Try It on Your Own Question</h2>
        <p className="text-sm text-[var(--color-muted-foreground)] max-w-lg mx-auto mb-6">
          Run the full pipeline live on any complex binary forecasting question. The model
          generates a causal network with 6&ndash;10 factors, we analyze its structure, run ~21 probes, and
          compute all sensitivity metrics in real time. Works best with multi-cause questions.
        </p>
        <Link
          href="/live"
          className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary)]/90 transition-colors"
        >
          Ask Your Own Question
          <span aria-hidden>→</span>
        </Link>
        <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
          Requires an{" "}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
            OpenRouter API key
          </a>
          {" "}(free to create, pay-per-use)
        </p>
      </div>
    </div>
  );
}

"use client";

import type { AggregateMetrics, NetworkAnalysis } from "@/lib/types";

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="text-xs font-mono text-[var(--color-muted-foreground)] uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        {description}
      </p>
    </div>
  );
}

export function MetricsPanel({
  metrics,
  network,
}: {
  metrics: AggregateMetrics;
  network: NetworkAnalysis;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
        Sensitivity Metrics
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="SSR"
          value={metrics.ssr != null ? metrics.ssr.toFixed(2) + "×" : "N/A"}
          description={`High: ${(metrics.mean_shift_high * 100).toFixed(1)}pp / Low: ${(metrics.mean_shift_low * 100).toFixed(1)}pp`}
        />
        <MetricCard
          label="Importance–Shift ρ"
          value={
            metrics.importance_sensitivity_correlation != null
              ? metrics.importance_sensitivity_correlation.toFixed(3)
              : "N/A"
          }
          description="Spearman: betweenness centrality vs |shift|"
        />
        <MetricCard
          label="Control Sensitivity"
          value={
            metrics.control_sensitivity != null
              ? (metrics.control_sensitivity * 100).toFixed(0) + "%"
              : "N/A"
          }
          description="Frac. irrelevant probes with |shift| > 5pp"
        />
      </div>

      <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mt-4">
        Network
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Nodes"
          value={network.n_nodes.toString()}
          description={`${network.n_nodes - 1} factors + outcome`}
        />
        <MetricCard
          label="Edges"
          value={network.n_edges.toString()}
          description={`Density: ${network.density.toFixed(3)}`}
        />
      </div>
    </div>
  );
}

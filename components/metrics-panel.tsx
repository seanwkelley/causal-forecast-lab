"use client";

import type { AggregateMetrics, NetworkAnalysis } from "@/lib/types";

function MetricCard({
  label,
  value,
  description,
  valueColor,
  warning,
}: {
  label: string;
  value: string;
  description: string;
  valueColor?: string;
  warning?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="text-xs font-mono text-[var(--color-muted-foreground)] uppercase tracking-wider">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${valueColor ?? ""}`}>{value}</p>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        {description}
      </p>
      {warning && (
        <p className="mt-1 text-[10px] text-orange-400">
          {warning}
        </p>
      )}
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
          value={metrics.ssr != null ? metrics.ssr.toFixed(2) + "×" : "—"}
          valueColor={
            metrics.ssr != null
              ? metrics.ssr >= 1.5 ? "text-[var(--color-positive)]"
              : metrics.ssr < 1 ? "text-orange-400"
              : ""
              : ""
          }
          description={
            metrics.ssr != null
              ? `High: ${(metrics.mean_shift_high * 100).toFixed(1)}pp / Low: ${(metrics.mean_shift_low * 100).toFixed(1)}pp`
              : "Needs high and low importance probes"
          }
          warning={
            metrics.ssr != null && metrics.ssr < 1
              ? "Below 1: model shifts more on low-importance probes"
              : undefined
          }
        />
        <MetricCard
          label="Control Sensitivity"
          value={
            metrics.control_sensitivity != null
              ? (metrics.control_sensitivity * 100).toFixed(0) + "%"
              : "—"
          }
          description={
            metrics.control_sensitivity != null
              ? "Frac. irrelevant probes with |shift| > 5pp"
              : "No irrelevant probes available"
          }
        />
        <MetricCard
          label="Str / Neg Ratio"
          value={
            metrics.asymmetry_index != null
              ? (1 / metrics.asymmetry_index).toFixed(2) + "×"
              : "—"
          }
          valueColor={
            metrics.asymmetry_index != null && metrics.asymmetry_index < 1
              ? "text-[var(--color-primary)]"
              : ""
          }
          description={
            metrics.mean_shift_strengthen != null && metrics.mean_shift_negate != null
              ? `Str: ${(metrics.mean_shift_strengthen * 100).toFixed(1)}pp / Neg: ${(metrics.mean_shift_negate * 100).toFixed(1)}pp`
              : "Needs both strengthen and negate probes"
          }
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
      {!network.is_dag && (
        <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-3">
          <p className="text-xs font-medium text-orange-400">
            Warning: Network contains cycles (not a valid DAG). Metrics may be less reliable.
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import type { EdgeMetrics, NodeMetrics, ProbeResult } from "@/lib/types";
import { describeProbe, humanize } from "@/lib/probes";
import { deltaClass, formatDelta, formatProbability, mean, formatPp } from "@/lib/utils";

export function TargetDetails({
  selectedId,
  nodes,
  edges,
  probeResults,
  initialProbability,
  onClear,
}: {
  selectedId: string | null;
  nodes: NodeMetrics[];
  edges: EdgeMetrics[];
  probeResults: ProbeResult[];
  initialProbability: number;
  onClear: () => void;
}) {
  if (!selectedId) {
    return (
      <div>
        <p className="eyebrow mb-2">Selection</p>
        <p className="text-sm leading-relaxed text-ink-2">
          Click a factor or a link in the network to see what it means, how central it is, and how the forecast
          responded when it was challenged or reinforced.
        </p>
      </div>
    );
  }

  const isEdge = selectedId.includes("->");
  const node = isEdge ? undefined : nodes.find((n) => n.node_id === selectedId);
  const edge = isEdge ? edges.find((e) => `${e.source}->${e.target}` === selectedId) : undefined;
  const probes = probeResults.filter((r) => r.target_id === selectedId);

  const factors = nodes.filter((n) => n.role !== "outcome");
  const rank = node
    ? [...factors].sort((a, b) => b.betweenness - a.betweenness).findIndex((n) => n.node_id === node.node_id) + 1
    : 0;
  const avg = mean(probes.filter((r) => r.absolute_shift != null).map((r) => r.absolute_shift!));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="eyebrow">{isEdge ? "Selected link" : "Selected factor"}</p>
        <button onClick={onClear} className="text-xs text-ink-3 hover:text-ink">
          Clear
        </button>
      </div>

      {node && (
        <>
          <h4 className="font-cond text-lg font-semibold leading-snug text-ink">{humanize(node.node_id)}</h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{node.description}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 border-y border-rule py-3">
            <Stat label="Betweenness" value={node.betweenness.toFixed(2)} sub={`rank ${rank} of ${factors.length}`} />
            <Stat label="Outcome mediation" value={`${Math.round((node.path_relevance ?? 0) * 100)}%`} />
            <Stat label="Links" value={`${node.in_degree} in · ${node.out_degree} out`} />
          </dl>
        </>
      )}

      {edge && (
        <>
          <h4 className="font-cond text-lg font-semibold leading-snug text-ink">
            {humanize(edge.source)} <span className="text-ink-3">→</span> {humanize(edge.target)}
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{edge.mechanism}</p>
          <p className="mt-3 border-y border-rule py-2.5 text-xs text-ink-2">
            {edge.on_critical_path
              ? "Lies on a shortest path from a factor to the outcome."
              : "Peripheral: not on any shortest path from a factor to the outcome."}
          </p>
        </>
      )}

      <div className="mt-3">
        <p className="mb-1.5 text-xs text-ink-2">
          {probes.length === 0
            ? "No automated probes targeted this element."
            : `${probes.length} automated probe${probes.length > 1 ? "s" : ""} targeted it${avg != null ? `, average shift ${formatPp(avg)}` : ""}:`}
        </p>
        <ul className="space-y-1">
          {probes.map((r, i) => {
            const info = describeProbe(r);
            const d = r.updated_probability != null ? r.updated_probability - initialProbability : null;
            return (
              <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-ink">
                  {info.action}
                  {info.tierLabel && <span className="text-ink-3"> · {info.tierLabel}</span>}
                </span>
                <span className="num shrink-0">
                  {r.updated_probability != null && (
                    <span className="text-ink-3">{formatProbability(r.updated_probability)} </span>
                  )}
                  <span className={d != null ? deltaClass(d) : "text-ink-3"}>{d != null ? formatDelta(d) : "—"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-ink-3">{label}</dt>
      <dd className="num mt-1 text-sm text-ink">{value}</dd>
      {sub && <dd className="text-[11px] text-ink-3">{sub}</dd>}
    </div>
  );
}

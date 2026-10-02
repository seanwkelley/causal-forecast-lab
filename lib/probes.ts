// Probe taxonomy, following the paper's probe-type table:
// four intervention categories (strengthen, negate, structural challenge,
// control), each aimed at a factor (node) or a causal link (edge).

import type { ProbeResult } from "./types";

export type ProbeKind = "strengthen" | "negate" | "structural" | "control";
export type ProbeLevel = "factor" | "link" | "none";
export type ProbeTier = "high" | "medium" | "low" | "shortest-path" | "peripheral";

export interface ProbeInfo {
  kind: ProbeKind;
  level: ProbeLevel;
  tier?: ProbeTier;
  /** e.g. "Strengthen factor" */
  action: string;
  /** e.g. "high importance" */
  tierLabel?: string;
  /** Sort position within its category (paper table order) */
  order: number;
}

export const KIND_ORDER: ProbeKind[] = ["strengthen", "negate", "structural", "control"];

export const KIND_META: Record<ProbeKind, { label: string; blurb: string }> = {
  strengthen: {
    label: "Strengthen",
    blurb: "Evidence that reinforces one factor or causal link.",
  },
  negate: {
    label: "Negate",
    blurb: "A challenge arguing one factor or causal link is wrong or weaker than assumed.",
  },
  structural: {
    label: "Structural challenge",
    blurb: "Questions the shape of the network: a reversed link, a missing link, or a missing factor.",
  },
  control: {
    label: "Control",
    blurb: "Topically related information that should not change the forecast.",
  },
};

export const TIER_LABEL: Record<ProbeTier, string> = {
  high: "high importance",
  medium: "medium importance",
  low: "low importance",
  "shortest-path": "on shortest path",
  peripheral: "peripheral",
};

const TABLE: Record<string, Omit<ProbeInfo, "action" | "tierLabel">> = {
  node_strengthen: { kind: "strengthen", level: "factor", tier: "high", order: 0 },
  node_strengthen_high: { kind: "strengthen", level: "factor", tier: "high", order: 0 },
  node_strengthen_medium: { kind: "strengthen", level: "factor", tier: "medium", order: 1 },
  node_strengthen_low: { kind: "strengthen", level: "factor", tier: "low", order: 2 },
  edge_strengthen_critical: { kind: "strengthen", level: "link", tier: "shortest-path", order: 3 },
  edge_strengthen_peripheral: { kind: "strengthen", level: "link", tier: "peripheral", order: 4 },
  node_negate_high: { kind: "negate", level: "factor", tier: "high", order: 0 },
  node_negate_medium: { kind: "negate", level: "factor", tier: "medium", order: 1 },
  node_negate_low: { kind: "negate", level: "factor", tier: "low", order: 2 },
  edge_negate_critical: { kind: "negate", level: "link", tier: "shortest-path", order: 3 },
  edge_negate_peripheral: { kind: "negate", level: "link", tier: "peripheral", order: 4 },
  edge_reverse: { kind: "structural", level: "link", order: 0 },
  missing_node: { kind: "structural", level: "factor", order: 2 },
  irrelevant: { kind: "control", level: "none", order: 0 },
};

function actionFor(kind: ProbeKind, level: ProbeLevel, probeType: string, targetType: string): string {
  if (probeType === "edge_reverse") return "Reverse link";
  if (targetType === "missing_edge") return "Add missing link";
  if (probeType === "missing_node") return "Add missing factor";
  if (kind === "control") return "Irrelevant information";
  const verb = kind === "strengthen" ? "Strengthen" : kind === "negate" ? "Negate" : "Challenge";
  return `${verb} ${level === "link" ? "link" : "factor"}`;
}

/**
 * Normalise a probe result into the paper's taxonomy. Proposed-link probes
 * carry a variety of raw type names (edge_spurious, edge_missing, ...), so
 * those are recognised by their target type instead.
 */
export function describeProbe(r: Pick<ProbeResult, "probe_type" | "target_type" | "probe_category">): ProbeInfo {
  let base = TABLE[r.probe_type];
  if (!base) {
    if (r.target_type === "missing_edge") {
      base = { kind: "structural", level: "link", order: 1 };
    } else if (r.probe_category === "control") {
      base = { kind: "control", level: "none", order: 0 };
    } else {
      base = {
        kind: "structural",
        level: r.target_type === "node" ? "factor" : "link",
        order: 3,
      };
    }
  }
  return {
    ...base,
    action: actionFor(base.kind, base.level, r.probe_type, r.target_type),
    tierLabel: base.tier ? TIER_LABEL[base.tier] : undefined,
  };
}

/** Full one-line label, e.g. "Negate factor · high importance". */
export function probeLabel(r: Pick<ProbeResult, "probe_type" | "target_type" | "probe_category">): string {
  const info = describeProbe(r);
  return info.tierLabel ? `${info.action} · ${info.tierLabel}` : info.action;
}

/** "economic_growth" -> "economic growth" */
export function humanize(id: string): string {
  return id.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/** Readable name for a probe target: factor name, "A → B" for links, or a placeholder. */
export function targetLabel(r: Pick<ProbeResult, "target_id" | "target_type" | "probe_type">): string {
  if (r.probe_type === "irrelevant") return "No target";
  if (r.probe_type === "missing_node" || r.target_type === "structural") return "New factor";
  if (r.target_id.includes("->")) {
    const [a, b] = r.target_id.split("->");
    return `${humanize(a)} → ${humanize(b)}`;
  }
  return humanize(r.target_id);
}

const clamp = (p: number) => Math.min(0.99, Math.max(0.01, p));
const logit = (p: number) => Math.log(clamp(p) / (1 - clamp(p)));

/** Signed change in log-odds between two probabilities (clamped to [0.01, 0.99]). */
export function logitShift(p0: number, p1: number): number {
  return logit(p1) - logit(p0);
}

/** True if the probe produced a usable updated probability. */
export function hasResult(r: ProbeResult): r is ProbeResult & { updated_probability: number } {
  return r.updated_probability != null;
}

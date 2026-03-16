import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatProbability(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

export function formatDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${(delta * 100).toFixed(1)}pp`;
}

export function deltaColor(delta: number): string {
  if (Math.abs(delta) < 0.01) return "text-[var(--color-neutral-shift)]";
  return delta > 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]";
}

export function probToColor(p: number): string {
  if (p < 0.3) return "#22c55e";
  if (p < 0.5) return "#eab308";
  if (p < 0.7) return "#f97316";
  return "#ef4444";
}

export function importanceToColor(importance: number): string {
  if (importance < 0.2) return "#6b7280";
  if (importance < 0.4) return "#3b82f6";
  if (importance < 0.6) return "#8b5cf6";
  return "#ec4899";
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

export function probeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    node_negate_high: "Negate Node (High)",
    node_negate_medium: "Negate Node (Med)",
    node_negate_low: "Negate Node (Low)",
    node_strengthen: "Strengthen Node (High)",
    node_strengthen_medium: "Strengthen Node (Med)",
    node_strengthen_low: "Strengthen Node (Low)",
    edge_negate_critical: "Negate Edge (Critical)",
    edge_negate_peripheral: "Negate Edge (Peripheral)",
    edge_strengthen_critical: "Strengthen Edge (Critical)",
    edge_strengthen_peripheral: "Strengthen Edge (Peripheral)",
    edge_reverse: "Reverse Edge",
    edge_spurious: "Spurious Edge",
    missing_node: "Missing Node",
    irrelevant: "Irrelevant (Control)",
  };
  return labels[type] || type;
}

export function probeCategoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    node: "Node Probes",
    edge: "Edge Probes",
    structural: "Structural Probes",
    control: "Control Probes",
  };
  return labels[cat] || cat;
}

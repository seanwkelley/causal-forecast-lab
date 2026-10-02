"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { EdgeMetrics, NodeMetrics, ProbeResult } from "@/lib/types";
import { layoutBestFit } from "@/lib/graph-layout";
import { describeProbe, humanize } from "@/lib/probes";
import { cn, formatPp, mean } from "@/lib/utils";

export type ShadeMode = "betweenness" | "mediation" | "shift";

const SHADE_OPTIONS: Array<{ key: ShadeMode; label: string; hint: string }> = [
  {
    key: "betweenness",
    label: "Betweenness",
    hint: "Share of all shortest paths in the network that pass through the factor.",
  },
  {
    key: "mediation",
    label: "Outcome mediation",
    hint: "Share of factor-to-outcome shortest paths that pass through the factor.",
  },
  {
    key: "shift",
    label: "Forecast shift",
    hint: "Average change in the forecast when probes negated or strengthened this factor.",
  },
];

/** Shift (as a probability) at which the shading saturates. */
const SHIFT_CEILING = 0.2;

interface CausalNetworkProps {
  nodes: NodeMetrics[];
  edges: EdgeMetrics[];
  probeResults?: ProbeResult[];
  /** Node id, or "source->target" for a link */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Extra emphasis for an element chosen elsewhere (e.g. a hovered probe) */
  highlightId?: string | null;
  /** Hide toolbar, values and footnotes (used for the home-page figure) */
  compact?: boolean;
  initialShade?: ShadeMode;
  className?: string;
}

const GENERIC_OUTCOME = /^(outcome|target|result|event|yes)$/i;

function nodeLabel(n: NodeMetrics): string {
  if (n.role === "outcome" && GENERIC_OUTCOME.test(n.node_id) && n.description) return n.description;
  return humanize(n.node_id);
}

export function CausalNetwork({
  nodes,
  edges,
  probeResults = [],
  selectedId = null,
  onSelect,
  highlightId = null,
  compact = false,
  initialShade = "betweenness",
  className,
}: CausalNetworkProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(720);
  const [shade, setShade] = useState<ShadeMode>(initialShade);
  const [hoverId, setHoverId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (el.clientWidth > 0) setAvailableWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setAvailableWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = availableWidth < 560;

  const layout = useMemo(
    () =>
      layoutBestFit(
        nodes.map((n) => ({ id: n.node_id, label: nodeLabel(n), isOutcome: n.role === "outcome" })),
        edges.map((e) => ({ source: e.source, target: e.target })),
        {
          availableWidth,
          nodeWidth: compact ? (narrow ? 100 : 128) : narrow ? 128 : 150,
          minColGap: compact ? 30 : 40,
          charsPerLine: compact ? (narrow ? 13 : 17) : narrow ? 17 : 20,
          maxLines: 3,
          lineHeight: compact ? 13 : 14,
          extraHeight: compact ? 0 : 16,
          outcomeExtra: 12,
          rowGap: compact ? 10 : 14,
          padY: compact ? 8 : 18,
        }
      ),
    [nodes, edges, availableWidth, compact, narrow]
  );

  // Per-element probe stats
  const stats = useMemo(() => {
    const byTarget = new Map<string, number[]>();
    for (const r of probeResults) {
      if (r.absolute_shift == null) continue;
      const info = describeProbe(r);
      if (info.kind !== "strengthen" && info.kind !== "negate") continue;
      const list = byTarget.get(r.target_id) ?? [];
      list.push(r.absolute_shift);
      byTarget.set(r.target_id, list);
    }
    const shift = new Map<string, number>();
    for (const [k, v] of byTarget) shift.set(k, mean(v)!);
    const factors = nodes.filter((n) => n.role !== "outcome");
    const maxB = Math.max(0, ...factors.map((n) => n.betweenness));
    const maxM = Math.max(0, ...factors.map((n) => n.path_relevance ?? 0));
    return { shift, maxB, maxM, counts: byTarget };
  }, [probeResults, nodes]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.node_id, n])), [nodes]);
  const edgeById = useMemo(
    () => new Map(edges.map((e) => [`${e.source}->${e.target}`, e])),
    [edges]
  );

  function shadeOf(n: NodeMetrics): { t: number | null; value: string } {
    if (shade === "betweenness") {
      return {
        t: stats.maxB > 0 ? n.betweenness / stats.maxB : 0,
        value: n.betweenness.toFixed(2),
      };
    }
    if (shade === "mediation") {
      const m = n.path_relevance ?? 0;
      return { t: stats.maxM > 0 ? m / stats.maxM : 0, value: `${Math.round(m * 100)}%` };
    }
    const s = stats.shift.get(n.node_id);
    if (s == null) return { t: null, value: "not probed" };
    return { t: Math.min(1, s / SHIFT_CEILING), value: formatPp(s) };
  }

  const active = hoverId ?? highlightId;
  const isLinked = (edgeId: string, id: string | null) => {
    if (!id) return false;
    if (id.includes("->")) return edgeId === id;
    return edgeId.startsWith(`${id}->`) || edgeId.endsWith(`->${id}`);
  };
  // Nodes to keep at full strength while something is hovered or highlighted
  const litNodes = useMemo(() => {
    const lit = new Set<string>();
    if (!active) return lit;
    if (active.includes("->")) {
      const [a, b] = active.split("->");
      lit.add(a);
      lit.add(b);
    } else {
      lit.add(active);
      for (const e of edges) {
        if (e.source === active) lit.add(e.target);
        if (e.target === active) lit.add(e.source);
      }
    }
    return lit;
  }, [active, edges]);

  const select = (id: string) => onSelect?.(selectedId === id ? null : id);

  // Tooltip content
  const tip = (() => {
    if (!hoverId) return null;
    if (hoverId.includes("->")) {
      const e = edgeById.get(hoverId);
      const le = layout.edges.find((x) => x.id === hoverId);
      if (!e || !le) return null;
      const s = stats.shift.get(hoverId);
      return {
        x: le.midX,
        y: le.midY,
        title: `${humanize(e.source)} → ${humanize(e.target)}`,
        body: e.mechanism,
        rows: [
          ["Shortest path to outcome", e.on_critical_path ? "Yes" : "No"],
          ...(s != null ? [["Avg. forecast shift", formatPp(s)]] : []),
        ] as Array<[string, string]>,
      };
    }
    const n = nodeById.get(hoverId);
    const ln = layout.nodes.find((x) => x.id === hoverId);
    if (!n || !ln) return null;
    const s = stats.shift.get(hoverId);
    return {
      x: ln.x + ln.w / 2,
      y: ln.y,
      title: nodeLabel(n),
      body: n.role === "outcome" ? "The outcome being forecast." : n.description,
      rows:
        n.role === "outcome"
          ? []
          : ([
              ["Betweenness", n.betweenness.toFixed(3)],
              ["Outcome mediation", `${Math.round((n.path_relevance ?? 0) * 100)}%`],
              ["Avg. forecast shift", s != null ? formatPp(s) : "not probed"],
            ] as Array<[string, string]>),
    };
  })();

  const factorCount = nodes.filter((n) => n.role !== "outcome").length;
  // The small home-page figure shrinks to fit instead of scrolling
  const scaleToFit = compact && layout.width > availableWidth + 1;
  const shadeMeta = SHADE_OPTIONS.find((o) => o.key === shade)!;

  return (
    <div className={cn("w-full min-w-0", className)}>
      {!compact && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="eyebrow mb-1.5" id="shade-label">
              Shade factors by
            </p>
            <div
              role="radiogroup"
              aria-labelledby="shade-label"
              className="inline-flex rounded-md border border-rule bg-surface-2 p-0.5"
            >
              {SHADE_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  role="radio"
                  aria-checked={shade === o.key}
                  title={o.hint}
                  onClick={() => setShade(o.key)}
                  className={cn(
                    "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
                    shade === o.key
                      ? "bg-surface text-ink shadow-sm"
                      : "text-ink-2 hover:text-ink"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <Legend shade={shade} />
        </div>
      )}
      {!compact && <p className="mb-3 text-xs text-ink-3">{shadeMeta.hint}</p>}

      <div ref={wrapRef} className={cn("relative w-full", !scaleToFit && "overflow-x-auto")}>
        <div className="relative" style={scaleToFit ? undefined : { width: layout.width, height: layout.height }}>
          <svg
            width={scaleToFit ? "100%" : layout.width}
            height={scaleToFit ? undefined : layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="group"
            aria-label={`Causal network with ${factorCount} factors and ${edges.length} links`}
            className="block select-none"
          >
            <defs>
              {(["ink-2", "ink-3", "accent", "warn"] as const).map((c) => (
                <marker
                  key={c}
                  id={`arrow-${c}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  markerUnits="userSpaceOnUse"
                  orient="auto"
                >
                  <path d="M0,0 L10,5 L0,10 z" style={{ fill: `var(--${c})` }} />
                </marker>
              ))}
            </defs>

            {layout.band && (
              <g>
                {layout.band.direction === "LR" ? (
                  <line
                    x1={8}
                    x2={layout.width - 8}
                    y1={layout.band.pos - 30}
                    y2={layout.band.pos - 30}
                    style={{ stroke: "var(--rule-strong)" }}
                    strokeDasharray="3 4"
                  />
                ) : (
                  <line
                    x1={layout.band.pos - 24}
                    x2={layout.band.pos - 24}
                    y1={8}
                    y2={layout.height - 8}
                    style={{ stroke: "var(--rule-strong)" }}
                    strokeDasharray="3 4"
                  />
                )}
                <text
                  x={layout.band.direction === "LR" ? 10 : layout.band.pos}
                  y={layout.band.direction === "LR" ? layout.band.pos - 14 : 14}
                  style={{
                    fill: "var(--ink-3)",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  NO PATH TO THE OUTCOME
                </text>
              </g>
            )}

            {/* Links */}
            <g fill="none">
              {layout.edges.map((le) => {
                const e = edgeById.get(le.id);
                const critical = e?.on_critical_path ?? false;
                const isSelected = selectedId === le.id;
                const lit = isLinked(le.id, active) || isLinked(le.id, selectedId);
                const dim = active != null && !lit && !isSelected;
                const color = isSelected || (lit && active === le.id)
                  ? "accent"
                  : le.feedback
                    ? "warn"
                    : critical || lit
                      ? "ink-2"
                      : "ink-3";
                return (
                  <g
                    key={le.id}
                    className={onSelect ? "cursor-pointer" : undefined}
                    onMouseEnter={() => setHoverId(le.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={() => onSelect && select(le.id)}
                  >
                    <path
                      d={le.path}
                      style={{
                        stroke: `var(--${color})`,
                        opacity: dim ? 0.25 : critical || lit || isSelected ? 0.95 : 0.6,
                        transition: "opacity 150ms, stroke 150ms",
                      }}
                      strokeWidth={isSelected ? 2.75 : critical ? 1.6 : 1.15}
                      strokeDasharray={le.feedback ? "5 4" : undefined}
                      markerEnd={`url(#arrow-${color})`}
                    />
                    {/* Wide invisible hit area */}
                    <path
                      d={le.path}
                      stroke="transparent"
                      strokeWidth={14}
                      tabIndex={onSelect ? 0 : -1}
                      role={onSelect ? "button" : undefined}
                      aria-label={e ? `Link: ${humanize(e.source)} to ${humanize(e.target)}` : undefined}
                      onFocus={() => setHoverId(le.id)}
                      onBlur={() => setHoverId(null)}
                      onKeyDown={(ev) => {
                        if (onSelect && (ev.key === "Enter" || ev.key === " ")) {
                          ev.preventDefault();
                          select(le.id);
                        }
                      }}
                      style={{ outline: "none" }}
                    />
                  </g>
                );
              })}
            </g>

            {/* Factors */}
            <g>
              {layout.nodes.map((ln) => {
                const n = nodeById.get(ln.id);
                if (!n) return null;
                const isOutcome = ln.isOutcome;
                const { t, value } = isOutcome ? { t: null, value: "" } : shadeOf(n);
                const isSelected = selectedId === ln.id;
                const dim = active != null && !litNodes.has(ln.id) && !isSelected;
                const fill = isOutcome
                  ? "var(--ink)"
                  : t == null
                    ? "var(--surface)"
                    : `color-mix(in oklab, var(--seq-hi) ${Math.round(t * 100)}%, var(--seq-lo))`;
                const textColor = isOutcome
                  ? "var(--paper)"
                  : t != null && t > 0.55
                    ? "var(--seq-text-hi)"
                    : "var(--ink)";
                const subColor = isOutcome
                  ? "var(--paper)"
                  : t != null && t > 0.55
                    ? "var(--seq-text-hi)"
                    : "var(--ink-2)";
                const clickable = onSelect && !isOutcome;
                const labelTop = ln.y + (isOutcome ? 26 : 17);
                return (
                  <g
                    key={ln.id}
                    className={clickable ? "cursor-pointer" : undefined}
                    style={{ opacity: dim ? 0.35 : 1, transition: "opacity 150ms" }}
                    onMouseEnter={() => setHoverId(ln.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={() => clickable && select(ln.id)}
                    tabIndex={clickable ? 0 : -1}
                    role={clickable ? "button" : undefined}
                    aria-pressed={clickable ? isSelected : undefined}
                    aria-label={clickable ? `Factor: ${nodeLabel(n)}` : undefined}
                    onFocus={() => setHoverId(ln.id)}
                    onBlur={() => setHoverId(null)}
                    onKeyDown={(ev) => {
                      if (clickable && (ev.key === "Enter" || ev.key === " ")) {
                        ev.preventDefault();
                        select(ln.id);
                      }
                    }}
                  >
                    {(isSelected || highlightId === ln.id) && (
                      <rect
                        x={ln.x - 4}
                        y={ln.y - 4}
                        width={ln.w + 8}
                        height={ln.h + 8}
                        rx={9}
                        fill="none"
                        style={{ stroke: "var(--accent)" }}
                        strokeWidth={2}
                      />
                    )}
                    <rect
                      x={ln.x}
                      y={ln.y}
                      width={ln.w}
                      height={ln.h}
                      rx={6}
                      style={{
                        fill,
                        stroke: isOutcome
                          ? "var(--ink)"
                          : t == null
                            ? "var(--rule-strong)"
                            : "color-mix(in oklab, var(--seq-hi) 35%, var(--rule))",
                        transition: "fill 200ms",
                      }}
                      strokeWidth={1}
                      strokeDasharray={!isOutcome && t == null ? "3 3" : undefined}
                    />
                    {isOutcome && (
                      <text
                        x={ln.x + 10}
                        y={ln.y + 14}
                        style={{ fill: textColor, fontFamily: "var(--font-sans)", fontSize: 9, letterSpacing: "0.1em", fontWeight: 600, opacity: 0.7 }}
                      >
                        OUTCOME
                      </text>
                    )}
                    {ln.lines.map((line, i) => (
                      <text
                        key={i}
                        x={ln.x + 10}
                        y={labelTop + i * (compact ? 13 : 14)}
                        style={{
                          fill: textColor,
                          fontFamily: "var(--font-cond)",
                          fontSize: compact ? 11.5 : 12.5,
                          fontWeight: 500,
                        }}
                      >
                        {line}
                      </text>
                    ))}
                    {!compact && !isOutcome && (
                      <text
                        x={ln.x + 10}
                        y={ln.y + ln.h - 9}
                        style={{
                          fill: subColor,
                          fontFamily: "var(--font-mono)",
                          fontSize: 10.5,
                          opacity: 0.85,
                        }}
                      >
                        {value}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {tip && !compact && (
            <div
              className="pointer-events-none absolute z-20 w-64 -translate-x-1/2 -translate-y-full rounded-lg border border-rule bg-surface p-3 shadow-lg"
              style={{
                left: Math.min(Math.max(tip.x, 136), layout.width - 136),
                top: tip.y - 8,
              }}
            >
              <p className="font-cond text-sm font-semibold leading-snug text-ink">{tip.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">{tip.body}</p>
              {tip.rows.length > 0 && (
                <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[11px]">
                  {tip.rows.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-ink-3">{k}</dt>
                      <dd className="num text-right text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
      </div>

      {!compact && layout.width > availableWidth + 4 && (
        <p className="mt-2 text-[11px] text-ink-3">Scroll sideways to see the whole network.</p>
      )}

      {!compact && (layout.hasCycle || layout.unlinked.length > 0) && (
        <div className="mt-3 space-y-1.5 border-t border-rule pt-3 text-xs text-ink-2">
          {layout.hasCycle && (
            <p className="flex gap-2">
              <span aria-hidden className="mt-1.5 inline-block h-0 w-5 shrink-0 border-t-2 border-dashed border-warn" />
              <span>
                This network contains a cycle, so it is not a strict DAG. The dashed link closes the
                cycle; graph metrics treat it like any other link.
              </span>
            </p>
          )}
          {layout.unlinked.length > 0 && (
            <p>
              {layout.unlinked.length === 1 ? "One factor has" : `${layout.unlinked.length} factors have`} no
              directed path to the outcome, so {layout.unlinked.length === 1 ? "its" : "their"} outcome
              mediation is zero.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Legend({ shade }: { shade: ShadeMode }) {
  const lo = shade === "shift" ? "0pp" : "lowest";
  const hi = shade === "shift" ? `${SHIFT_CEILING * 100}pp+` : "highest";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-2">
      <div className="flex items-center gap-2">
        <span className="num">{lo}</span>
        <span
          className="h-2.5 w-24 rounded-full border border-rule"
          style={{ background: "linear-gradient(90deg, var(--seq-lo), var(--seq-hi))" }}
        />
        <span className="num">{hi}</span>
        {shade !== "shift" && <span className="text-ink-3">in this network</span>}
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <svg width="22" height="6" aria-hidden>
            <line x1="0" y1="3" x2="22" y2="3" style={{ stroke: "var(--ink-2)" }} strokeWidth="1.8" />
          </svg>
          Shortest path
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="22" height="6" aria-hidden>
            <line x1="0" y1="3" x2="22" y2="3" style={{ stroke: "var(--ink-3)", opacity: 0.7 }} strokeWidth="1.2" />
          </svg>
          Peripheral
        </span>
        {shade === "shift" && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-[3px] border border-dashed border-rule-strong" />
            Not probed
          </span>
        )}
      </div>
    </div>
  );
}

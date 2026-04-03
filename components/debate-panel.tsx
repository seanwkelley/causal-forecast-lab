"use client";

import { useState } from "react";
import type { DebateRound } from "@/lib/debate-pipeline";
import type { NodeMetrics, EdgeMetrics } from "@/lib/types";
import { CausalNetwork } from "@/components/causal-network";

interface DebatePanelProps {
  rounds: DebateRound[];
  modelALabel: string;
  modelBLabel: string;
  initialProbA: number;
  initialProbB: number;
  loading: boolean;
  currentRound: number;
}

// ── SVG Line Graph ──────────────────────────────────────────────────

function ProbabilityLineGraph({
  rounds,
  initialA,
  initialB,
  labelA,
  labelB,
}: {
  rounds: DebateRound[];
  initialA: number;
  initialB: number;
  labelA: string;
  labelB: string;
}) {
  const probsA = [initialA, ...rounds.map((r) => r.modelA.revisedProbability)];
  const probsB = [initialB, ...rounds.map((r) => r.modelB.revisedProbability)];
  const n = probsA.length;

  const W = 500;
  const H = 200;
  const PAD_L = 45;
  const PAD_R = 15;
  const PAD_T = 20;
  const PAD_B = 30;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const allProbs = [...probsA, ...probsB];
  const minP = Math.max(0, Math.min(...allProbs) - 0.05);
  const maxP = Math.min(1, Math.max(...allProbs) + 0.05);
  const range = maxP - minP || 0.1;

  const x = (i: number) => PAD_L + (i / (n - 1 || 1)) * plotW;
  const y = (p: number) => PAD_T + plotH - ((p - minP) / range) * plotH;

  const pathA = probsA.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p)}`).join(" ");
  const pathB = probsB.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p)}`).join(" ");

  const labels = ["Init", ...rounds.map((_, i) => `R${i + 1}`)];

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3">
        Probability Over Rounds
      </h4>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].filter((v) => v >= minP && v <= maxP).map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="#444" strokeWidth={0.5} strokeDasharray="4,4" />
            <text x={PAD_L - 5} y={y(v) + 4} textAnchor="end" fill="#888" fontSize={10}>{(v * 100).toFixed(0)}%</text>
          </g>
        ))}

        {/* Axis labels */}
        {labels.map((label, i) => (
          <text key={i} x={x(i)} y={H - 5} textAnchor="middle" fill="#888" fontSize={10}>{label}</text>
        ))}

        {/* Lines */}
        <path d={pathA} fill="none" stroke="#3b82f6" strokeWidth={2.5} />
        <path d={pathB} fill="none" stroke="#f97316" strokeWidth={2.5} />

        {/* Dots + values */}
        {probsA.map((p, i) => (
          <g key={`a-${i}`}>
            <circle cx={x(i)} cy={y(p)} r={4} fill="#3b82f6" />
            <text x={x(i)} y={y(p) - 8} textAnchor="middle" fill="#3b82f6" fontSize={9} fontWeight="bold">
              {(p * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        {probsB.map((p, i) => (
          <g key={`b-${i}`}>
            <circle cx={x(i)} cy={y(p)} r={4} fill="#f97316" />
            <text x={x(i)} y={y(p) + 14} textAnchor="middle" fill="#f97316" fontSize={9} fontWeight="bold">
              {(p * 100).toFixed(0)}%
            </text>
          </g>
        ))}
      </svg>
      <div className="flex gap-6 mt-2 text-xs text-[var(--color-muted-foreground)]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded bg-blue-500" /> {labelA}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded bg-orange-500" /> {labelB}
        </span>
      </div>
    </div>
  );
}

// ── DAG Viewer for a round ──────────────────────────────────────────

function RoundDAGs({
  round,
  modelALabel,
  modelBLabel,
}: {
  round: DebateRound;
  modelALabel: string;
  modelBLabel: string;
}) {
  function toNodeMetrics(nodes: { id: string; description: string; role: "factor" | "outcome" }[]): NodeMetrics[] {
    return nodes.map((n) => ({
      node_id: n.id,
      description: n.description,
      role: n.role,
      in_degree: 0,
      out_degree: 0,
      betweenness: 0,
      closeness: 0,
      pagerank: 0,
      path_relevance: 0,
    }));
  }

  function toEdgeMetrics(edges: { from: string; to: string; mechanism: string }[]): EdgeMetrics[] {
    return edges.map((e) => ({
      source: e.from,
      target: e.to,
      mechanism: e.mechanism,
      edge_betweenness: 0,
      on_critical_path: false,
    }));
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-medium text-blue-400 mb-2">{modelALabel} — Round {round.round}</p>
        <div className="h-[300px] rounded-lg border border-[var(--color-border)] bg-[var(--color-secondary)]/30">
          <CausalNetwork
            nodes={toNodeMetrics(round.modelA.revisedNodes)}
            edges={toEdgeMetrics(round.modelA.revisedEdges)}
            height={300}
          />
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-orange-400 mb-2">{modelBLabel} — Round {round.round}</p>
        <div className="h-[300px] rounded-lg border border-[var(--color-border)] bg-[var(--color-secondary)]/30">
          <CausalNetwork
            nodes={toNodeMetrics(round.modelB.revisedNodes)}
            edges={toEdgeMetrics(round.modelB.revisedEdges)}
            height={300}
          />
        </div>
      </div>
    </div>
  );
}

// ── Round Card ──────────────────────────────────────────────────────

function RoundCard({
  round,
  modelALabel,
  modelBLabel,
}: {
  round: DebateRound;
  modelALabel: string;
  modelBLabel: string;
}) {
  const [showDAGs, setShowDAGs] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Round {round.round}</h4>
        <button
          onClick={() => setShowDAGs(!showDAGs)}
          className="text-xs text-[var(--color-primary)] hover:underline"
        >
          {showDAGs ? "Hide DAGs" : "Show DAGs"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Model A's critique of B */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-medium">{modelALabel} critiques {modelBLabel}</span>
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed">
            {round.modelA.critique}
          </p>
          <div className="text-xs">
            <span className="text-[var(--color-muted-foreground)]">Updated: </span>
            <span className="font-mono font-bold">
              {(round.modelA.revisedProbability * 100).toFixed(0)}%
            </span>
            <span className="text-[var(--color-muted-foreground)] ml-2">
              ({round.modelA.revisedNodes.length}N / {round.modelA.revisedEdges.length}E)
            </span>
          </div>
          <p className="text-[10px] text-[var(--color-muted-foreground)] italic">
            {round.modelA.reasoning}
          </p>
        </div>

        {/* Model B's critique of A */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-xs font-medium">{modelBLabel} critiques {modelALabel}</span>
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed">
            {round.modelB.critique}
          </p>
          <div className="text-xs">
            <span className="text-[var(--color-muted-foreground)]">Updated: </span>
            <span className="font-mono font-bold">
              {(round.modelB.revisedProbability * 100).toFixed(0)}%
            </span>
            <span className="text-[var(--color-muted-foreground)] ml-2">
              ({round.modelB.revisedNodes.length}N / {round.modelB.revisedEdges.length}E)
            </span>
          </div>
          <p className="text-[10px] text-[var(--color-muted-foreground)] italic">
            {round.modelB.reasoning}
          </p>
        </div>
      </div>

      {showDAGs && (
        <RoundDAGs round={round} modelALabel={modelALabel} modelBLabel={modelBLabel} />
      )}
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────

export function DebatePanel({
  rounds,
  modelALabel,
  modelBLabel,
  initialProbA,
  initialProbB,
  loading,
  currentRound,
}: DebatePanelProps) {
  const lastRound = rounds[rounds.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
          Debate ({rounds.length}/5 rounds)
        </h3>
        {loading && (
          <span className="text-xs text-[var(--color-muted-foreground)] animate-pulse">
            Round {currentRound} in progress...
          </span>
        )}
      </div>

      <ProbabilityLineGraph
        rounds={rounds}
        initialA={initialProbA}
        initialB={initialProbB}
        labelA={modelALabel}
        labelB={modelBLabel}
      />

      <div className="space-y-3">
        {rounds.map((round) => (
          <RoundCard
            key={round.round}
            round={round}
            modelALabel={modelALabel}
            modelBLabel={modelBLabel}
          />
        ))}
      </div>

      {/* Final DAGs (always shown after debate completes) */}
      {rounds.length >= 5 && lastRound && (
        <>
          <div className="rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-4">
            <h4 className="text-sm font-semibold mb-2">Debate Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[var(--color-muted-foreground)]">{modelALabel}: </span>
                <span className="font-mono">
                  {(initialProbA * 100).toFixed(0)}% → {(lastRound.modelA.revisedProbability * 100).toFixed(0)}%
                </span>
                <span className="text-[var(--color-muted-foreground)]">
                  {" "}({((lastRound.modelA.revisedProbability - initialProbA) * 100) >= 0 ? "+" : ""}
                  {((lastRound.modelA.revisedProbability - initialProbA) * 100).toFixed(1)}pp)
                </span>
              </div>
              <div>
                <span className="text-[var(--color-muted-foreground)]">{modelBLabel}: </span>
                <span className="font-mono">
                  {(initialProbB * 100).toFixed(0)}% → {(lastRound.modelB.revisedProbability * 100).toFixed(0)}%
                </span>
                <span className="text-[var(--color-muted-foreground)]">
                  {" "}({((lastRound.modelB.revisedProbability - initialProbB) * 100) >= 0 ? "+" : ""}
                  {((lastRound.modelB.revisedProbability - initialProbB) * 100).toFixed(1)}pp)
                </span>
              </div>
            </div>
            <div className="mt-2 text-xs text-[var(--color-muted-foreground)]">
              Convergence: |gap| went from{" "}
              {(Math.abs(initialProbA - initialProbB) * 100).toFixed(1)}pp to{" "}
              {(Math.abs(lastRound.modelA.revisedProbability - lastRound.modelB.revisedProbability) * 100).toFixed(1)}pp
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Final DAGs</h4>
            <RoundDAGs round={lastRound} modelALabel={modelALabel} modelBLabel={modelBLabel} />
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import type { DebateRound } from "@/lib/debate-pipeline";

interface DebatePanelProps {
  rounds: DebateRound[];
  modelALabel: string;
  modelBLabel: string;
  initialProbA: number;
  initialProbB: number;
  loading: boolean;
  currentRound: number;
}

function ProbabilityTrack({
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

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3">
        Probability Convergence
      </h4>
      <div className="flex items-end gap-1 h-24">
        {probsA.map((p, i) => (
          <div key={`a-${i}`} className="flex-1 flex flex-col items-center gap-1">
            <div className="text-[10px] text-[var(--color-muted-foreground)]">
              {i === 0 ? "Init" : `R${i}`}
            </div>
            <div className="w-full flex gap-0.5">
              <div
                className="flex-1 rounded-sm bg-blue-500/70"
                style={{ height: `${p * 80}px` }}
                title={`${labelA}: ${(p * 100).toFixed(0)}%`}
              />
              <div
                className="flex-1 rounded-sm bg-orange-500/70"
                style={{ height: `${(probsB[i] ?? 0) * 80}px` }}
                title={`${labelB}: ${((probsB[i] ?? 0) * 100).toFixed(0)}%`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-2 text-[10px] text-[var(--color-muted-foreground)]">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-blue-500/70" /> {labelA}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-orange-500/70" /> {labelB}
        </span>
      </div>
    </div>
  );
}

function RoundCard({
  round,
  modelALabel,
  modelBLabel,
}: {
  round: DebateRound;
  modelALabel: string;
  modelBLabel: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 space-y-4">
      <h4 className="text-sm font-semibold">Round {round.round}</h4>

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
            <span className="text-[var(--color-muted-foreground)]">Updated estimate: </span>
            <span className="font-mono font-bold">
              {(round.modelA.revisedProbability * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-[10px] text-[var(--color-muted-foreground)] italic">
            {round.modelA.reasoning}
          </p>
          <div className="text-[10px] text-[var(--color-muted-foreground)]">
            {round.modelA.revisedNodes.length} nodes, {round.modelA.revisedEdges.length} edges
          </div>
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
            <span className="text-[var(--color-muted-foreground)]">Updated estimate: </span>
            <span className="font-mono font-bold">
              {(round.modelB.revisedProbability * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-[10px] text-[var(--color-muted-foreground)] italic">
            {round.modelB.reasoning}
          </p>
          <div className="text-[10px] text-[var(--color-muted-foreground)]">
            {round.modelB.revisedNodes.length} nodes, {round.modelB.revisedEdges.length} edges
          </div>
        </div>
      </div>
    </div>
  );
}

export function DebatePanel({
  rounds,
  modelALabel,
  modelBLabel,
  initialProbA,
  initialProbB,
  loading,
  currentRound,
}: DebatePanelProps) {
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

      <ProbabilityTrack
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

      {rounds.length >= 5 && (
        <div className="rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-4">
          <h4 className="text-sm font-semibold mb-2">Debate Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[var(--color-muted-foreground)]">{modelALabel}: </span>
              <span className="font-mono">
                {(initialProbA * 100).toFixed(0)}% → {(rounds[rounds.length - 1].modelA.revisedProbability * 100).toFixed(0)}%
              </span>
              <span className="text-[var(--color-muted-foreground)]">
                {" "}(Δ = {((rounds[rounds.length - 1].modelA.revisedProbability - initialProbA) * 100).toFixed(1)}pp)
              </span>
            </div>
            <div>
              <span className="text-[var(--color-muted-foreground)]">{modelBLabel}: </span>
              <span className="font-mono">
                {(initialProbB * 100).toFixed(0)}% → {(rounds[rounds.length - 1].modelB.revisedProbability * 100).toFixed(0)}%
              </span>
              <span className="text-[var(--color-muted-foreground)]">
                {" "}(Δ = {((rounds[rounds.length - 1].modelB.revisedProbability - initialProbB) * 100).toFixed(1)}pp)
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--color-muted-foreground)]">
            Convergence: |gap| went from{" "}
            {(Math.abs(initialProbA - initialProbB) * 100).toFixed(1)}pp to{" "}
            {(Math.abs(rounds[rounds.length - 1].modelA.revisedProbability - rounds[rounds.length - 1].modelB.revisedProbability) * 100).toFixed(1)}pp
          </div>
        </div>
      )}
    </div>
  );
}

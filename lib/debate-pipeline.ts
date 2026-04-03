/**
 * Multi-model debate pipeline.
 *
 * After two models independently generate DAG + probes, they critique
 * each other's networks using probe evidence. Each round:
 *   1. Model A sees Model B's DAG + probe results, provides structured critique
 *   2. Model B sees Model A's DAG + probe results, provides structured critique
 *   3. Both models revise their DAGs and update probabilities
 *
 * 5 rounds of debate, measuring convergence.
 */

import { callOpenRouter, parseJsonResponse, type ChatMessage } from "./openrouter";

export interface DebateRound {
  round: number;
  modelA: {
    critique: string;
    revisedProbability: number;
    revisedNodes: { id: string; description: string; role: string }[];
    revisedEdges: { from: string; to: string; mechanism: string }[];
    reasoning: string;
  };
  modelB: {
    critique: string;
    revisedProbability: number;
    revisedNodes: { id: string; description: string; role: string }[];
    revisedEdges: { from: string; to: string; mechanism: string }[];
    reasoning: string;
  };
}

export interface DebateResult {
  question: string;
  modelA: { id: string; label: string };
  modelB: { id: string; label: string };
  rounds: DebateRound[];
  initialProbA: number;
  initialProbB: number;
  finalProbA: number;
  finalProbB: number;
}

interface ProbeEvidence {
  probe_type: string;
  target_id: string;
  target_importance: number;
  absolute_shift: number;
  probe_text: string;
}

function formatDAG(
  nodes: { id: string; description: string; role: string }[],
  edges: { from: string; to: string; mechanism: string }[]
): string {
  const nodeLines = nodes
    .map((n) => `  - ${n.id}: ${n.description} [${n.role}]`)
    .join("\n");
  const edgeLines = edges
    .map((e) => `  - ${e.from} → ${e.to}: ${e.mechanism}`)
    .join("\n");
  return `Nodes:\n${nodeLines}\n\nEdges:\n${edgeLines}`;
}

function formatProbeEvidence(probes: ProbeEvidence[]): string {
  // Show top shifts and bottom shifts
  const sorted = [...probes]
    .filter((p) => p.absolute_shift != null)
    .sort((a, b) => b.absolute_shift - a.absolute_shift);

  const top = sorted.slice(0, 5);
  const bottom = sorted.slice(-3);

  const lines = [
    "Strongest reactions (largest probability shifts):",
    ...top.map(
      (p) =>
        `  - ${p.probe_type} on "${p.target_id}" (importance=${p.target_importance.toFixed(3)}): shifted ${(p.absolute_shift * 100).toFixed(1)}pp`
    ),
    "",
    "Weakest reactions (smallest shifts):",
    ...bottom.map(
      (p) =>
        `  - ${p.probe_type} on "${p.target_id}" (importance=${p.target_importance.toFixed(3)}): shifted ${(p.absolute_shift * 100).toFixed(1)}pp`
    ),
  ];
  return lines.join("\n");
}

const CRITIQUE_SYSTEM = `You are an expert forecaster reviewing another model's causal analysis. \
You will see their causal network, their probability estimate, and evidence from \
probing experiments that tested how their estimate shifted when specific factors \
were challenged.

Your task is to provide a structured critique and then revise YOUR OWN causal \
network and probability estimate based on what you learned.

Respond with ONLY valid JSON:
{
  "critique": "<2-3 sentences identifying specific structural weaknesses or \
disagreements, referencing the probe evidence>",
  "revised_probability": <float 0.01-0.99>,
  "revised_nodes": [{"id": "snake_case", "description": "...", "role": "factor" or "outcome"}],
  "revised_edges": [{"from": "node_id", "to": "node_id", "mechanism": "..."}],
  "reasoning": "<1-2 sentences explaining what you changed and why>"
}

Requirements:
- 6-10 factor nodes plus exactly 1 outcome node
- Every node must have at least one edge
- Reference specific probe evidence in your critique
- Your revised network should address weaknesses you identified`;

function buildCritiquePrompt(
  question: string,
  myProb: number,
  myNodes: { id: string; description: string; role: string }[],
  myEdges: { from: string; to: string; mechanism: string }[],
  theirProb: number,
  theirNodes: { id: string; description: string; role: string }[],
  theirEdges: { from: string; to: string; mechanism: string }[],
  theirProbeEvidence: ProbeEvidence[],
  roundNum: number,
  previousCritique?: string
): string {
  let prompt = `Question: "${question}"

YOUR current estimate: ${myProb.toFixed(2)}
YOUR current causal network:
${formatDAG(myNodes, myEdges)}

THE OTHER MODEL's estimate: ${theirProb.toFixed(2)}
THE OTHER MODEL's causal network:
${formatDAG(theirNodes, theirEdges)}

PROBE EVIDENCE from testing the other model's network:
${formatProbeEvidence(theirProbeEvidence)}`;

  if (previousCritique) {
    prompt += `\n\nPREVIOUS ROUND's critique of your network:\n${previousCritique}`;
  }

  prompt += `\n\nThis is debate round ${roundNum}/5. Critique the other model's network \
using the probe evidence, then provide your revised network and probability.`;

  return prompt;
}

export async function runDebateRound(
  question: string,
  roundNum: number,
  modelAId: string,
  modelBId: string,
  apiKey: string,
  stateA: {
    probability: number;
    nodes: { id: string; description: string; role: string }[];
    edges: { from: string; to: string; mechanism: string }[];
  },
  stateB: {
    probability: number;
    nodes: { id: string; description: string; role: string }[];
    edges: { from: string; to: string; mechanism: string }[];
  },
  probeEvidenceA: ProbeEvidence[],
  probeEvidenceB: ProbeEvidence[],
  previousCritiqueOfA?: string,
  previousCritiqueOfB?: string
): Promise<DebateRound> {
  // Model A critiques Model B's network
  const promptA = buildCritiquePrompt(
    question,
    stateA.probability,
    stateA.nodes,
    stateA.edges,
    stateB.probability,
    stateB.nodes,
    stateB.edges,
    probeEvidenceB,
    roundNum,
    previousCritiqueOfA
  );

  // Model B critiques Model A's network
  const promptB = buildCritiquePrompt(
    question,
    stateB.probability,
    stateB.nodes,
    stateB.edges,
    stateA.probability,
    stateA.nodes,
    stateA.edges,
    probeEvidenceA,
    roundNum,
    previousCritiqueOfB
  );

  // Run both critiques in parallel
  const [rawA, rawB] = await Promise.all([
    callOpenRouter(
      [
        { role: "system", content: CRITIQUE_SYSTEM },
        { role: "user", content: promptA },
      ],
      { model: modelAId, apiKey, jsonMode: true, temperature: 0.7, maxTokens: 2500 }
    ),
    callOpenRouter(
      [
        { role: "system", content: CRITIQUE_SYSTEM },
        { role: "user", content: promptB },
      ],
      { model: modelBId, apiKey, jsonMode: true, temperature: 0.7, maxTokens: 2500 }
    ),
  ]);

  const parsedA = parseJsonResponse(rawA) as {
    critique: string;
    revised_probability: number;
    revised_nodes: { id: string; description: string; role: string }[];
    revised_edges: { from: string; to: string; mechanism: string }[];
    reasoning: string;
  };

  const parsedB = parseJsonResponse(rawB) as {
    critique: string;
    revised_probability: number;
    revised_nodes: { id: string; description: string; role: string }[];
    revised_edges: { from: string; to: string; mechanism: string }[];
    reasoning: string;
  };

  return {
    round: roundNum,
    modelA: {
      critique: parsedA.critique,
      revisedProbability: Math.max(0.01, Math.min(0.99, parsedA.revised_probability)),
      revisedNodes: parsedA.revised_nodes,
      revisedEdges: parsedA.revised_edges,
      reasoning: parsedA.reasoning,
    },
    modelB: {
      critique: parsedB.critique,
      revisedProbability: Math.max(0.01, Math.min(0.99, parsedB.revised_probability)),
      revisedNodes: parsedB.revised_nodes,
      revisedEdges: parsedB.revised_edges,
      reasoning: parsedB.reasoning,
    },
  };
}

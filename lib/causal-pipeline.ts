/**
 * TypeScript port of the causal forecast + probe pipeline.
 * Used for live mode API route.
 */

import { callOpenRouter, parseJsonResponse, type ChatMessage } from "./openrouter";

// ------- Types -------

interface CausalNode {
  id: string;
  description: string;
  role: "factor" | "outcome";
}

interface CausalEdge {
  from: string;
  to: string;
  mechanism: string;
}

interface CausalForecast {
  probability: number;
  reasoning: string;
  nodes: CausalNode[];
  edges: CausalEdge[];
}

interface NodeMetrics {
  node_id: string;
  description: string;
  role: string;
  in_degree: number;
  out_degree: number;
  betweenness: number;
  closeness: number;
  pagerank: number;
  path_relevance: number;
}

interface EdgeMetrics {
  source: string;
  target: string;
  mechanism: string;
  edge_betweenness: number;
  on_critical_path: boolean;
}

interface ProbeTarget {
  target_type: string;
  target_id: string;
  description: string;
  importance: number;
  centrality_rank: number;
  on_critical_path: boolean;
  probe_type: string;
}

// ------- Step 1: Causal Forecast -------

const CAUSAL_FORECAST_PROMPT = `You are a superforecaster. Given a question, produce a JSON object with:
1. "probability": your estimated probability (0.01-0.99)
2. "reasoning": brief explanation of your reasoning
3. "nodes": array of causal factors, each with "id" (snake_case), "description", and "role" ("factor" or "outcome"). Include exactly ONE node with role "outcome".
4. "edges": array of directed causal links, each with "from" (source node id), "to" (target node id), and "mechanism" (brief description of the causal mechanism).

The causal network should have 5-8 factor nodes plus 1 outcome node, with edges forming a coherent causal model.
Respond ONLY with valid JSON.`;

export async function generateCausalForecast(
  question: string,
  background: string | undefined,
  model: string,
  apiKey: string
): Promise<CausalForecast> {
  const userMsg = background
    ? `Question: ${question}\n\nBackground: ${background}`
    : `Question: ${question}`;

  const messages: ChatMessage[] = [
    { role: "system", content: CAUSAL_FORECAST_PROMPT },
    { role: "user", content: userMsg },
  ];

  const raw = await callOpenRouter(messages, {
    model,
    apiKey,
    jsonMode: true,
    temperature: 0.3,
    maxTokens: 2048,
  });

  const parsed = parseJsonResponse(raw) as CausalForecast;
  // Clamp probability
  parsed.probability = Math.max(0.01, Math.min(0.99, parsed.probability));
  return parsed;
}

// ------- Step 2: Network Analysis (local, no LLM) -------

function computeNetworkAnalysis(
  nodes: CausalNode[],
  edges: CausalEdge[]
): {
  nodeMetrics: NodeMetrics[];
  edgeMetrics: EdgeMetrics[];
  probeTargets: ProbeTarget[];
  stats: {
    n_nodes: number;
    n_edges: number;
    density: number;
    is_dag: boolean;
    outcome_node: string;
  };
} {
  const n = nodes.length;
  const nodeMap = new Map(nodes.map((nd) => [nd.id, nd]));
  const outcomeNode = nodes.find((nd) => nd.role === "outcome")?.id ?? nodes[nodes.length - 1].id;

  // Adjacency
  const adj: Record<string, string[]> = {};
  const revAdj: Record<string, string[]> = {};
  for (const nd of nodes) {
    adj[nd.id] = [];
    revAdj[nd.id] = [];
  }
  for (const e of edges) {
    if (adj[e.from]) adj[e.from].push(e.to);
    if (revAdj[e.to]) revAdj[e.to].push(e.from);
  }

  // In/out degree
  const inDeg: Record<string, number> = {};
  const outDeg: Record<string, number> = {};
  for (const nd of nodes) {
    outDeg[nd.id] = adj[nd.id]?.length ?? 0;
    inDeg[nd.id] = revAdj[nd.id]?.length ?? 0;
  }

  // BFS shortest paths for betweenness approximation
  function bfs(start: string): Record<string, number> {
    const dist: Record<string, number> = { [start]: 0 };
    const queue = [start];
    let i = 0;
    while (i < queue.length) {
      const cur = queue[i++];
      for (const next of adj[cur] || []) {
        if (dist[next] === undefined) {
          dist[next] = dist[cur] + 1;
          queue.push(next);
        }
      }
    }
    return dist;
  }

  // Simple betweenness: fraction of all-pairs shortest paths through each node
  const betweenness: Record<string, number> = {};
  for (const nd of nodes) betweenness[nd.id] = 0;

  const allPairs = nodes.map((nd) => ({ id: nd.id, dist: bfs(nd.id) }));
  let totalPaths = 0;
  for (const src of allPairs) {
    for (const tgt of nodes) {
      if (src.id === tgt.id) continue;
      if (src.dist[tgt.id] === undefined) continue;
      totalPaths++;
      // Check intermediate nodes
      for (const mid of nodes) {
        if (mid.id === src.id || mid.id === tgt.id) continue;
        const distSrcMid = src.dist[mid.id];
        const midDist = allPairs.find((p) => p.id === mid.id)?.dist[tgt.id];
        if (
          distSrcMid !== undefined &&
          midDist !== undefined &&
          distSrcMid + midDist === src.dist[tgt.id]
        ) {
          betweenness[mid.id]++;
        }
      }
    }
  }
  // Normalize
  const maxBet = Math.max(...Object.values(betweenness), 1);
  for (const nd of nodes) betweenness[nd.id] /= maxBet;

  // Path relevance: fraction of paths to outcome through node
  const pathsToOutcome = allPairs.filter(
    (p) => p.dist[outcomeNode] !== undefined && p.id !== outcomeNode
  );
  const pathRelevance: Record<string, number> = {};
  for (const nd of nodes) {
    if (nd.id === outcomeNode) {
      pathRelevance[nd.id] = 0;
      continue;
    }
    let onPath = 0;
    for (const src of pathsToOutcome) {
      if (src.id === nd.id) continue;
      const srcToNode = src.dist[nd.id];
      const nodeToOutcome = allPairs.find((p) => p.id === nd.id)?.dist[outcomeNode];
      if (
        srcToNode !== undefined &&
        nodeToOutcome !== undefined &&
        srcToNode + nodeToOutcome === src.dist[outcomeNode]
      ) {
        onPath++;
      }
    }
    pathRelevance[nd.id] =
      pathsToOutcome.length > 0 ? onPath / pathsToOutcome.length : 0;
  }

  // PageRank (simple)
  const pr: Record<string, number> = {};
  for (const nd of nodes) pr[nd.id] = 1 / n;
  const d = 0.85;
  for (let iter = 0; iter < 20; iter++) {
    const newPr: Record<string, number> = {};
    for (const nd of nodes) {
      let sum = 0;
      for (const pred of revAdj[nd.id] || []) {
        sum += pr[pred] / (outDeg[pred] || 1);
      }
      newPr[nd.id] = (1 - d) / n + d * sum;
    }
    Object.assign(pr, newPr);
  }

  // Closeness
  const closeness: Record<string, number> = {};
  for (const src of allPairs) {
    const dists = Object.values(src.dist).filter((d) => d > 0);
    closeness[src.id] = dists.length > 0 ? dists.length / dists.reduce((a, b) => a + b, 0) : 0;
  }
  // Normalize closeness
  const maxCl = Math.max(...Object.values(closeness), 1);
  for (const nd of nodes) closeness[nd.id] /= maxCl;

  const nodeMetrics: NodeMetrics[] = nodes.map((nd) => ({
    node_id: nd.id,
    description: nd.description,
    role: nd.role,
    in_degree: inDeg[nd.id],
    out_degree: outDeg[nd.id],
    betweenness: betweenness[nd.id],
    closeness: closeness[nd.id],
    pagerank: pr[nd.id],
    path_relevance: pathRelevance[nd.id],
  }));

  // Edge metrics
  const edgeMetrics: EdgeMetrics[] = edges.map((e) => {
    // Check if on critical path (shortest path from any root to outcome)
    const srcDist = allPairs.find((p) => p.id === e.from)?.dist;
    const tgtDist = allPairs.find((p) => p.id === e.to)?.dist;
    const onCritical =
      srcDist?.[outcomeNode] !== undefined &&
      tgtDist?.[outcomeNode] !== undefined &&
      srcDist[outcomeNode] === 1 + (tgtDist[outcomeNode] ?? Infinity);

    return {
      source: e.from,
      target: e.to,
      mechanism: e.mechanism,
      edge_betweenness: 0.1, // Simplified
      on_critical_path: onCritical,
    };
  });

  // Probe targets
  const sortedNodes = [...nodeMetrics]
    .filter((nm) => nm.role !== "outcome")
    .sort((a, b) => b.betweenness - a.betweenness);

  const probeTargets: ProbeTarget[] = [];

  // High importance negations
  if (sortedNodes.length > 0) {
    probeTargets.push({
      target_type: "node",
      target_id: sortedNodes[0].node_id,
      description: sortedNodes[0].description,
      importance: sortedNodes[0].betweenness,
      centrality_rank: 1,
      on_critical_path: pathRelevance[sortedNodes[0].node_id] > 0,
      probe_type: "node_negate_high",
    });
  }
  if (sortedNodes.length > 1) {
    probeTargets.push({
      target_type: "node",
      target_id: sortedNodes[1].node_id,
      description: sortedNodes[1].description,
      importance: sortedNodes[1].betweenness,
      centrality_rank: 2,
      on_critical_path: pathRelevance[sortedNodes[1].node_id] > 0,
      probe_type: "node_negate_high",
    });
  }

  // Medium importance
  const midIdx = Math.floor(sortedNodes.length / 2);
  if (sortedNodes.length > midIdx) {
    probeTargets.push({
      target_type: "node",
      target_id: sortedNodes[midIdx].node_id,
      description: sortedNodes[midIdx].description,
      importance: sortedNodes[midIdx].betweenness,
      centrality_rank: midIdx + 1,
      on_critical_path: pathRelevance[sortedNodes[midIdx].node_id] > 0,
      probe_type: "node_negate_medium",
    });
  }

  // Low importance
  if (sortedNodes.length > 2) {
    const lastIdx = sortedNodes.length - 1;
    probeTargets.push({
      target_type: "node",
      target_id: sortedNodes[lastIdx].node_id,
      description: sortedNodes[lastIdx].description,
      importance: sortedNodes[lastIdx].betweenness,
      centrality_rank: lastIdx + 1,
      on_critical_path: false,
      probe_type: "node_negate_low",
    });
  }

  // Strengthen top nodes (high)
  for (let i = 0; i < Math.min(2, sortedNodes.length); i++) {
    probeTargets.push({
      target_type: "node",
      target_id: sortedNodes[i].node_id,
      description: sortedNodes[i].description,
      importance: sortedNodes[i].betweenness,
      centrality_rank: i + 1,
      on_critical_path: pathRelevance[sortedNodes[i].node_id] > 0,
      probe_type: "node_strengthen",
    });
  }

  // Strengthen medium importance node
  if (sortedNodes.length >= 3) {
    const midIdx = Math.floor(sortedNodes.length / 2);
    probeTargets.push({
      target_type: "node",
      target_id: sortedNodes[midIdx].node_id,
      description: sortedNodes[midIdx].description,
      importance: sortedNodes[midIdx].betweenness,
      centrality_rank: midIdx + 1,
      on_critical_path: pathRelevance[sortedNodes[midIdx].node_id] > 0,
      probe_type: "node_strengthen_medium",
    });
  }

  // Strengthen low importance node
  if (sortedNodes.length >= 2) {
    const lastIdx = sortedNodes.length - 1;
    probeTargets.push({
      target_type: "node",
      target_id: sortedNodes[lastIdx].node_id,
      description: sortedNodes[lastIdx].description,
      importance: sortedNodes[lastIdx].betweenness,
      centrality_rank: lastIdx + 1,
      on_critical_path: false,
      probe_type: "node_strengthen_low",
    });
  }

  // Edge probes
  const critEdges = edgeMetrics.filter((e) => e.on_critical_path);
  const nonCritEdges = edgeMetrics.filter((e) => !e.on_critical_path);

  for (let i = 0; i < Math.min(2, critEdges.length); i++) {
    probeTargets.push({
      target_type: "edge",
      target_id: `${critEdges[i].source}->${critEdges[i].target}`,
      description: critEdges[i].mechanism,
      importance: critEdges[i].edge_betweenness,
      centrality_rank: i + 1,
      on_critical_path: true,
      probe_type: "edge_negate_critical",
    });
  }

  if (nonCritEdges.length > 0) {
    probeTargets.push({
      target_type: "edge",
      target_id: `${nonCritEdges[0].source}->${nonCritEdges[0].target}`,
      description: nonCritEdges[0].mechanism,
      importance: nonCritEdges[0].edge_betweenness,
      centrality_rank: edgeMetrics.length,
      on_critical_path: false,
      probe_type: "edge_negate_peripheral",
    });
  }

  // Edge strengthen: critical edges
  for (let i = 0; i < Math.min(2, critEdges.length); i++) {
    probeTargets.push({
      target_type: "edge",
      target_id: `${critEdges[i].source}->${critEdges[i].target}`,
      description: critEdges[i].mechanism,
      importance: critEdges[i].edge_betweenness,
      centrality_rank: i + 1,
      on_critical_path: true,
      probe_type: "edge_strengthen_critical",
    });
  }

  // Edge strengthen: peripheral
  if (nonCritEdges.length > 0) {
    probeTargets.push({
      target_type: "edge",
      target_id: `${nonCritEdges[0].source}->${nonCritEdges[0].target}`,
      description: nonCritEdges[0].mechanism,
      importance: nonCritEdges[0].edge_betweenness,
      centrality_rank: edgeMetrics.length,
      on_critical_path: false,
      probe_type: "edge_strengthen_peripheral",
    });
  }

  // Structural probe
  probeTargets.push({
    target_type: "structural",
    target_id: "missing_node_1",
    description: "A plausible factor not in the current network",
    importance: 0,
    centrality_rank: 0,
    on_critical_path: false,
    probe_type: "missing_node",
  });

  // Control probe
  probeTargets.push({
    target_type: "structural",
    target_id: "irrelevant_1",
    description: "Topically related but causally irrelevant information",
    importance: 0,
    centrality_rank: 0,
    on_critical_path: false,
    probe_type: "irrelevant",
  });

  // Density
  const density = n > 1 ? edges.length / (n * (n - 1)) : 0;
  // DAG check (simple cycle detection via DFS)
  let isDag = true;
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function dfs(node: string): boolean {
    if (visiting.has(node)) return false; // cycle
    if (visited.has(node)) return true;
    visiting.add(node);
    for (const next of adj[node] || []) {
      if (!dfs(next)) return false;
    }
    visiting.delete(node);
    visited.add(node);
    return true;
  }
  for (const nd of nodes) {
    if (!visited.has(nd.id)) {
      if (!dfs(nd.id)) {
        isDag = false;
        break;
      }
    }
  }

  return {
    nodeMetrics,
    edgeMetrics,
    probeTargets,
    stats: {
      n_nodes: n,
      n_edges: edges.length,
      density: Math.round(density * 10000) / 10000,
      is_dag: isDag,
      outcome_node: outcomeNode,
    },
  };
}

// ------- Step 3: Generate & Run Probes -------

const PROBE_GEN_PROMPT = `You are generating a probe to test a forecaster's sensitivity. Given the question, causal network, and a probe target, generate a brief (2-4 sentences) piece of evidence or argument that challenges the specified belief.

Respond with JSON: {"probe_text": "..."}`;

const PROBED_FORECAST_PROMPT = `You are a superforecaster who previously estimated a probability for a question based on a causal model. Now consider this new information and update your estimate.

Respond with JSON: {"updated_probability": <0.01-0.99>, "shift_direction": "increased"|"decreased"|"unchanged", "reasoning": "brief explanation of how this changes your causal model"}`;

export interface PipelineProgress {
  stage: string;
  current?: number;
  total?: number;
}

export async function runFullPipeline(
  question: string,
  background: string | undefined,
  resolutionDate: string | undefined,
  model: string,
  apiKey: string,
  onProgress?: (update: PipelineProgress) => void
): Promise<Record<string, unknown>> {
  // Step 1: Causal forecast
  onProgress?.({ stage: "Generating causal network..." });
  const forecast = await generateCausalForecast(question, background, model, apiKey);
  onProgress?.({ stage: `Network generated (${forecast.nodes.length} nodes, ${forecast.edges.length} edges)` });

  // Step 2: Network analysis (local)
  const { nodeMetrics, edgeMetrics, probeTargets, stats } =
    computeNetworkAnalysis(forecast.nodes, forecast.edges);
  onProgress?.({ stage: "Analyzing network structure..." });

  // Step 3: Generate probes and get probed forecasts
  const probeResults: Array<{
    probe_type: string;
    target_reason_id: null;
    probe_text: string;
    probe_generated: boolean;
    success: boolean;
    updated_probability: number | null;
    absolute_shift: number | null;
    shift_direction: string;
    reasoning: string;
    raw_response: string;
    target_id: string;
    target_type: string;
    target_importance: number;
    target_centrality_rank: number;
    target_on_critical_path: boolean;
    probe_category: string;
  }> = [];

  const probeTotal = probeTargets.length;
  onProgress?.({ stage: "Running probes...", current: 0, total: probeTotal });

  for (let probeIdx = 0; probeIdx < probeTargets.length; probeIdx++) {
    const target = probeTargets[probeIdx];
    try {
      // Generate probe text
      const genMessages: ChatMessage[] = [
        { role: "system", content: PROBE_GEN_PROMPT },
        {
          role: "user",
          content: `Question: ${question}\n\nCausal network nodes: ${forecast.nodes.map((n) => n.id).join(", ")}\n\nProbe type: ${target.probe_type}\nTarget: ${target.target_id} — ${target.description}\n\nGenerate the probe:`,
        },
      ];

      const genRaw = await callOpenRouter(genMessages, {
        model,
        apiKey,
        jsonMode: true,
        temperature: 0.5,
        maxTokens: 512,
      });
      const genParsed = parseJsonResponse(genRaw) as { probe_text: string };

      // Get probed forecast
      const probeMessages: ChatMessage[] = [
        { role: "system", content: PROBED_FORECAST_PROMPT },
        {
          role: "user",
          content: `Question: ${question}\n\nYour baseline estimate: ${forecast.probability}\n\nYour causal model:\nNodes: ${forecast.nodes.map((n) => `${n.id}: ${n.description}`).join("\n")}\nEdges: ${forecast.edges.map((e) => `${e.from} → ${e.to}: ${e.mechanism}`).join("\n")}\n\nNew information:\n${genParsed.probe_text}\n\nUpdate your probability:`,
        },
      ];

      const probeRaw = await callOpenRouter(probeMessages, {
        model,
        apiKey,
        jsonMode: true,
        temperature: 0.3,
        maxTokens: 1024,
      });
      const probeParsed = parseJsonResponse(probeRaw) as {
        updated_probability: number;
        shift_direction: string;
        reasoning: string;
      };

      const updatedProb = Math.max(0.01, Math.min(0.99, probeParsed.updated_probability));
      const absoluteShift = Math.abs(updatedProb - forecast.probability);

      probeResults.push({
        probe_type: target.probe_type,
        target_reason_id: null,
        probe_text: genParsed.probe_text,
        probe_generated: true,
        success: true,
        updated_probability: updatedProb,
        absolute_shift: absoluteShift,
        shift_direction: probeParsed.shift_direction,
        reasoning: probeParsed.reasoning,
        raw_response: probeRaw,
        target_id: target.target_id,
        target_type: target.target_type,
        target_importance: target.importance,
        target_centrality_rank: target.centrality_rank,
        target_on_critical_path: target.on_critical_path,
        probe_category:
          target.probe_type.startsWith("node")
            ? "node"
            : target.probe_type.startsWith("edge")
              ? "edge"
              : target.probe_type === "irrelevant"
                ? "control"
                : "structural",
      });
      onProgress?.({ stage: "Running probes...", current: probeIdx + 1, total: probeTotal });
    } catch (err) {
      probeResults.push({
        probe_type: target.probe_type,
        target_reason_id: null,
        probe_text: "",
        probe_generated: false,
        success: false,
        updated_probability: null,
        absolute_shift: null,
        shift_direction: "unchanged",
        reasoning: `Error: ${err instanceof Error ? err.message : "unknown"}`,
        raw_response: "",
        target_id: target.target_id,
        target_type: target.target_type,
        target_importance: target.importance,
        target_centrality_rank: target.centrality_rank,
        target_on_critical_path: target.on_critical_path,
        probe_category:
          target.probe_type.startsWith("node")
            ? "node"
            : target.probe_type.startsWith("edge")
              ? "edge"
              : target.probe_type === "irrelevant"
                ? "control"
                : "structural",
      });
      onProgress?.({ stage: "Running probes...", current: probeIdx + 1, total: probeTotal });
    }
  }

  // Step 4: Epistemic uncertainty rating per factor
  onProgress?.({ stage: "Rating epistemic uncertainty..." });
  const factorNodes = forecast.nodes.filter((n: { role: string }) => n.role !== "outcome");
  const nodeList = factorNodes
    .map((n: { id: string; description: string }) => `- ${n.id}: ${n.description}`)
    .join("\n");
  const networkDesc = forecast.edges
    .map((e: { from: string; to: string; mechanism: string }) => `  ${e.from} -> ${e.to}: ${e.mechanism}`)
    .join("\n");

  const uncertaintyPrompt = `You previously forecasted the following question and built a causal network.

Question: "${question}"
Your probability estimate: ${forecast.probability}

Your causal factors:
${nodeList}

Your causal network:
${networkDesc}

For each factor, rate your EPISTEMIC CONFIDENCE (how certain you are about the current state/value of this factor) on a scale of 1-5:

1 = Very uncertain: you have little reliable information about this factor
2 = Somewhat uncertain: limited or conflicting information available
3 = Moderate: reasonable information but significant gaps remain
4 = Fairly confident: good information available, minor uncertainties
5 = Very confident: well-established, highly reliable information

Respond with ONLY valid JSON: {"ratings": [{"factor_id": "...", "confidence": <1-5>, "reason": "<brief reason>"}]}`;

  let epistemicRatings: Array<{
    factor_id: string;
    confidence: number;
    reason: string;
    betweenness: number;
    value_of_information: number;
  }> = [];

  try {
    const uncertMessages: ChatMessage[] = [
      { role: "system", content: "You are rating your own epistemic uncertainty about causal factors. Be honest about what you don't know." },
      { role: "user", content: uncertaintyPrompt },
    ];
    const uncertRaw = await callOpenRouter(uncertMessages, { model, apiKey, jsonMode: true });
    const uncertParsed = JSON.parse(
      uncertRaw.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
    );

    if (uncertParsed.ratings && Array.isArray(uncertParsed.ratings)) {
      // Compute value of information: high importance + low confidence = high VOI
      const maxBetweenness = Math.max(
        ...nodeMetrics.map((n) => n.betweenness),
        0.001
      );
      epistemicRatings = uncertParsed.ratings.map(
        (r: { factor_id: string; confidence: number; reason: string }) => {
          const node = nodeMetrics.find((n) => n.node_id === r.factor_id);
          const betweenness = node?.betweenness ?? 0;
          const normImportance = betweenness / maxBetweenness;
          const uncertainty = (5 - r.confidence) / 4; // normalize to 0-1
          const voi = normImportance * uncertainty;
          return {
            factor_id: r.factor_id,
            confidence: r.confidence,
            reason: r.reason,
            betweenness,
            value_of_information: Math.round(voi * 1000) / 1000,
          };
        }
      );
      // Sort by VOI descending
      epistemicRatings.sort((a, b) => b.value_of_information - a.value_of_information);
    }
  } catch {
    // Non-critical — continue without ratings
  }

  // Compute aggregate metrics
  onProgress?.({ stage: "Computing metrics..." });
  const successful = probeResults.filter(
    (r) => r.success && r.absolute_shift != null
  );
  // SSR: high-importance vs low-importance probes (matches analysis_causal.py)
  const HIGH_TYPES = new Set([
    "node_negate_high", "node_strengthen",
    "edge_negate_critical", "edge_strengthen_critical",
  ]);
  const LOW_TYPES = new Set([
    "node_negate_low", "node_strengthen_low",
    "edge_negate_peripheral", "edge_strengthen_peripheral",
    "irrelevant",
  ]);
  const ALL_NEGATE = new Set([
    "node_negate_high", "node_negate_medium", "node_negate_low",
    "edge_negate_critical", "edge_negate_peripheral",
  ]);
  const ALL_STRENGTHEN = new Set([
    "node_strengthen", "node_strengthen_medium", "node_strengthen_low",
    "edge_strengthen_critical", "edge_strengthen_peripheral",
  ]);

  const highShifts = successful
    .filter((r) => HIGH_TYPES.has(r.probe_type))
    .map((r) => r.absolute_shift!);
  const lowShifts = successful
    .filter((r) => LOW_TYPES.has(r.probe_type))
    .map((r) => r.absolute_shift!);

  const controlShifts = successful
    .filter((r) => r.probe_type === "irrelevant")
    .map((r) => r.absolute_shift!);
  const meanHigh =
    highShifts.length > 0 ? highShifts.reduce((a, b) => a + b, 0) / highShifts.length : 0;
  const meanLow =
    lowShifts.length > 0 ? lowShifts.reduce((a, b) => a + b, 0) / lowShifts.length : 0;

  const negateShifts = successful
    .filter((r) => ALL_NEGATE.has(r.probe_type))
    .map((r) => r.absolute_shift!);
  const strengthenShifts = successful
    .filter((r) => ALL_STRENGTHEN.has(r.probe_type))
    .map((r) => r.absolute_shift!);
  const meanNeg =
    negateShifts.length > 0 ? negateShifts.reduce((a, b) => a + b, 0) / negateShifts.length : 0;
  const meanStr =
    strengthenShifts.length > 0
      ? strengthenShifts.reduce((a, b) => a + b, 0) / strengthenShifts.length
      : 0;

  const spurious = successful.filter(
    (r) => r.probe_type === "edge_spurious" || r.probe_type === "missing_node"
  );
  const accepted = spurious.filter((r) => r.absolute_shift! >= 0.05);

  const onPath = successful
    .filter((r) => r.target_on_critical_path)
    .map((r) => r.absolute_shift!);
  const offPath = successful
    .filter((r) => !r.target_on_critical_path)
    .map((r) => r.absolute_shift!);
  const meanOn = onPath.length > 0 ? onPath.reduce((a, b) => a + b, 0) / onPath.length : 0;
  const meanOff = offPath.length > 0 ? offPath.reduce((a, b) => a + b, 0) / offPath.length : 0;

  const allShifts = successful.map((r) => r.absolute_shift!);
  const meanShift =
    allShifts.length > 0 ? allShifts.reduce((a, b) => a + b, 0) / allShifts.length : 0;

  return {
    question_id: `live_${Date.now()}`,
    question_text: question,
    source: "live",
    initial_probability: forecast.probability,
    nodes: forecast.nodes,
    edges: forecast.edges,
    reasoning: forecast.reasoning,
    network_analysis: {
      n_nodes: stats.n_nodes,
      n_edges: stats.n_edges,
      density: stats.density,
      is_dag: stats.is_dag,
      n_weakly_connected: 1,
      n_strongly_connected: 1,
      outcome_node: stats.outcome_node,
      node_metrics: nodeMetrics,
      edge_metrics: edgeMetrics,
      probe_targets: probeTargets,
    },
    probe_targets: probeTargets,
    probes: probeTargets.map((t) => ({
      probe_text: probeResults.find((r) => r.target_id === t.target_id)?.probe_text ?? "",
      probe_type: t.probe_type,
      target_id: t.target_id,
      generated: true,
      target_type: t.target_type,
      importance: t.importance,
      centrality_rank: t.centrality_rank,
      on_critical_path: t.on_critical_path,
      description: t.description,
    })),
    condition: "live",
    probe_results: probeResults,
    epistemic_ratings: epistemicRatings,
    summary: {
      question_id: `live_${Date.now()}`,
      question_text: question,
      source: "live",
      condition: "live",
      initial_probability: forecast.probability,
      n_probes: probeResults.length,
      n_successful: successful.length,
      mean_absolute_shift: meanShift || null,
      max_absolute_shift: allShifts.length > 0 ? Math.max(...allShifts) : null,
    },
    aggregate_metrics: {
      ssr: meanLow > 0 ? meanHigh / meanLow : null,
      mean_shift_high: meanHigh,
      mean_shift_low: meanLow,
      asymmetry_index: meanStr > 0 ? meanNeg / meanStr : null,
      mean_shift_negate: meanNeg,
      mean_shift_strengthen: meanStr,
      fnar: spurious.length > 0 ? accepted.length / spurious.length : null,
      n_accepted: accepted.length,
      n_spurious: spurious.length,
      critical_path_premium:
        onPath.length > 0 && offPath.length > 0 ? meanOn - meanOff : null,
      mean_shift_on_path: meanOn,
      mean_shift_off_path: meanOff,
      control_sensitivity:
        controlShifts.length > 0
          ? controlShifts.filter((s) => s > 0.05).length / controlShifts.length
          : null,
      importance_sensitivity_correlation: (() => {
        const pairs = successful
          .filter((r) => r.target_importance > 0 && r.absolute_shift != null)
          .map((r) => ({ imp: r.target_importance, shift: r.absolute_shift! }));
        if (pairs.length < 3) return null;
        const rank = (arr: number[]) => {
          const sorted = [...arr].sort((a, b) => a - b);
          return arr.map((v) => sorted.indexOf(v) + 1);
        };
        const impRanks = rank(pairs.map((p) => p.imp));
        const shiftRanks = rank(pairs.map((p) => p.shift));
        const n = pairs.length;
        const dSq = impRanks.reduce((sum, r, i) => sum + (r - shiftRanks[i]) ** 2, 0);
        return 1 - (6 * dSq) / (n * (n * n - 1));
      })()
    },
  };
}

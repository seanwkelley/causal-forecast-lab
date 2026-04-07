import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter, parseJsonResponse, type ChatMessage } from "@/lib/openrouter";

export const maxDuration = 60;

const PROBED_FORECAST_PROMPT = `You are an expert forecaster updating your estimate in light of new information about your causal model.

When presented with new information, consider how it affects your causal network and update your probability estimate accordingly.

Respond with JSON: {"updated_probability": <0.01-0.99>, "shift_direction": "increased"|"decreased"|"unchanged", "reasoning": "explanation of how this new information affects your estimate"}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      question,
      initial_probability,
      reasoning,
      nodes,
      edges,
      probe_text,
      target_id,
      target_type,
      model,
      api_key,
    } = body;

    if (!question || !probe_text) {
      return NextResponse.json(
        { error: "question and probe_text are required" },
        { status: 400 }
      );
    }

    const apiKey = api_key || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key provided" },
        { status: 400 }
      );
    }

    const selectedModel = model || "meta-llama/llama-3.3-70b-instruct";

    // Build the network description
    const nodeDesc = (nodes || [])
      .map((n: { id: string; description: string }) => `  ${n.id}: ${n.description}`)
      .join("\n");
    const edgeDesc = (edges || [])
      .map((e: { from: string; to: string; mechanism: string }) => `  ${e.from} → ${e.to}: ${e.mechanism}`)
      .join("\n");

    const targetInfo = target_id
      ? `\n\nThis information specifically challenges: ${target_type || "element"} "${target_id}"`
      : "";

    const messages: ChatMessage[] = [
      { role: "system", content: PROBED_FORECAST_PROMPT },
      {
        role: "user",
        content: `Question: ${question}

Your baseline probability estimate: ${initial_probability}

Your causal model:
Nodes:
${nodeDesc}

Edges:
${edgeDesc}

Your reasoning: ${reasoning}
${targetInfo}

New information to consider:
${probe_text}

Update your probability estimate:`,
      },
    ];

    const raw = await callOpenRouter(messages, {
      model: selectedModel,
      apiKey,
      jsonMode: true,
      temperature: 0.3,
      maxTokens: 1024,
    });

    const parsed = parseJsonResponse(raw) as {
      updated_probability: number;
      shift_direction: string;
      reasoning: string;
    };

    // Clamp probability
    parsed.updated_probability = Math.max(
      0.01,
      Math.min(0.99, parsed.updated_probability)
    );

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Probe error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

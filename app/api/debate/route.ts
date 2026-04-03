import { NextRequest, NextResponse } from "next/server";
import { runDebateRound } from "@/lib/debate-pipeline";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      question,
      roundNum,
      modelAId,
      modelBId,
      apiKey,
      stateA,
      stateB,
      probeEvidenceA,
      probeEvidenceB,
      previousCritiqueOfA,
      previousCritiqueOfB,
    } = body;

    if (!question || !modelAId || !modelBId || !apiKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const round = await runDebateRound(
      question,
      roundNum || 1,
      modelAId,
      modelBId,
      apiKey,
      stateA,
      stateB,
      probeEvidenceA || [],
      probeEvidenceB || [],
      previousCritiqueOfA,
      previousCritiqueOfB
    );

    return NextResponse.json(round);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

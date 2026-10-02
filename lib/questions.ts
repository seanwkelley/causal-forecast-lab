// Shapes of public/data/summary.json and small helpers for question metadata.

export interface QuestionEntry {
  question_id: string;
  question_text: string;
  source: string;
  category?: string;
  market_probability?: number | null;
  models?: string[];
  model_probabilities?: Record<string, number>;
  model_ssr?: Record<string, number | null>;
  model_mean_shift?: Record<string, number | null>;
}

export interface SummaryModelInfo {
  label: string;
  total_questions: number;
  avg_ssr: number | null;
  avg_mean_shift?: number;
}

export interface SummaryData {
  total_questions: number;
  models?: Record<string, SummaryModelInfo>;
  default_model?: string;
  questions: QuestionEntry[];
}

export const TOPIC_ORDER = [
  "Conflict & Security",
  "Politics & Governance",
  "Finance & Economics",
  "Climate & Energy",
  "Health & Science",
  "Technology",
  "Society & Culture",
  "Other",
];

const SOURCE_LABEL: Record<string, string> = {
  metaculus: "Metaculus",
  manifold: "Manifold",
  polymarket: "Polymarket",
  infer: "INFER",
  acled: "ACLED",
  wikipedia: "Wikipedia",
  live: "Your question",
};

/** Sources whose stored value is a market or crowd forecast (not a data series). */
const MARKET_SOURCES = new Set(["metaculus", "manifold", "polymarket", "infer"]);

export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

export function marketForecast(q: Pick<QuestionEntry, "source" | "market_probability">): number | null {
  if (!MARKET_SOURCES.has(q.source)) return null;
  const p = q.market_probability;
  return typeof p === "number" && p >= 0 && p <= 1 ? p : null;
}

/** Spread between the highest and lowest model forecast. */
export function modelSpread(q: QuestionEntry): number | null {
  const ps = Object.values(q.model_probabilities ?? {});
  if (ps.length < 2) return null;
  return Math.max(...ps) - Math.min(...ps);
}

let summaryPromise: Promise<SummaryData> | null = null;

/** Fetch summary.json once per page load. */
export function loadSummary(): Promise<SummaryData> {
  if (!summaryPromise) {
    summaryPromise = fetch("/data/summary.json").then((r) => {
      if (!r.ok) throw new Error(`summary.json: HTTP ${r.status}`);
      return r.json();
    });
    summaryPromise.catch(() => {
      summaryPromise = null;
    });
  }
  return summaryPromise;
}

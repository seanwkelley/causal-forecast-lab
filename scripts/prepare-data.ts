/**
 * Prepares pre-computed sensitivity data for the Next.js app.
 *
 * Reads per-question JSON files from ALL model output directories and produces:
 *   - public/data/summary.json  (cross-question index + per-model stats)
 *   - public/data/questions/{model}/{id}.json (per-question detail with derived metrics)
 *
 * Usage: npx tsx scripts/prepare-data.ts
 */

import * as fs from "fs";
import * as path from "path";

// ------------------------------------------------------------------
// Types (mirror lib/types.ts but for Node — keep in sync manually)
// ------------------------------------------------------------------

interface ProbeResult {
  probe_type: string;
  target_id: string;
  target_type: string;
  target_importance: number;
  target_on_critical_path: boolean;
  probe_category: string;
  absolute_shift: number | null;
  updated_probability: number | null;
  shift_direction: string;
  success: boolean;
  reasoning: string;
  probe_text: string;
  probe_generated: boolean;
  target_centrality_rank: number;
  target_reason_id: string | null;
  raw_response: string;
}

interface QuestionJSON {
  question_id: string;
  question_text: string;
  source: string;
  initial_probability: number;
  nodes: { id: string; description: string; role: string }[];
  edges: { from: string; to: string; mechanism: string }[];
  reasoning: string;
  network_analysis: {
    n_nodes: number;
    n_edges: number;
    density: number;
    is_dag: boolean;
    n_weakly_connected: number;
    n_strongly_connected: number;
    outcome_node: string;
    node_metrics: unknown[];
    edge_metrics: unknown[];
    probe_targets: unknown[];
  };
  probe_targets: unknown[];
  probes: unknown[];
  condition: string;
  probe_results: ProbeResult[];
  summary: {
    question_id: string;
    question_text: string;
    source: string;
    condition: string;
    initial_probability: number;
    n_probes: number;
    n_successful: number;
    mean_absolute_shift: number | null;
    max_absolute_shift: number | null;
  };
}

// ------------------------------------------------------------------
// Model directories
// ------------------------------------------------------------------

const CAUSAL_BASE = path.resolve(__dirname, "../../outputs/sensitivity/causal");

const MODELS: Record<string, { dir: string; label: string }> = {
  "llama-8b": { dir: "llama_neutral", label: "Llama 3.1 8B" },
  "llama-70b": { dir: "llama_70b_neutral", label: "Llama 3.3 70B" },
  "deepseek-v3": { dir: "deepseek_neutral", label: "DeepSeek V3" },
  "qwen-235b": { dir: "qwen_neutral", label: "Qwen3 235B" },
  "gemini-flash": { dir: "gemini_fl_neutral", label: "Gemini 2.5 Flash Lite" },
  "gpt-oss": { dir: "gpt_oss_neutral", label: "GPT-OSS 120B" },
  "qwen-32b": { dir: "qwen_32b_neutral", label: "Qwen3 32B" },
};

// ------------------------------------------------------------------
// Market probabilities from ForecastBench
// ------------------------------------------------------------------

function loadMarketProbabilities(): Record<string, number> {
  const fbPath = path.resolve(__dirname, "../../forecast_bench/forecastbench_questions.json");
  if (!fs.existsSync(fbPath)) {
    console.log("  ForecastBench data not found, skipping market probabilities");
    return {};
  }
  const fb = JSON.parse(fs.readFileSync(fbPath, "utf-8"));
  const market: Record<string, number> = {};
  for (const q of fb.questions) {
    const val = q.freeze_datetime_value;
    if (val != null) {
      const num = Number(val);
      if (!isNaN(num) && num >= 0 && num <= 1) {
        market[q.id] = num;
      }
    }
  }
  return market;
}

// ------------------------------------------------------------------
// Metric computation (matches analysis_causal.py)
// ------------------------------------------------------------------

// SSR sets: high vs low importance (node + edge)
const HIGH_TYPES = new Set([
  "node_negate_high", "node_strengthen",
  "edge_negate_critical", "edge_strengthen_critical",
]);
const LOW_TYPES = new Set([
  "node_negate_low", "node_strengthen_low",
  "edge_negate_peripheral", "edge_strengthen_peripheral",
]);

// Negate vs strengthen (matched importance levels)
const ALL_NEGATE_TYPES = new Set([
  "node_negate_high",
  "node_negate_medium",
  "node_negate_low",
  "edge_negate_critical",
  "edge_negate_peripheral",
]);
const ALL_STRENGTHEN_TYPES = new Set([
  "node_strengthen",
  "node_strengthen_medium",
  "node_strengthen_low",
  "edge_strengthen_critical",
  "edge_strengthen_peripheral",
]);

function computeMetrics(results: ProbeResult[]) {
  const successful = results.filter(
    (r) => r.success && r.absolute_shift != null
  );

  // SSR: high-importance vs low-importance probes (matches paper)
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
    highShifts.length > 0
      ? highShifts.reduce((a, b) => a + b, 0) / highShifts.length
      : 0;
  const meanLow =
    lowShifts.length > 0
      ? lowShifts.reduce((a, b) => a + b, 0) / lowShifts.length
      : 0;
  const ssr = meanLow > 0 ? meanHigh / meanLow : null;

  // Asymmetry: all negate vs all strengthen (matched importance levels)
  const negateShifts = successful
    .filter((r) => ALL_NEGATE_TYPES.has(r.probe_type))
    .map((r) => r.absolute_shift!);
  const strengthenShifts = successful
    .filter((r) => ALL_STRENGTHEN_TYPES.has(r.probe_type))
    .map((r) => r.absolute_shift!);

  const meanNeg =
    negateShifts.length > 0
      ? negateShifts.reduce((a, b) => a + b, 0) / negateShifts.length
      : 0;
  const meanStr =
    strengthenShifts.length > 0
      ? strengthenShifts.reduce((a, b) => a + b, 0) / strengthenShifts.length
      : 0;
  const asymmetry = meanStr > 0 ? meanNeg / meanStr : null;

  // FNAR
  const spurious = successful.filter(
    (r) =>
      r.probe_type === "edge_spurious" || r.probe_type === "missing_node"
  );
  const accepted = spurious.filter((r) => r.absolute_shift! >= 0.05);
  const fnar = spurious.length > 0 ? accepted.length / spurious.length : null;

  // Critical path premium
  const onPath = successful
    .filter((r) => r.target_on_critical_path)
    .map((r) => r.absolute_shift!);
  const offPath = successful
    .filter((r) => !r.target_on_critical_path)
    .map((r) => r.absolute_shift!);

  const meanOn =
    onPath.length > 0
      ? onPath.reduce((a, b) => a + b, 0) / onPath.length
      : 0;
  const meanOff =
    offPath.length > 0
      ? offPath.reduce((a, b) => a + b, 0) / offPath.length
      : 0;
  const premium =
    onPath.length > 0 && offPath.length > 0 ? meanOn - meanOff : null;

  // Importance-sensitivity correlation (Spearman)
  const pairs = successful
    .filter((r) => r.target_importance > 0)
    .map((r) => ({
      importance: r.target_importance,
      shift: r.absolute_shift!,
    }));

  let correlation: number | null = null;
  if (pairs.length >= 3) {
    const rank = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      return arr.map((v) => sorted.indexOf(v) + 1);
    };
    const impRanks = rank(pairs.map((p) => p.importance));
    const shiftRanks = rank(pairs.map((p) => p.shift));
    const n = pairs.length;
    const dSq = impRanks.reduce(
      (sum, r, i) => sum + (r - shiftRanks[i]) ** 2,
      0
    );
    correlation = 1 - (6 * dSq) / (n * (n * n - 1));
  }

  // Control sensitivity: fraction of irrelevant probes with |shift| > 0.05
  const controlAboveThreshold = controlShifts.filter((s) => s > 0.05).length;
  const controlSensitivity =
    controlShifts.length > 0
      ? controlAboveThreshold / controlShifts.length
      : null;

  return {
    ssr,
    mean_shift_high: meanHigh,
    mean_shift_low: meanLow,
    asymmetry_index: asymmetry,
    mean_shift_negate: meanNeg,
    mean_shift_strengthen: meanStr,
    fnar,
    n_accepted: accepted.length,
    n_spurious: spurious.length,
    critical_path_premium: premium,
    mean_shift_on_path: meanOn,
    mean_shift_off_path: meanOff,
    importance_sensitivity_correlation: correlation,
    control_sensitivity: controlSensitivity,
  };
}

// ------------------------------------------------------------------
// Topic classification
// ------------------------------------------------------------------

function classifyTopic(questionText: string, source: string): string {
  const t = questionText.toLowerCase();
  const s = source.toLowerCase();

  // Source-based shortcuts
  if (s === "yfinance") return "Finance & Markets";
  if (s === "fred") return "Economics";
  if (s === "acled") return "Conflict & Security";
  if (s === "dbnomics" && t.includes("temperature")) return "Climate & Energy";
  if (s === "dbnomics") return "Economics";

  // Keyword-based classification
  if (/\b(nato|war|military|troops|conflict|invasion|attack|weapon|nuclear|missile|army|defense|violen|invade|uprising|ceasefire|capture|combat|carrier|forces|deploy|control.*taiwan)/i.test(t))
    return "Conflict & Security";
  if (/\b(protest|refugee|migration|humanitarian|human rights|sanction|khamenei|supreme leader|impeach|sudan|rapid support)/i.test(t))
    return "Conflict & Security";
  if (/\b(strikes?\s+\w+\s+by\s+december|engagement\s+by)/i.test(t))
    return "Conflict & Security";
  if (/\b(election|president|congress|senate|governor|vote|poll|party|democrat|republican|parliament|minister|trump|nominate|fed chair)/i.test(t))
    return "Politics & Governance";
  if (/\b(fertility|birth rate|ubi|universal basic income|immigration|breakaway.*league)/i.test(t))
    return "Politics & Governance";
  if (/\b(usmca|staffing standard|export control|coalition of the willing|multilateral.*agreement|classify.*research|european.*commit)/i.test(t))
    return "Politics & Governance";
  if (/\b(stock|market|price|bitcoin|crypto|s&p|nasdaq|yield|bond|index|trading|investor|tesla|ceo|step down)/i.test(t))
    return "Finance & Markets";
  if (/\b(gdp|inflation|unemployment|interest rate|federal reserve|import|export|tariff|trade|econom|recession)/i.test(t))
    return "Economics";
  if (/\b(temperature|climate|weather|hurricane|flood|drought|emission|carbon|solar power|renewable|energy consumption|electric vehicle|electric.*car|electric\b.*\bsold)/i.test(t))
    return "Climate & Energy";
  if (/\b(vaccine|virus|disease|health|medical|fda|drug|pharma|pandemic|cancer|treatment|diagnosis|dna|embryo|brain emulation|roundup|newborn|hiv|aids|influenza|avian|extinct|mirror.*biology)/i.test(t))
    return "Health & Science";
  if (/\b(ai\b|artificial intelligence|agi|machine learning|openai|google|apple|microsoft|tech|software|browser|chromium|driverless|robot|digital intelligence|lithograph|fab\b|semiconductor|compute|satellite|huawei|open ran)/i.test(t))
    return "Technology";
  if (/\b(wikipedia|fide|ranking|chess|oscar|academy|award|sport|champion|tournament|world cup|olympic|nba|nascar|nfl|box office|film|movie|pokemon|agent 007|drake|colbert|embiid|soccer|league|mlb|baseball|anime)/i.test(t))
    return "Society & Culture";
  if (/\b(research fund|ngo|non-governmental)/i.test(t))
    return "Politics & Governance";

  return "Other";
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------

function main() {
  const outputBase = path.resolve(__dirname, "../public/data");
  console.log(`Output to: ${outputBase}`);

  const marketProbs = loadMarketProbabilities();
  console.log(`Loaded ${Object.keys(marketProbs).length} market probabilities`);

  // Track all questions across models for the summary
  const allQuestionIds = new Set<string>();
  const modelSummaries: Record<
    string,
    {
      label: string;
      total_questions: number;
      avg_ssr: number | null;
      avg_mean_shift: number;
      question_ids: string[];
    }
  > = {};

  // Global question index (union across models)
  const questionIndex: Record<
    string,
    {
      question_id: string;
      question_text: string;
      source: string;
      category: string;
      market_probability: number | null;
      models: string[]; // which models have data for this question
      // Per-model probabilities and metrics for cross-model comparison
      model_probabilities: Record<string, number>;
      model_ssr: Record<string, number | null>;
      model_mean_shift: Record<string, number | null>;
    }
  > = {};

  for (const [modelKey, modelInfo] of Object.entries(MODELS)) {
    const inputDir = path.join(
      CAUSAL_BASE,
      modelInfo.dir,
      "question_results"
    );

    if (!fs.existsSync(inputDir)) {
      console.log(`\nSkipping ${modelKey}: ${inputDir} not found`);
      continue;
    }

    const modelQuestionsDir = path.join(outputBase, "questions", modelKey);
    fs.mkdirSync(modelQuestionsDir, { recursive: true });

    const files = fs
      .readdirSync(inputDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(inputDir, f));

    console.log(`\n--- ${modelInfo.label} (${modelKey}) ---`);
    console.log(`  Reading from: ${inputDir}`);
    console.log(`  Found ${files.length} question files`);

    let totalSSR = 0;
    let ssrCount = 0;
    let totalMeanShift = 0;
    let shiftCount = 0;
    const questionIds: string[] = [];

    for (const file of files) {
      try {
        const raw = fs.readFileSync(file, "utf-8");
        const q: QuestionJSON = JSON.parse(raw);

        if (!q.probe_results || q.probe_results.length === 0) {
          continue;
        }

        const metrics = computeMetrics(q.probe_results);

        // Try matching with and without q_ prefix
        const mktProb = marketProbs[q.question_id]
          ?? (q.question_id.startsWith("q_") ? marketProbs[q.question_id.slice(2)] : null)
          ?? null;

        const detail = {
          ...q,
          model: modelKey,
          model_label: modelInfo.label,
          market_probability: mktProb,
          aggregate_metrics: metrics,
        };

        const detailPath = path.join(
          modelQuestionsDir,
          `${q.question_id}.json`
        );
        fs.writeFileSync(detailPath, JSON.stringify(detail, null, 2));

        questionIds.push(q.question_id);
        allQuestionIds.add(q.question_id);

        // Build global index
        if (!questionIndex[q.question_id]) {
          questionIndex[q.question_id] = {
            question_id: q.question_id,
            question_text: q.question_text,
            source: q.source,
            category: classifyTopic(q.question_text, q.source),
            market_probability: mktProb,
            models: [],
            model_probabilities: {},
            model_ssr: {},
            model_mean_shift: {},
          };
        }
        questionIndex[q.question_id].models.push(modelKey);
        questionIndex[q.question_id].model_probabilities[modelKey] = q.initial_probability;
        questionIndex[q.question_id].model_ssr[modelKey] = metrics.ssr;
        questionIndex[q.question_id].model_mean_shift[modelKey] = q.summary?.mean_absolute_shift ?? null;

        if (metrics.ssr != null) {
          totalSSR += metrics.ssr;
          ssrCount++;
        }
        if (q.summary?.mean_absolute_shift != null) {
          totalMeanShift += q.summary.mean_absolute_shift;
          shiftCount++;
        }
      } catch (err) {
        console.error(`  Error processing ${file}:`, err);
      }
    }

    modelSummaries[modelKey] = {
      label: modelInfo.label,
      total_questions: questionIds.length,
      avg_ssr: ssrCount > 0 ? totalSSR / ssrCount : null,
      avg_mean_shift: shiftCount > 0 ? totalMeanShift / shiftCount : 0,
      question_ids: questionIds,
    };

    console.log(
      `  Processed: ${questionIds.length} questions, Avg SSR: ${modelSummaries[modelKey].avg_ssr?.toFixed(2) ?? "N/A"}`
    );
  }

  // Write summary
  const summary = {
    total_questions: allQuestionIds.size,
    models: modelSummaries,
    default_model: "llama-70b",
    questions: Object.values(questionIndex),
  };

  const summaryPath = path.join(outputBase, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`\nDone!`);
  console.log(`  Total unique questions: ${allQuestionIds.size}`);
  console.log(
    `  Models: ${Object.keys(modelSummaries).join(", ")}`
  );
  console.log(`  Summary: ${summaryPath}`);
}

main();

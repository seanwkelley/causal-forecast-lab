// Single source of truth for model names and OpenRouter IDs.

export interface ModelInfo {
  /** Key used in public/data/questions/{key}/ */
  key: string;
  label: string;
  /** Compact label for tight spaces (chips, strip tooltips) */
  short: string;
  openrouter: string;
}

/** The seven models evaluated in the paper, ordered by family then size. */
export const PAPER_MODELS: ModelInfo[] = [
  { key: "llama-8b", label: "Llama 3.1 8B", short: "Llama 8B", openrouter: "meta-llama/llama-3.1-8b-instruct" },
  { key: "llama-70b", label: "Llama 3.3 70B", short: "Llama 70B", openrouter: "meta-llama/llama-3.3-70b-instruct" },
  { key: "qwen-32b", label: "Qwen3 32B", short: "Qwen 32B", openrouter: "qwen/qwen3-32b" },
  { key: "qwen-235b", label: "Qwen3 235B", short: "Qwen 235B", openrouter: "qwen/qwen3-235b-a22b-2507" },
  { key: "deepseek-v3", label: "DeepSeek V3", short: "DeepSeek V3", openrouter: "deepseek/deepseek-chat-v3-0324" },
  { key: "gemini-flash", label: "Gemini 2.5 Flash Lite", short: "Gemini FL", openrouter: "google/gemini-2.5-flash-lite" },
  { key: "gpt-oss", label: "GPT-OSS 120B", short: "GPT-OSS", openrouter: "openai/gpt-oss-120b" },
];

/** Additional models offered in live mode (not part of the paper). */
export const OTHER_LIVE_MODELS: Array<Pick<ModelInfo, "label" | "openrouter">> = [
  { label: "Claude Sonnet 4.6", openrouter: "anthropic/claude-sonnet-4.6" },
  { label: "GPT-4o", openrouter: "openai/gpt-4o" },
  { label: "Gemini 2.5 Flash", openrouter: "google/gemini-2.5-flash" },
  { label: "Mistral Large 3", openrouter: "mistralai/mistral-large-2512" },
];

export const DEFAULT_MODEL_KEY = "llama-70b";

const byKey = new Map(PAPER_MODELS.map((m) => [m.key, m]));
const byOpenRouter = new Map<string, string>([
  ...PAPER_MODELS.map((m) => [m.openrouter, m.label] as [string, string]),
  ...OTHER_LIVE_MODELS.map((m) => [m.openrouter, m.label] as [string, string]),
]);

export function getModel(key: string): ModelInfo | undefined {
  return byKey.get(key);
}

export function modelLabel(key: string): string {
  return byKey.get(key)?.label ?? key;
}

export function modelShort(key: string): string {
  return byKey.get(key)?.short ?? key;
}

/** Human label for an OpenRouter model ID, falling back to the ID's last segment. */
export function openRouterLabel(id: string): string {
  return byOpenRouter.get(id) ?? id.split("/").pop() ?? id;
}

/** Sort model keys into paper order; unknown keys go last. */
export function sortModelKeys(keys: string[]): string[] {
  const order = new Map(PAPER_MODELS.map((m, i) => [m.key, i]));
  return [...keys].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
}

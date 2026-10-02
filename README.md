# Causal Forecast Lab

Interactive web app for exploring how sensitive LLM probability forecasts are to their own elicited causal models. Companion to the *Probing Belief Sensitivity in LLM Forecasters* paper (target: EMNLP 2026).

**Live demo:** deployed via Vercel
**Paper code & data:** [github.com/seanwkelley/LLM_Forecasting](https://github.com/seanwkelley/LLM_Forecasting)

---

## What it does

Given a binary forecasting question, the lab runs a four-stage pipeline:

1. **Causal Forecast** — An LLM produces an initial probability and a causal DAG (factor nodes + directed edges with mechanisms)
2. **Network Analysis** — Pure computation: betweenness centrality, outcome mediation, shortest-path membership. No LLM.
3. **Probe Generation** — The LLM writes targeted natural-language counterfactuals for ~21 selected nodes and edges (14 probe types: node negate/strengthen at 3 importance tiers, edge negate/strengthen for shortest-path/peripheral, edge reverse, edge structural, missing node, irrelevant control)
4. **Probed Forecast** — Each probe is presented in a fresh single-turn conversation; the model re-estimates the probability

The key DV is the **absolute log-odds shift** |Δlogit| from initial to probed estimate, which the lab visualizes per probe and aggregates into per-question metrics.

---

## Modes

### Home

Opens with a real example (Qwen3 235B on US unemployment) comparing a central-factor probe, a peripheral one, and an irrelevant control, followed by a ~40-second animated walkthrough of the method (`components/method-video.tsx`) with chapters, captions and a transcript. Both are drawn from `public/data` at build time.

### Questions (pre-computed results)

Browse the 116 high-complexity ForecastBench questions × 7 models from the paper. The list shows every model's baseline forecast on one strip (with the market forecast where the source is a market), and can be sorted by model disagreement, average shift, or SSR. Each question page shows:
- **Forecasts by model:** all seven baseline forecasts plus the market forecast; pick a model to inspect
- **The model's causal network:** a layered layout in which causes flow into the outcome (left to right, or top to bottom when the network is deep). Factors can be shaded by betweenness, outcome mediation, or the forecast shift their probes produced. Cycles and factors with no path to the outcome are marked explicitly
- **Selection panel:** click a factor or link for its description, centrality, and the probes that targeted it, then write your own probe against it
- **What moved the forecast:** SSR, strengthen vs. negate, and control probes, each with the underlying averages
- **Probe ledger:** every probe grouped by the paper's four categories (strengthen, negate, structural challenge, control), with a forest-plot track from baseline to new forecast, the change in pp and in log-odds, and the probe text and model response on expand

### Run your own (live mode)

Enter any yes/no question, select 1–4 models, and run the full pipeline in real time via OpenRouter. Results use the same views as the question pages, with a side-by-side table and a tab per model.

### Multi-Model Debate (`debate-feature` branch)

Two models build their DAG and probe results independently, then conduct 5 rounds of structured critique using each other's probe evidence. Each round shows DAG revisions, updated probabilities, and a convergence line graph.

---

## Key Metrics

| Metric | Description |
|---|---|
| **Forecast shift** | Updated minus baseline probability, shown in pp and in log-odds (the paper's DV is the absolute log-odds shift). |
| **SSR** (structural sensitivity ratio) | Mean \|Δ\| from probes on central targets (two highest-betweenness factors, shortest-path links) ÷ mean \|Δ\| from probes on peripheral targets (lowest-betweenness factor, peripheral links). Above 1× means central targets moved the forecast more. |
| **Strengthen vs. negate** | Mean \|Δ\| from strengthen probes ÷ mean \|Δ\| from negate probes. |
| **Control probes** | Number of irrelevant-information probes that moved the forecast by more than 5pp. |

The paper's main statistical analysis (LME with topological predictors) is reported in the paper rather than the explorer.

---

## Models

### Paper models (7)

Llama 3.1 8B · Llama 3.3 70B · Qwen3 32B · Qwen3 235B · DeepSeek V3 · Gemini 2.5 Flash Lite · GPT-OSS 120B

### Additional live-mode models (via OpenRouter)

Claude Sonnet 4.6 · GPT-4o · Gemini 2.5 Flash · Mistral Large 3, plus any OpenRouter model ID. Model names and IDs live in `lib/models.ts`.

Live mode and custom probes need an OpenRouter API key, which is stored only in the browser. The API routes also accept a server-side `OPENROUTER_API_KEY`.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4 with light/dark design tokens in `app/globals.css`
- **Causal networks:** custom layered layout (`lib/graph-layout.ts`) rendered as SVG
- **Type:** Newsreader, IBM Plex Sans / Sans Condensed / Mono (via `next/font`)
- **LLM API:** OpenRouter

---

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Regenerate Explore data

`npm run prepare-data` reads per-question JSON files from `../outputs/sensitivity/causal/{model}/question_results/` (in the parent paper repo), computes per-question metrics, joins question topics from `../forecast_bench/high_complexity_questions.json`, and writes static JSON to `public/data/`.

```bash
npm run prepare-data
```

Topics on each question are assigned upstream by `forecast_bench/classify_question_topic.py` (a GPT-4o-mini classifier into 7 categories: Conflict & Security, Politics & Governance, Finance & Economics, Climate & Energy, Health & Science, Technology, Society & Culture).

---

## Deployment

Optimized for Vercel:

```bash
npm run build
```

Set the `OPENROUTER_API_KEY` environment variable for the Live Mode server-side fallback.

---

## Citation

If you use this lab in research, please cite the paper:

```bibtex
@inproceedings{kelley2026belief,
  author    = {Kelley, Sean W. and Riedl, Christoph},
  title     = {Probing Belief Sensitivity in {LLM} Forecasters: Do Causal Structure and Importance Predict Belief Updates?},
  booktitle = {Proceedings of EMNLP 2026},
  year      = {2026},
  note      = {Under review}
}
```

---

## License

MIT

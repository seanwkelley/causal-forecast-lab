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

### Explore (pre-computed results)

Browse the 116 high-complexity ForecastBench questions × 7 models from the paper. Each question shows:
- The elicited causal DAG (D3 force-directed)
- All ~21 probes with their text, target, importance tier, and resulting shift
- Per-question metrics (SSR, asymmetry, control sensitivity)
- Cross-model comparison: same question across all 7 models side-by-side

### Live Mode

Enter any forecasting question, select 1–4 models, and run the full pipeline in real time via OpenRouter. Useful for testing arbitrary questions outside the ForecastBench set.

### Compare

Run the same question through two models side-by-side and compare their causal structures and sensitivity metrics.

### Multi-Model Debate (`debate-feature` branch)

Two models build their DAG and probe results independently, then conduct 5 rounds of structured critique using each other's probe evidence. Each round shows DAG revisions, updated probabilities, and a convergence line graph.

---

## Key Metrics

| Metric | Description |
|---|---|
| **SSR** (Structural Sensitivity Ratio) | Mean |Δ| from high-importance probes ÷ mean |Δ| from low-importance probes. SSR > 1 means the model updates more for structurally central elements. |
| **Asymmetry Index** | Mean |Δ| from negate probes ÷ mean |Δ| from strengthen probes at matched importance. |
| **Control Sensitivity** | Fraction of irrelevant control probes producing |Δ| > 5pp. Lower is better — high values indicate the model is swayed by topically related but logically irrelevant claims. |
| **Strengthen/Negate Ratio** | Per-direction shift asymmetry. |

The paper's main statistical analysis (LME with topological predictors) is reported in the paper rather than the explorer.

---

## Models

### Paper models (Explore mode, 7 total)

Llama 3.1 8B · Llama 3.3 70B · Qwen3 32B · Qwen3 235B · DeepSeek V3 · Gemini 2.5 Flash Lite · GPT-OSS 120B

### Live Mode (via OpenRouter)

Llama 3.3 70B · Qwen3 235B · DeepSeek V3 · Claude 3.5 Sonnet · GPT-4o · Gemini 2.0 Flash · Mistral Large

You can supply your own OpenRouter API key in Live Mode, or the deployed instance falls back to a server-side default.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4
- **Graph visualization:** D3.js (force-directed causal networks, frozen-layout for debate rounds)
- **Charts:** Recharts
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

# GEPA integration — offline email experiments

Inbound Desk uses the **real `gepa` Python package, pinned to 0.1.4**, with a custom adapter. It runs the application's actual classifier, deterministic writer and grounding guard on frozen evidence. GEPA is a development tool, not an extra enrichment API or a job on every incoming lead.

## What runs today

The default `library` mode uses GEPA's documented custom-proposer interface to test reviewed wording configurations. It makes **zero paid API requests and no network requests**. This is GEPA search over a bounded library; it is **not an LLM reflecting or inventing new prompts**.

The optional `ollama` mode asks an already installed local model to reflect on training feedback and select a configuration. It uses only `http://127.0.0.1:11434/api/chat`, rejects redirects and unapproved values, and never downloads a model or falls back to a cloud model. Transport/schema behavior is tested; a real local-model run has not been executed on this machine because none is installed. Local compute still has hardware/energy cost.

The two controlled parameters are closing-question style (`walkthrough`, `overview`, `conversation`) and subject style (`original`, `topic`). The app's classifier, factual opener, approved capability text, contact-specific questions, and citation checks are fixed. Free-form candidate text and executable code are rejected. The production default remains walkthrough/original until a separate reviewed change promotes another policy.

Example experiment, with the same factual opener and capability paragraph:

- Baseline: “Would a quick walkthrough of maintenance requests be useful?”
- Alternative: “Would a short overview of maintenance requests help?”
- Alternative: “Open to a brief conversation about maintenance requests?”

These are alternatives for a rep to judge, not proven improvements.

## Run it

Use Python 3.10–3.14 and Node.js 24. From the project directory:

```sh
python3 -m venv .venv-gepa
.venv-gepa/bin/python -m pip install -r scripts/gepa/requirements.txt
pnpm eval:golden
pnpm gepa
```

If Node is not on PATH, pass `--node /absolute/path/to/node` to `scripts/gepa/run.py`. The installed Python package has no required model-provider dependencies; do not install its `full` extra for this workflow.

For a local model that you have already installed and started:

```sh
.venv-gepa/bin/python scripts/gepa/run.py --mode ollama --model YOUR_LOCAL_MODEL
```

A run creates a fresh `.quality-reports/gepa-<timestamp>/` directory. Existing directories are rejected so an untrusted or stale pickled run cannot be resumed implicitly. The default is three proposals with a 200-case search budget. Use `--proposals 1` through `5`, `--max-evals` (at most 300), and `--seed` to control the experiment. The runner checks that the budget can cover every proposal: three require at least 160; five require 260. GEPA's budget covers search evaluations; the report separately counts review-file validation and final comparisons/release checks. No automatic publication, rule edits, baseline approvals, database access, lead import or outbound messages occur.

## Evaluation contract

The 30 existing golden cases are explicitly partitioned into 20 training and 10 validation examples in `scripts/gepa/splits.json`. Both are development data: these cases have already informed earlier fixes. The split must be complete and disjoint.

Without human ratings, the objective is intentionally limited: one point only if **all** required fit, theme, length, one-question, required/excluded text and grounding checks pass. GEPA receives per-objective diagnostics plus failed checks and example emails. Each proposed change is compared over all 20 training cases so a small random batch cannot miss the drafts it changes. There is no reward for merely making an email shorter. Passing the structural objective does not establish that a rep would send the draft.

Candidate selection uses GEPA's Pareto strategy and strict improvement. Ties keep the baseline. After selection is written to `selection.json`, the runner loads 12 separate synthetic release cases and evaluates the locked selection. Those cases are never supplied to the proposer or used to select among alternatives. The runner then evaluates all proposed configurations across the full 30-case suite to produce the comparison report. A failure on any selected golden or release case makes the command fail. Now that the release cases have been inspected, treat future repeats as regression checks, not a fresh holdout.

The report records the actual rule fingerprint, case hashes, seed, package version, proposal feedback, evaluation counts, selected policy, differences and human-review status. `human-review.csv` contains exact draft hashes and blank reviewer/would-send/reason fields. Identical drafts for the same case are deduplicated: the default run creates **81 unique case/draft rows** from 120 case/policy combinations. Blind and randomize those drafts before collecting independent judgments; the side-by-side HTML report itself is not blinded.

## Optimize using rep judgments

Run the default experiment, then complete the generated `human-review.csv`. Preserve case IDs, draft hashes, subjects and email bodies. Enter a reviewer name, `Would send` or `Would not send`, and an optional reason. Then run:

```sh
.venv-gepa/bin/python scripts/gepa/run.py --reviews /absolute/path/to/completed-human-review.csv
```

The objective becomes **all required checks pass × would-send rating**. Review reasons also enter the reflection feedback. Missing ratings, changed draft text, obsolete hashes and conflicting ratings stop the run; a blank is never interpreted as a rejection. The file must cover every case/draft version that the selected mode can propose. For local-model reflection, first generate and review the full six-policy library with `--proposals 5 --max-evals 300`, because the model may select any approved configuration. The software verifies draft matching, not reviewer independence or judgment quality.

A separate smoke test used explicitly synthetic ratings to verify that supplied preferences change candidate selection while preserving the required checks. Those labels are test fixtures, not evidence of SDR preference or email improvement.

Current Google Sheets rep feedback remains attached to actual lead/draft revisions. It is **not automatically used as a golden-case training label**. Matching a real outcome to an appropriate, permissioned optimization dataset needs a deliberate review. No conversion probability or fit rule is optimized from these synthetic email checks.

## Recorded automated result

- Official GEPA 0.1.4, library proposer, three alternatives.
- 130 search case evaluations, plus 132 final comparison/release evaluations.
- Selected policy: existing walkthrough/original baseline.
- Selected golden checks: **30/30**; separate release checks: **12/12**.
- No measured improvement on the automated objective; every proposed wording option tied on the checks it encountered.
- No production email change, independent human quality result, sales lift or live retrieval improvement is claimed.

[Recorded report](archive/gepa-experiment.html) · [Raw result](../test-data/gepa-verified-run.json). The [original 28-evaluation run](../test-data/gepa-first-run.json) is retained for traceability; the current runner compares proposals over the full training set.

## Promotion and interview explanation

Before promoting a candidate, review its full diff and source evidence, collect independent SDR would-send/edit judgments, check a fresh untouched holdout, change the approved production default through code review, and inspect golden snapshot differences. Only then approve intentional snapshots and publish. Do not alter the evaluation weights to manufacture a win. If all candidates pass but no humans prefer one, retaining the baseline is the correct result.

Video wording: “GEPA proposes alternatives, runs the same cases and uses feedback to decide whether a candidate is better. My free demo uses its actual search engine with reviewed wording options; local-model reflection is an optional mode. The first run found no measurable improvement, so it kept the existing draft policy. Rep feedback supplies the next missing quality signal.”

Official references: [GEPA repository](https://github.com/gepa-ai/gepa), [custom-proposer API](https://gepa-ai.github.io/gepa/api/core/optimize/), [adapter interface](https://gepa-ai.github.io/gepa/guides/adapters/), [GEPA paper](https://arxiv.org/abs/2507.19457). Current online docs may describe features newer than the pinned package; this integration is tested against 0.1.4.

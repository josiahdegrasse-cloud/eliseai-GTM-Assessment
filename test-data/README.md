# Fixtures and research records

Files remain in their existing locations because application code, tests and benchmark runners reference their paths.

- **Build regression suite:** `golden-leads.json` and `golden-baseline.json` freeze inputs and expected outputs. `golden-first-run.json` preserves the initial result.
- **Demo/runtime evidence:** `researched-examples.json`, `sheet-example-inputs.json`, `legacy-example-inputs.json`, `public-research-snapshots.json` and `area-fixture.json` support examples or tests. They are not a live mirror of the user's Google Sheet.
- **Benchmark inputs:** files ending in `inputs.json` describe frozen test sets; expected labels must not be passed to the product as input.
- **Historical results:** timestamped runs and files named benchmark, replay, summary, results, recheck, before or after record dated development observations. Their percentages are not current population-wide accuracy.
- **GEPA experiments:** `gepa-*.json` preserve offline candidate evaluation and separate release cases; see [experiment documentation](../docs/GEPA.md).

See [current evaluation](../docs/EVALUATION.md) and [historical documentation](../docs/archive/README.md) for interpretation. Preserve original first-pass records when recording a later recheck.

# Current release checklist

October 1, 2026. Canonical behavior is in README.md and docs/SCORING_AND_OUTREACH.md.

- Working public tool: manual/Excel/CSV/TSV input, Google Sheets automated intake, source-backed research, sourced company fit and transparent A/B/C priority and editable outreach.
- Public APIs: Jina Reader, Census geocoder, optional Census Reporter and GLEIF; bounded direct public-page fallback.
- Fit: housing-fit-v3; High fit / Low fit / Fit unclear with source-backed reasons; size and role remain separate facts.
- Draft: deterministic v16; one context detail, one relevant capability, one short ask, no sending, reviewed edits preserved.
- Evals: 30 frozen synthetic cases gate builds; fit/priority/evidence/email snapshot changes require explicit review. First-run 28/30 defects retained and fixed.
- GEPA: pinned official package, offline custom adapter, bounded wording search and optional local-model reflection. First actual search retained the baseline; independent email-quality evidence is still needed.
- Observability: source attempts/status/duration, last sync, bounded saved assessments and rule fingerprints; version-bound would-send feedback.
- Market context: matched-tract renter share, 5+ unit housing share and gross rent now appear below the submitted property, with period and source. They add no priority points or unsupported email claims.
- Free fallback: preflight checks the verified non-renewing free-token allowance before reserving Reader slots; direct company research is bounded to 90 page reservations per workspace/day, 12 globally/minute, three pages/12 seconds per lead. Run log shows the mode and app allowance.
- Benchmark: 30 frozen public-company cases, preserved first-pass results and separately labeled development rechecks. The October 1 repair adds a final-version recheck and an untouched 12-company check; see docs/RESEARCH_RECOVERY.md and the preserved baseline in docs/HOLDOUT_30.md. These results are not population accuracy or a sales-conversion estimate.
- Research: finished, limited evidence and interrupted lookups distinguished; saved results preserved; retry details available.
- Security: browser-session isolation, scoped hashed Sheets tokens, bounded inputs and requests. No account sign-in or team permissions yet.
- Cost: optional Jina free credits are finite. The configured ledger verifies a free-only wallet, reserves 20k per call and settles reported usage against a fixed allowance of at most 8M; legacy attempt counters remain intact; no paid enrichment fallback/top-up. Hosting/account terms are separate.
- Validation: see docs/EVALUATION.md for executed checks and dated public-source results. 30/30 golden cases pass with zero drift; free fallback and priority regression checks pass. No independent SDR study or conversion claim.
- Rollout: design/DESIGN_SCRIPT.md contains timeline, stakeholders, quality gates, baseline protocol and walkthrough script.
- Code handoff: regenerate the allowlisted reviewer ZIP from the final clean source with scripts/package-submission.py. Its manifest identifies the packaged commit.
- Remaining human work: record the 5–15-minute video; conduct independent SDR review/time study. Never present these as completed.

Historical evaluation artifacts remain for traceability; their percentages are not current system-wide accuracy.

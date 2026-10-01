# Evaluation — September 30, 2026

Latest live research results and token-accounting repairs are recorded in [Research reliability repair — October 1](RESEARCH_RECOVERY.md). The dated results below remain historical evidence.

This document records the preceding evaluation releases. The current company-fit model is housing-fit-v3 and writer v16: categorical eligibility replaces weighted points; deterministic emails use one detail, one relevant reply and one ask. Earlier measurements below retain their original versions. This wording/rubric update makes no new live retrieval or sales-conversion claim. Historical benchmark JSON files remain in `test-data/` for traceability; older paid-provider results are not evidence of current free-provider performance.

## Current quality-control release — housing-fit-v3 / writer v16

The new offline suite contains **30 synthetic golden cases**, including wrong company/domain, customer claims, conflicting sources, stale facts, prompt injection, negated requests, unknown contacts, and property-address/ownership confusion. Cases freeze evidence and time, and compare categorical fit, reasons, supporting quotes, portfolio facts, personalization theme and exact email against an approved snapshot. There is no numeric score breakdown in the current model.

The preserved [first run](../test-data/golden-first-run.json) passed **28/30**. It exposed an adviser being left unclear despite explicit evidence and a housing pitch emitted for conflicting operating-model evidence. Both were corrected before approving the baseline. The current replay passes **30/30 with zero snapshot drift**. [Readable report](golden-evaluation.html) · [Cases](../test-data/golden-leads.json) · [Approved snapshots](../test-data/golden-baseline.json). These are development regression cases, not an untouched holdout or 100% real-world accuracy. Human email judgments are deliberately unfilled.

The build runs this evaluation and fails on a violated expectation or unexpected snapshot change. Reports show old/new outputs; a human must review changes before `pnpm eval:approve`. Runtime assessments save the actual inputs, evidence, rule fingerprint and draft. Source logs distinguish failed, skipped, unmatched, cached and successful research. Sheet feedback rejects a grade for an obsolete draft revision.

Validation: **597/597 application checks and 5/5 GEPA runner checks pass**, with no skipped tests; the production build and credential-scanned package pass. Local browser checks verified source history, import/research assessments and saving would-send feedback using isolated fixtures. The ten researched examples also pass distinct-subject, response-type, body and question checks; desktop/mobile browser review confirmed their rendered drafts. Scenario migration is tested for idempotency, isolation and preservation of edits. External research providers were not called by those fixtures; browser-loaded Street View is separate. This release does not rerun the live provider benchmark; the recorded retrieval gaps below remain unresolved. Independent SDR review, actual conversion outcomes and a narrated recording remain outstanding. See [the quality controls and controlled pilot](QUALITY_AND_PILOT.md).

## Executed GEPA experiment

The actual `gepa==0.1.4` optimizer ran with a free custom proposer over three reviewed email-wording alternatives. It used 20 existing golden cases for training and 10 for validation, with 130 search evaluations. All alternatives tied on the automated checks, so the existing production policy was retained. After selection, 12 separate synthetic release cases passed; final reports compare every proposed policy over all 30 golden cases. There were 132 additional case evaluations for comparisons/release checks. These counts are executions, not independent sample sizes or measured sales accuracy.

Library mode used no model API or external retrieval. An optional local Ollama reflection mode is implemented and its transport/schema is tested, but no real local-model reflection run was performed. Complete, revision-matched would-send ratings can be supplied through a review CSV. A separate synthetic-rating smoke test selected its intended alternative; that validates feedback plumbing only. Independent human email quality remains unmeasured. [Integration and reproduction](GEPA.md) · [Readable experiment report](gepa-experiment.html).

## Previous classification recovery follow-up

The next classifier/identity update recovers Waterton, Drucker + Falk, RangeWater Residential and WinnCompanies using their retained official-source evidence. The original 16-company set goes from 10 to **14 classified**, with no incorrect asserted sector against its labels. This is a development replay, **not 87.5% measured live accuracy**. Pegasus remains without usable captured evidence; Laramar remains ambiguous from the retained investment-management excerpts.

Identity v2 handles encoded copyright ownership and appended navigation labels, while rejecting customer-story references. Existing version-1 identity evidence is reevaluated on load; the original source dates stay unchanged. Classifier rules support explicit self-described management companies, affordable-housing managers and property-management services. Foreign-company and denied-operation checks remain enforced. The score weights and request budgets are unchanged. The production build and all 572 automated checks pass, including 31 new recovery and negative-control checks.

Reproduce with `node scripts/replay-classification.mjs`; see [replay results](../test-data/classification-replay-results.json). A separately frozen [seven-case set](../test-data/fit-fresh-inputs.json) is reserved for the deployed configured-provider check. Its labels are never product inputs.

## Fresh configured-provider check — site version 71

Executed 2026-09-30T23:57:49.561Z through 2026-10-01T00:00:55.212Z against the published site and its existing provider configuration. No keys were copied or exposed, no quotas reset, and no billing settings changed. A separate temporary visitor was created for seven cases and deleted successfully after the run. No existing user leads were read or changed. The source revision under test was `ca909abda5851070cc30e4f42cd56c239a5f0a37`.

The [frozen inputs](../test-data/fit-fresh-inputs.json) contain three housing operators, three software vendors and one wrong-domain control. They were not used to tune this release. All contact names/emails/inquiries are synthetic; this measures company classification only. Labels were checked on official sources before execution.

- **4/6 ordinary companies classified**, all four consistent with their labels: Venterra, Rent Manager, DoorLoop and TenantCloud.
- **2/6 unresolved:** Towne Properties and Morgan Properties returned no usable retained sources. This is a retrieval gap, not evidence that these companies lack housing fit.
- **1/1 wrong-domain control abstained:** Morgan Properties paired with DoorLoop's domain did not become a housing operator.
- Housing-operator coverage: **1/3**; software-vendor coverage: **3/3**. Do not hide this imbalance behind an overall percentage.
- Median request time across all seven cases: **21.1 seconds**, including unsuccessful lookups. No retries or hand-selected rescue pages were substituted.

[Raw configured-path results](../test-data/fit-configured-2026-09-30T23-57-49-561Z.json) · [Runner](../scripts/benchmark-configured.mjs). This is a small selected sample, not proof of population accuracy. The configured path was exercised; provider credit consumption was not independently audited. The raw first pass remains unchanged. Documentation-only publication after version 71 does not change the tested product code.

**Conclusion:** the saved-evidence classification defects improved, but live retrieval is still the primary remaining blocker. No broad 95% claim is supported. Next, separately investigate the two no-source failures and test any retrieval fix on another frozen set rather than rebranding a targeted recovery as new accuracy.

## Previous release changes

Research completion is separate from lead fit: queued, running, finished, limited evidence, interrupted and input review. Failed refreshes retain saved evidence. Automatic contact retries are bounded to three attempts per page lifecycle; a manual refresh resets that budget. This is not a durable background job queue.

Writer v13 removes generic housing-operation observations and redundant demo openings, keeps one relevant question, and preserves edited/reviewed text. Briefs retain factual profile sentences while trimming bounded marketing adjectives. A captured page-heading failure prompted an additional sentence filter and a focused regression after the live run.

## New anonymous live first pass

Inputs: [20 frozen cases](../test-data/quality-holdout-inputs.json). Results: [unaltered first-pass outputs](../test-data/quality-holdout-results.json). Runner: [benchmark-quality.mjs](../scripts/benchmark-quality.mjs).

Executed September 30, 2026, 23:22–23:30 UTC, in an isolated local Worker with no provider key. One workspace, sequential requests, existing provider caps, no quota resets, no manual source rescue and no retries. The public deployment uses an optional configured Jina free key; these measurements **do not establish its coverage or latency**. Local Worker logs included certificate failures and upstream access errors, which were not bypassed. Provider/environment failures remain in the denominator.

The selected convenience sample contains 16 company/domain examples (11 housing operators, four software vendors and one accounting firm with a housing-company namesake), two wrong-domain controls and two wrong-employer controls. Only four positive cases contain real public professionals; the other names are TEST fixtures or explicit negative controls. All emails and inquiries are synthetic. One case has a real listed property address. It is not a representative inbound sample or a property-accuracy study.

Labels were checked against official sources before the run and withheld from product inputs. The first pass used this release's initial v13 build before final presentation refinements. Its raw outputs are preserved; later regression fixes were not silently substituted. The cases are now development evidence and cannot serve as an untouched future holdout.

| Measure | Observed result | Interpretation |
| --- | --- | --- |
| Company classification, original 16 examples | 10/16 classified; 6 unresolved | 62.5% coverage, not 62.5% incorrect/correct accuracy |
| Housing operators in those 16 | 5/11 classified | Public retrieval/extraction remains the largest gap |
| Software/accounting negatives | 5/5 identified as non-operators | Small selected negative sample |
| Incorrect asserted sector, original 16 | 0 among 10 assertions | Does not demonstrate a population accuracy rate |
| Wrong company/domain controls | 2/2 stayed unresolved | No forced company match observed |
| Public professional positives | 3/4 returned expected roles | Too small and senior-biased for generalization |
| Wrong-employer controls | 2/2 returned no role | Abstention is desirable in these controls |
| Latency, all 20 | Median 27.4 s; p90 32.7 s; range 2.6–40.3 s | First-pass request time, including failures; no SLA |
| Draft structure | 20/20 had one question; 20–49 words | Structural check, not independent quality approval |
| Research states, all 20 | 2 finished; 12 limited; 5 interrupted; 1 input review | “Finished” describes checks, not sales readiness |

Across all 20 cases there were 11 company classifications, seven unresolved cases where an operator was expected, and two deliberately unresolved wrong-domain controls. Do not combine these into an “accuracy” headline. Missing information and contradictory information have different consequences.

The review also caught one poor summary assembled from page headings and financial figures (Q01). A post-run parser regression now rejects that fragment and retains an available factual sentence. This correction does not improve the recorded live benchmark, and no independent audit of every emitted portfolio or geographic claim has been completed.

## Previous automated and interface validation

Automated regression coverage includes source identity, provenance, score consistency, stale/conflicting evidence, provider errors, retry behavior, session isolation, Sheets deduplication, draft grounding and preservation of edits. Passing tests validate those specified behaviors; they do not prove representative research coverage, security certification or SDR adoption.

Local browser check used explicitly synthetic Acme Housing evidence: intake reached a sourced account/contact brief, completion status displayed, and the email tab showed a short inquiry-specific message with one question and no repeated role. No real prospect was contacted. Final release validation: production build passed; **541/541 automated checks passed** with no skipped tests. `git diff --check` and the reviewer package credential scan passed. All 169 packaged file checksums were verified before final source packaging.

## What to do next

1. Diagnose unresolved companies by retrieval versus extraction failure. Keep TLS verification and provider limits intact. Measure the configured free-key path separately in an isolated authorized workspace before making production claims.
2. Freeze a new balanced evaluation set, including smaller operators, non-operators, ambiguous names and ordinary contacts. Independently label identity, sector, role, comparable scale and exact-property relationships. Report coverage and claim correctness separately for each field.
3. Have SDR/AE reviewers judge useful facts and draft edits blind to the generating version. Use the [pilot worksheet](../test-data/pilot-review-template.csv); it is intentionally empty.
4. Run the four-week pilot in [the rollout plan](../design/DESIGN_SCRIPT.md). Measure preparation time on comparable distinct leads, not repeated exposure to the same lead.

No measured sales conversion lift, independent SDR time saving, empirically calibrated scoring model, full accessibility audit or production load/security audit is claimed. A narrated 5–15 minute video still needs recording using the included walkthrough script.


## October 1: priority, free fallback and 30-company validation

The current build checks all 30 golden fit/priority/email snapshots. Adding priority changed only the new snapshot field; prior fit and email outputs were compared and remained identical. New tests cover no-key/throttled Reader, exhausted app allowance with zero Reader network calls, provider quota fallback, same-tract market display, negated/instruction-like inquiries, review ordering, saved priority inputs and narrow operating-model wording. Desktop and 390px mobile checks confirmed no console errors or horizontal overflow; the priority explanation and free-research status panel are accessible.

[The live 30-company report](HOLDOUT_30.md) separates the untouched first pass from development rechecks, reports unresolved cases separately from wrong labels, and uses a nine-person role subset. [Draft review artifact](holdout-30-review.html). No user Sheet rows were changed and isolated test workspaces were deleted. The Jina cap remained exhausted; no paid requests or quota resets were used. A new independently labeled set and SDR would-send judgments remain necessary before a stronger accuracy or email-quality claim.

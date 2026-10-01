# Quality controls and the sales pilot

This is an implemented regression and observability layer plus a proposed sales experiment. The SDR pilot and measured conversion lift remain future work; the executed offline GEPA experiment is documented separately.

## 1. Golden evaluations before changes ship

An eval is a repeatable example with an expected result. Running the same evidence through a new version makes a wrong fit decision or changed email obvious before it reaches a rep.

`test-data/golden-leads.json` contains 30 synthetic cases with frozen evidence and time. They cover large/small operators, housing segments, non-operators, mixed businesses, ambiguous identity, wrong domains, customer references, denied/conflicting operations, missing facts, stale evidence, each supported inquiry theme, negation, malicious instructions and address-versus-ownership confusion. These are manually specified engineering labels; independent SDR validation is still needed.

Run `pnpm eval:golden`. The JSON and readable HTML reports in `.quality-reports/` show failures and snapshot differences. A normal `pnpm build` runs the same gate. It compares category, A/B/C priority (or Research needed), rule, reason, retained quotes, reported portfolio, theme, subject and exact draft; checks also enforce length, one question, exclusions and fact references. There is no point-score breakdown because the current rubric is categorical.

For a deliberate rule change:

1. Keep the old snapshot and run the candidate against all cases.
2. Read every changed fit reason, supporting quote and before/after email. Fix unintended changes first. Add the newly discovered failure as a case.
3. Ask an SDR to judge changed emails blind to version. Record would-send and reason; do not substitute word count for judgment.
4. Only then run `pnpm eval:approve` and commit the reviewed baseline with the change. Approval refuses failing expectations. The build must pass against that baseline.
5. Keep a separately labeled holdout out of tuning. Once a holdout informs a fix, it is development data; collect a new holdout.

The preserved first run passed 28/30 and exposed two actual defects; the corrected baseline passes 30/30. This is regression coverage, not a representative accuracy estimate. Real-source retrieval remains separately measured in EVALUATION.md.

## 2. Draft feedback in Sheets

The upgraded script appends `Inbound Draft ID`, `Email subject`, `Email draft`, `Company fit`, `Would send`, `Feedback reason`, and `Review status`. It does not replace original lead columns. Reps enter exactly `Would send` or `Would not send`, plus a reason. Unreviewed cells stay blank.

The timer imports rows, requests research, and returns current draft previews. Feedback uses a hash of the exact subject and text. A stale grade cannot silently rate a regenerated message; the sheet receives the current version and clears the old verdict. Authenticated review is restricted to the existing spreadsheet/tab/workspace connection. Draft text is displayed safely as text in the sheet. No mail is sent, and sheet output cells are not a general-purpose lead editor.

For an existing connection, use the site's **Update script for draft reviews** action, replace Code.gs in that same Apps Script project, save, and run `installInboundDesk`. The upgrade reuses the connection in Script Properties. No paid connector or new provider key is required. Do not reconnect just to install this update.

## 3. Observability and the closed-tab question

Open a lead's **Sources → Run log & saved assessments**. Each source attempt records its start/end, source, status and sanitized failure code. The UI shows the most recent attempt and last recorded successful fetch in the displayed history. A cached response is identified as cached, not a new source fetch. A completed lookup without a match differs from a technical error. Running records with no completion eventually display as interrupted.

Sources include company, contact, property geocoder, area context, legal entity, logo, optional imagery lookup, and authenticated Sheets calls. Street View embeds run in the browser and do not claim a server-side success log. These are source-level operations, not a trace of every internal HTTP request. Sheet transport success does not mean every provider succeeded; inspect the separate source runs.

The connection panel shows last successful import and errors; an overdue heartbeat is visible after 15 minutes. Apps Script's **Executions** view and its `INBOUND_LAST_SUCCESS` / `INBOUND_LAST_ERROR` properties diagnose failures that cannot reach the application at all, such as a Google quota or authorization failure. Absence of a heartbeat is not proof of the cause.

**The Google-owned five-minute trigger runs with the website tab closed.** It imports up to 100 complete rows in 25-row batches and asks the Worker to process at most three leads per run. Timing is approximate and depends on Google quotas, authorization and provider availability. It is not an always-running background Worker. Manual/file intake uses the browser queue and needs an open page to start further work; opening the workspace resumes it. Do not describe this MVP as a durable production job system.

The application retains at most 500 source runs per workspace and 20 assessments per lead. The UI shows the latest 100 relevant runs. Workspace expiry or deletion removes these records: normally 24 hours, extended to 90 days for a connected Sheet. Long-term pilot data must be retained under an approved access/retention policy before relying on it for 90-day outcomes.

## 4. Reproducible scoring and grounded drafts

Every import, completed assessment and saved draft/feedback change captures normalized inputs, buyer notes/provenance, stored research and dates, contact/property context, rule fingerprint, fit reason/quotes, the exact priority tier and matched inquiry, email and feedback. An old decision can be inspected using the evidence available then, rather than a changed company website. History is owner-scoped and bounded, not a permanent compliance archive. Open a saved assessment to copy its JSON for analysis.

Generated personalized hooks reference stored fact IDs and exact excerpts. The guard checks that the facts exist, the excerpt and URL agree, and the rendered observation matches an allowed grounded observation. Unmatched hooks fall back to neutral wording. Inquiry facts are explicitly submitted context; public facts retain source URLs. Fixed capability copy is a reviewed template. Human edits are preserved, and are not automatically certified by this guard. Source truth and entity matching still require evaluation.

No probabilistic score is being smuggled into the current label. High fit means evidenced residential ownership/management; Low fit means evidenced business outside the focus; Fit unclear means insufficient or conflicting evidence. **Unclear is a research-coverage bucket, not the middle conversion band.** Portfolio size and intent remain separate.

## 5. Controlled pilot with 2–3 SDRs

Before the pilot, the SDR manager, RevOps, marketing ops and GTM engineer agree eligibility, baseline definitions, review rubric and stopping conditions. Legal/privacy and IT/security review permissioned data, sources, retention and access. An AE checks account usefulness and handoff quality.

| Phase | Work | Gate |
| --- | --- | --- |
| Week 1 | Label 30 permissioned reference cases independently; resolve reviewer disagreements; capture manual preparation time and current response baseline. Freeze rubric and metrics. | Approved labels, access/retention policy, baseline and owner. |
| Week 2 | Shadow on separate balanced leads, with humans reviewing every displayed claim and draft. Exercise missing evidence, upstream failure, retry and closed-tab Sheets intake. | No unresolved critical attribution or unsupported-claim defect; errors diagnosable by an operator. |
| Week 3 | Enroll 2–3 SDRs. Randomize eligible accounts into assisted versus current-process control, balancing source, fit and known comparable portfolio scale where feasible. Keep all contacts from one account in one arm. Same SLA and outreach policy; every assisted draft requires review. | No critical privacy/attribution incident; acceptable quotas, review effort and support burden. |
| Week 4 | Review adoption, preparation time, first-response time, draft acceptance and early meeting rates with denominators. Expand, revise or stop. Continue observing meetings for 30 days and closed outcomes for 90 days under approved retention. | Named owner and explicit decision; no unsupported short-pilot conversion claim. |

A randomized account control limits spillover from repeatedly seeing the same company. Stratify/report by rep and intake source; do not let one rep get all the large accounts. Analyze assignment-to-arm, including failures and unresolved research, rather than dropping unsuccessful enrichments. Record time spent correcting tool errors. Sample size and minimum detectable lift need baseline volume/rates; two weeks of sparse wins is not enough for causal claims.

Measure:

- **Preparation time:** active minutes from opening the lead to a review-ready response, including edits. Report median and spread by arm.
- **Time to first response:** receipt timestamp to first actual human outbound response, recorded externally; report elapsed and agreed business-hour time. The tool does not send mail or know that a copied draft was sent.
- **Draft acceptance:** would-send / reviewed drafts, plus reasons, minor-edit rate and edited words. Report unreviewed count separately; grade the exact draft revision.
- **Meetings:** unique eligible accounts with a booked meeting / all eligible assigned accounts over the same observation window, split by arm and frozen fit category.
- **Conversion:** the agreed stage (e.g. qualified opportunity, and separately closed-won) / eligible assigned accounts with the same follow-up window. Report denominators, pending/censored outcomes and uncertainty. Never count pending deals as losses just to complete a chart.
- **Coverage/reliability:** resolved fit, verified contact role, grounded useful facts, source failures, latency and quota use. Separate coverage from correctness.

The initial hypothesis is that High fit converts more often than Low fit on comparable inbound leads. Report Fit unclear separately and investigate coverage; do not force a monotonic High → Unclear → Low claim. Track the frozen assessment/rule version attached to each result. Proposed operational targets are 30% lower median preparation time, 80% would-send/minor-edit acceptance, and no observed critical cross-account attribution error; these are gates to agree, not achieved results.

Once sufficient outcomes exist, estimate conversion probability using temporally separate training/validation data, check calibration and lift against a simple baseline, and verify that observed conversion increases across **new probability bands** on holdout data. A future prioritization proxy can be `estimated close probability × verified comparable apartment homes`. Use current in-scope homes, not AUM, beds or unsupported global totals. Treat missing size explicitly. This is a unit-weighted opportunity proxy, not expected dollar revenue; use estimated contract value only when an approved model exists. No such calibrated ranking is currently implemented.

Sheets is the MVP. After demonstrated usefulness, plan Salesforce or HubSpot identity/deduplication and assessment fields, then Outreach draft/review integration. RevOps owns field authority and conflict handling; marketing ops owns lead provenance and routing; the SDR manager owns adoption and review. These integrations are planned, not deployed.

## 6. Feedback loop and optional GEPA

Link rep verdicts, edit reasons, meetings and closed-won/lost outcomes back to the immutable assessment ID and rule fingerprint. Review error clusters weekly. Propose a bounded change, replay all golden cases, obtain blind rep judgments, validate on an untouched holdout, then promote the version. Do not automatically learn from a single rep edit or a deal with unrelated causes.

[GEPA is now integrated](GEPA.md) as an offline development experiment. The real optimizer evaluates reviewed email-policy alternatives using the production writer and grounding guard. The default custom proposer uses no model API; optional local-model reflection is available but has not been run with a real model here. The first bounded search retained the baseline because no alternative improved the automated objective. It passed 30 golden and 12 separate synthetic release cases. This establishes execution and regression behavior, not better sales emails. Independent would-send ratings and a fresh holdout are required before promoting a change. The optimizer cannot change company fit, invent claims or publish candidates automatically.


## Current priority and coverage validation

Priority A is a sourced housing operator with a specific relevant inquiry or demo request; B is an operator with general or no active demand; C is outside the housing focus. Missing or interrupted company evidence is Research needed. Save assessment IDs before outcomes occur. Within eligible housing operators, compare A/B meeting-booked and qualified-opportunity rates, sample sizes and uncertainty; do not force the rates to be monotonic or call these probabilities. Record scope/portfolio separately before exploring account-value tie-breakers. Treat personal email domains and tract wealth as neither disqualifiers nor buying intent.

The [30-company live benchmark](archive/HOLDOUT_30.md) preserves an independent first pass and clearly identifies later development rechecks. It measures retrieval/label coverage and a nine-person role subset, not actual sales conversion or 95% general accuracy. Review the accompanying drafts with SDRs and collect a new untouched set before making stronger claims.

# Inbound Desk: current design, rollout and interview walkthrough

Current specification: September 30, 2026. Earlier readiness/next-action interfaces are retired. The canonical rubric is [SCORING_AND_OUTREACH.md](../docs/SCORING_AND_OUTREACH.md).

## Purpose and boundaries

Reduce the work between receiving a sparse inbound inquiry and preparing a grounded first response. The tool supplies facts and an editable draft; the rep decides how to sell. It does not infer budget, authority or urgency from a title or a property address.

The lead header shows one company-fit label and an explanation. The Lead brief contains research completion, coverage, inquiry/notes, account facts, contact role/responsibilities, operating context, dated developments and the submitted property, when evidence supports them. Source details remain accessible on demand. The Email draft tab separates writing/review from research.

Completion and information coverage are different: a lookup may finish without establishing a role. Technical failures say interrupted; input problems request a company correction. Saved evidence survives outages. Missing or conflicting company evidence stays Fit unclear. Company fit never becomes a conversion probability.

## Architecture and design choices

- Browser interface → same-origin Cloudflare Worker API → D1 workspace records.
- Company and person research run together. Company facts can be saved/displayed before optional context finishes.
- Jina Reader and bounded direct official HTML provide company text; Census geocoding provides address geography; Census Reporter and GLEIF provide optional context. Source dates and exact supporting excerpts remain attached.
- Company facts expire after 24 hours; bounded retries and cached results respect provider quotas. The optional Jina free key has a permanent 400-request reservation cap shared by Reader, Search and embeddings. It is not unlimited free research.
- A deterministic v15 writer uses at most one meaningful company observation, a relevant capability and one question. It does not repeat a job title or invent ROI. Edited drafts are preserved.
- Google Sheets uses a user-owned Apps Script with edit/form triggers and a five-minute fallback. Authenticated batches populate D1; processing calls enrich up to three queued leads per run even when the website is closed. Duplicate rows do not overwrite rep edits. No paid connector is needed.
- Manual/file imports use the browser research queue. Google Sheets adds a draft-review feedback loop; it is not general CRM synchronization.
- Server-side browser-session isolation is implemented. Sign-in, team roles, durable ownership and recovery are future rollout work.

## Fit assumptions to explain

First establish company identity and residential operations. High fit requires explicit sourced housing ownership or management. Low fit requires an established business outside that focus. Missing or conflicting evidence is Fit unclear. Portfolio size, contact role and buyer intent remain separate; none adds points. A smaller operator with an unresolved contact can still have high company fit. The rep decides opportunity priority from the full facts. These are transparent eligibility assumptions, not a conversion model.

## Testing and rollout

The full protocol is [Quality controls and the sales pilot](../docs/QUALITY_AND_PILOT.md): week 1 labels/baseline, week 2 shadow and failure drills, week 3 controlled pilot with **2–3 SDRs**, week 4 initial decision with longer outcome follow-up. Randomize by account into assisted and current-process control; balance source, fit and known scale, and retain failed enrichments in the denominator. Human-review every draft.

Stakeholders: SDR manager (adoption/rubric), RevOps (fields/measurement), marketing ops (intake/routing), GTM engineer (reliability/evals), AE (usefulness/handoff), legal/privacy and IT/security (sources/access/retention). Sheets is the MVP; Salesforce or HubSpot and then Outreach are planned integrations, with field ownership and approval defined before write-back.

Measure preparation time, actual time to first response, meetings booked, would-send/edits, and conversion by frozen fit category and experiment arm. High fit should outperform Low fit if the rubric is useful; Fit unclear is a coverage bucket, not a middle score. Learn probability bands and expected-value ranking only after enough independent outcome data exists. No lift has been measured yet.

Use `test-data/pilot-review-template.csv`; leave unknown outcomes blank and preserve assessment ID and rule fingerprint. Proposed gates: 30% lower median preparation time, 80% draft acceptance with minor edits, no observed critical attribution error. Report sample sizes and uncertainty, and extend observation rather than calling pending deals losses.

## 10–12-minute video script

**0:00–0:45 — Problem.** “An inbound lead starts with a name, email, company and sometimes a property address. I automate the repeatable research and first-draft work while keeping the rep in control.” Show the inbox; identify demo inputs as synthetic.

**0:45–2:00 — Intake and closed-tab automation.** Show the connected Sheet and the complete-row requirements. “A Google-owned Apps Script trigger runs on edits/forms and about every five minutes. It calls authenticated Worker endpoints, which save and enrich leads in D1. That timer keeps working when the website is closed. Manual file intake uses a browser queue instead.” Show last sync and explain import is not research completion. Note free quotas and approximate timing.

**2:00–3:00 — Public APIs.** Explain Jina Reader/official pages, Census geocoder and optional Census Reporter/GLEIF. Show one source. “The Census match supplies geography, not ownership. Free credits and provider limits are finite; there is no paid enrichment fallback.”

**3:00–4:15 — Brief and defensible fit.** Show company/contact facts, the address/Street View and Why this fit. Contrast an operator, vendor and unclear case. “High fit means sourced housing operations. Low fit requires evidence outside that focus. Unknown is not low. Size and contact role remain useful facts, not invented buying probability.”

**4:15–5:30 — Email and grounding.** Show one supported detail, one capability and one question. “This writer is deterministic. Personalized hooks must reference a stored fact ID and supporting excerpt; invalid ones fall back to neutral wording. It doesn't invent pain or repeat titles.” Edit/save; make clear human edits are preserved and nothing sends. Show Would send/why and the matching Sheet review columns.

**5:30–6:45 — Observability.** Open Sources → Run log & saved assessments. Show an actual failed, unmatched or skipped result from local approved fixtures, alongside a success. “No match differs from a failed request. Each operation has timestamps and status. Saved assessments freeze inputs, sources, fit and draft with a rule fingerprint.” Show Sheets sync/error status. “A missing heartbeat alerts us to investigate; Apps Script Executions diagnoses failures before a request reaches the app.” Mention bounded history and workspace expiry.

**6:45–8:30 — Evals, regressions and honest limits.** Open the readable golden report. “An eval is a repeatable case with an expected result. These 30 frozen synthetic cases include wrong identities, conflicting evidence, stale facts and misleading inquiry text. Every build compares fit explanations and exact email snapshots. The first run passed 28: it exposed an adviser classification and an unsupported housing pitch; the corrected replay passes 30. That's regression coverage, not 100% real-world accuracy.” Show a stored old/new result. Explain human snapshot approval, separate live retrieval coverage and independent rep judgments. “GEPA is integrated as an offline optimizer. The free demo tested three reviewed wording options through its real search engine. They did not improve the automated objective, so the baseline stayed. Local-model reflection is optional; it has not been run here. Rep ratings are the missing quality signal, and candidates never auto-publish.”

**8:30–10:15 — Pilot and outcome validation.** Present the four-week plan with 2–3 SDRs and an account-level control group. Name SDR manager, RevOps, marketing ops and legal/privacy. Measure preparation time, actual response time, meetings and conversion by frozen tier; retain failure cases. Explain small samples and delayed deal outcomes. “If High fit doesn't outperform Low fit, revise the assumptions. Only with enough data would I calibrate probabilities and compare probability-times-portfolio priority against a baseline.”

**10:15–11:15 — End with the feedback loop.** “Reps mark whether they'd send, edit the draft and explain why. Meetings and closed deals are linked back to the saved assessment version. We review patterns, propose a change, rerun the evals, check a held-out set and only then release. That is how the scoring and writing improve without quietly reintroducing yesterday's errors.” Finish with the flow: **rep feedback + outcomes → reviewed change → evals/holdout → new version**.

The video still needs to be recorded. This script is not a recording or evidence that the proposed pilot happened.

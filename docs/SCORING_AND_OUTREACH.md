# Company fit and outreach — current specification

Current model: `housing-fit-v3`. Writer: deterministic v20. These are assignment assumptions, not EliseAI's internal qualification rules.

## One defensible company-fit rule

| Label | Required evidence |
| --- | --- |
| High fit | A matched official source explicitly establishes residential ownership, management or operations. |
| Low fit | A matched official source establishes a business outside that housing focus, such as a software vendor, adviser or commercial-only operator. |
| Fit unclear | Identity or operating model is unconfirmed, evidence is missing, or sources conflict. |

Every classification retains its original quotation and source. Mixed businesses can qualify when their own housing operations are established. Descriptions of clients, software customers or other companies do not establish the submitted company's operations. No retrieved evidence means unclear, never low.

There are no percentage scores, weighted points, size thresholds or inferred buying readiness in the current fit UI. Both a 100-home and a 5,000-home housing operator receive High fit. Portfolio size remains a sourced account fact. Contact role, responsibilities, property context and inquiry remain separate facts for the rep to consider. A relevant contact does not change the company's business model; an unknown role does not lower company fit.

The inbox, header, source explanation, API and CSV use the same categorical result. Sort by category (high, low, unclear), with names as stable ties and unclear last in either direction. This is applicability sorting, not a ranking of conversion likelihood or account value. **Why this fit** exposes the reason and supporting sources. Research status and saved-source dates remain separate.

## Identity and source requirements

Identity v2 uses complete company names on the supplied official domain, explicit self-description or copyright ownership. It handles encoded copyright markers and known appended navigation labels. It does not use fuzzy brand substrings or accept customer-story references as ownership of a domain. Old identity evidence is reevaluated without changing retrieval dates.

Public role verification remains strict: current name/company agreement, an official grounded role, no conflicts or historical/sample-only attribution. Responsibilities must be separately supported. Neither a title nor a property address establishes authority, budget or buying intent. Demographic context, logos and Street View never affect fit.

## Simple, personalized email

The writer uses fixed rules, **not an LLM**. Given the same inputs and evidence, it produces the same text. There is no generative-model fee. The standard intro has one context detail, one short relevant capability and one ask.

1. Prefer a specific, non-negated inbound request (maintenance, after-hours leasing, calls, tours, renewals, payments or inquiry follow-up).
2. Where supported, include one current sourced company detail alongside the inquiry: operating footprint, housing segment, third-party management or a verified operating model. Retain its exact evidence.
3. Add one short, approved capability sentence and a relevant walkthrough invitation. A verified role can adjust the wording of the ask without repeating the title.
4. If company fit is unconfirmed or outside focus, use a brief context question instead of an unsupported operator pitch. If no usable company observation exists, use a basic response. The visible personalization label reflects grounded hooks actually present, not a claim of independently rated email quality.

Public-source observations are omitted when stale, expired, undesignated sample-only or ambiguous. Raw web text and inquiry instructions cannot become promises. No invented pain, installed software, ROI or numerical lift. Portfolio totals stay in the brief. No generic multi-question qualification interview is appended.

Explicit no-need, account-routing, integration blockers and agreed-next-step notes retain their appropriate brief coordination replies. A current buyer-reported measurement may replace the opening when supported; it is never inferred from public research.

Writer v20 distinguishes positive partnership, integration, industrial-property and referral inquiries for sourced non-housing business models. These neutral replies ask for context without promising support. Negated or vague requests retain the generic fallback. The ten researched examples exercise distinct response types through these same production rules.

Example with a specific inquiry:

> Hi Jordan,
>
> Thanks for reaching out about after-hours leasing coverage.
>
> EliseAI can answer leasing questions and help prospects book tours outside office hours.
>
> Would a quick walkthrough of after-hours leasing coverage be useful?
>
> Best,
> [Your name]

Example with a sourced operating footprint:

> Hi Jordan,
>
> I noticed Acme Housing operates across eight U.S. markets.
>
> EliseAI can answer leasing questions and help prospects book tours, with your team handling conversations that need a person.
>
> Would a quick walkthrough of leasing follow-up be useful?
>
> Best,
> [Your name]

Acme Housing and its facts are synthetic examples. Real observations require retained sources. Edited and reviewed drafts are preserved; untouched generated drafts migrate to v20. Nothing sends automatically.

## Versioned facts and assessments

Each saved assessment retains normalized lead inputs, buyer-note provenance, retrieved evidence and dates, contact/property context, categorical result and quotes, exact draft, and the SHA-256 fingerprint of the scoring/writing rules. Assessments are append-only until bounded retention removes old records. They make it possible to compare changes against the evidence available at the time, rather than today’s website.

Generated company/contact hooks carry `fact_ids`, a stored supporting quote, source URL and rendered text. The guard requires IDs and quotations to match the independent fact ledger and the approved observation renderer. An unmatched generated observation becomes a neutral opener or question. Inquiry hooks reference the submitted inquiry rather than pretending to be independently verified public facts. Fixed EliseAI capability copy is reviewed template text. Human edits are retained verbatim and not claimed to pass this automated sourcing check. This prevents the tested unsupported-hook paths; it does not prove that a retrieved page or extraction is factually correct.

Thirty frozen synthetic cases compare labels, reasons, evidence, personalization themes and exact emails against reviewed snapshots on every build. This tests deterministic behavior, not live retrieval coverage or independently rated email persuasiveness. See [quality and pilot protocol](QUALITY_AND_PILOT.md).

## API and compatibility

`company_fit` and `lead_fit` return the same v3 object: label, reason, rank, evidence and research status. Rank is only an ordering key. Numeric compatibility fields (`score`, `max`, `upper`, coverage and unassessed points) are null; CSV equivalents are blank. Top-level `score` is null. Consumers should read the categorical label/model, not treat null as zero.

Earlier rep-qualification calculations remain internal/legacy compatibility data for saved decision notes and explicitly `legacy_*` export columns. They do not drive the current company-fit header or fit sorting. The old 50/30/20 weighted model is retired; archived evaluation numbers describe the version actually tested.

## Interview explanation

“I prioritize explainability over false precision. The fit label answers whether we have evidence that this is a housing owner or operator. Contact relevance and portfolio size are separate facts, so missing research does not punish a potentially good account. The draft is deterministic: one supported detail, one relevant capability and one ask. Reps review it, and I would measure their edits and preparation time before introducing more complexity.”

## Validation boundaries

Regression checks cover source attribution, wrong-company/customer claims, mixed businesses, missing and conflicting evidence, stable category sorting, API/export consistency, deterministic writing, concise single-ask messages and preservation of edits. Captured research and synthetic copy checks are not independent SDR approval or evidence of conversion lift. Live company retrieval remains incomplete; see [the evaluation](EVALUATION.md).


## Transparent review priority (inbound-priority-v2)

Company fit remains the sourced operating-model classification. A separate, rule-based priority tier orders the inbox:

| Tier | Required evidence | Meaning |
| --- | --- | --- |
| High (A) | Housing operator plus an explicit demo request or specific relevant workflow inquiry | Specific inbound request |
| Medium (B) | Housing operator with a general inquiry, no inquiry, or no active need stated | Relevant company; demand not established |
| Low (C) | Sourced company model outside residential ownership/operations | Outside this housing-focused sales queue |
| Needs review | Missing/conflicting identity or operating evidence, an unprocessed lead, or interrupted company refresh | Unresolved, not evidence of low fit |

The deterministic inquiry check uses the submitted inbound message, rejects negated requests and instruction-like text, and saves the matched sentence, rule ID, company evidence and model version. Public company text cannot supply buying intent. Illustrative sample inquiries are labeled. This is a review-order heuristic, not EliseAI's validated ICP, an SLA, a win probability or a substitute for rep judgment. Rare phrasing can be missed; edits to the inquiry recalculate priority. Portfolio scale and sourced roles remain visible context. Corporate email addresses, personal email addresses, market wealth, missing roles and company size add no automatic priority points. An old internal numeric `priority` field remains for compatibility; the UI uses only `lead_priority`.

The 30 golden cases now check priority alongside fit and draft snapshots. Saved assessment history captures the exact input and tier so the pilot can compare meeting and conversion rates by tier without relabeling the past. Compare A and B only among eligible operators; C is a routing category and unresolved cases need separate coverage reporting. Do not present expected value until observed conversion rates and a defensible account-value measure exist.

Matched Census tract context now appears below the submitted property: renter-household share, housing units in 5+ unit structures, and median monthly gross rent with its margin of error. Period and geography are shown. Unmatched, stale and mismatched-tract statistics are omitted, while the Around this property section remains visible with an explanatory state. These are area estimates, not attributes of an individual building, and introduce no causal outreach claim.


## October 1 refinement

Company fit remains categorical (High fit, Low fit, Fit unclear), with separate High/Medium/Low review priority. No numeric lead score is displayed. Missing portfolio size or role does not deduct from fit. These are documented assignment rules, not conversion probabilities or EliseAI's internal ICP.

Draft writer v20 includes one matched, current company observation alongside a relevant inbound topic, a reviewed product capability and one question. Specific requests keep their topic. Historical timeline statements are not used as current company observations. Draft labels distinguish company-personalized, contact-personalized and basic responses based on grounded hooks actually present. Edited or reviewed drafts are preserved and marked for review when context changes.

Company evidence and company URL discovery are cached for seven days within the visitor workspace, across contacts. Contact-specific research, private inquiries and qualification answers are not shared between visitors. Published sample caching remains restricted to the existing allowlist. Retrieval dates are preserved, failed refreshes retain older evidence, and simultaneous lookups use an atomic lease. Caching does not extend a fact's reporting date or establish its accuracy.

## Sourced priority rubric and demo grounding — October 1

The UI uses High priority, Medium priority, Low priority and Needs review. The API retains A/B/C/null as stable tier keys. The v2 rubric saves five questions with each assessment: housing operating segment, submitted inquiry, reported portfolio, current contact function and account relationship. Every public field retains its supporting quote and source; unsupported facts stay open. Segment and inquiry determine the tier. Contact seniority and portfolio do not manufacture buying intent.

Evidence strength is separate: Supported evidence means recent matched operating sources support the decision; Saved evidence means a dated snapshot/expired source; Limited evidence means essential evidence is unresolved. These labels concern the basis for the priority decision, not completeness of all five fields, independent source accuracy, or conversion likelihood. A well-sourced non-fit may have Supported evidence.

Portfolio bands describe reported residential homes only: under 200, 200–999, 1,000–4,999 and 5,000+. Lower-bound claims retain an open upper bound. Mixed beds, buildings, conflicting totals, historical figures and unsupported numbers do not get a comparable home band. Original units, date and quote remain visible. Bands are descriptive context, not points or deployment estimates.

Account status is recorded in buyer notes with a source/check explanation. It requires a server-dated record bound to the exact status and note and less than 90 days old. Unknown stays Not checked; no CRM connection is implied. Existing customers route to the account team, open opportunities to the opportunity owner, and duplicates to review. These are displayed routing labels, not automatic assignments. Account relationship does not reduce priority.

The v20 writer permits recent company facts from explicitly enabled, labeled demo snapshots through the ordinary fact-ID/quote guard. Untouched demo drafts migrate; rep edits remain preserved. Snapshots over 30 days old, stale results and undesignated snapshots cannot personalize. A named operating geography can supply a hook only when the retained operating statement contains that geography. No claim of a fresh fetch is made for saved demo evidence.

Validation: 30 frozen golden cases retained their tier assignments. Intentional metadata/sourced-rubric snapshot changes were reviewed; regression passing is not live retrieval accuracy. `scripts/check-fresh-personalization.mjs --live --origin <site>` creates and deletes one isolated synthetic lead at a real company, checking the production source-to-fact-to-email chain without reading provider keys or resetting allowances.

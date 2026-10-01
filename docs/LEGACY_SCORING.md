# Archived scoring and outreach specifications

Historical reference only. These superseded models do not describe the current interface or primary CSV score. See [current specification](SCORING_AND_OUTREACH.md).

# Current rep-facing company fit

The current model is `housing-company-fit-v1` (`company_fit`). It is a qualitative housing-company fit classification, not buying intent or conversion probability.

- **High fit:** a matched company source explicitly describes residential ownership, management or operations.
- **Low fit:** a matched company source establishes a clearly different business model, such as software vendor, brokerage, advisor or service provider.
- **Needs review:** identity, operating model or conflicting source evidence remains inconclusive. Missing research is not low fit.

No portfolio-size threshold is required. Contact roles, software, operating initiatives and property facts remain useful sourced context. Their absence does not lower company fit. Saved evidence is labeled; supporting quotations and dates remain available. Fit sorting keeps unresolved companies last and breaks category ties by contact name.

This is an assignment assumption focused on the housing business, not EliseAI's validated ICP. Actual prioritization should be calibrated with SDR/AE feedback and outcomes. The numeric approaches below are retained as historical/internal API documentation; they do not drive the current visible fit assessment.

---

# Public-evidence lead assessment

Current display model: `public-lead-fit-v1` · September 30, 2026.

The assignment takes a company, a person and a property. Every lead is evaluated across all three. The UI summarizes each dimension and exposes every criterion and its evidence in Scoring details. No recommended sales actions or qualification coaching are displayed.

| Dimension | Criterion | Weight | Evidence |
|---|---|---:|---|
| Company | Residential operator | 30 | Company-matched sources explicitly describe owning/managing/operating housing. |
| Company | Relevant workflow | 20 | Company-matched leasing/community operating evidence. |
| Company | Apartment-home scale | 10 | 5,000+: 10; 1,000+: 7; 200+: 4; smaller: 1. Old, conflicting or mixed bed/property counts remain unresolved. |
| Contact | Current affiliation | 10 | Current, unambiguous public name/employer/role match, retrieved within 30 days. |
| Contact | Relevant function | 15 | Housing, leasing, property, resident, asset/portfolio operations, technology, finance, procurement, marketing or executive roles. Explicit HR/recruiting/legal functions receive 0 under this MVP assumption; ambiguous functions remain unresolved. No title establishes buying authority. |
| Property | Residential use | 10 | Official company source describes housing at the submitted street address and city. |
| Property | Company relationship | 5 | Explicit company operating claim at that specific address. |

These weights are hypotheses for testing with SDRs, sales leadership and RevOps, not an established EliseAI scoring policy. A score does not measure buying intent, budget, urgency or conversion probability.

Unknown criteria do not count as failures. Example: a fully supported company and no corroborated contact/property facts yields **60–100**, not a low-fit label or an invented 100. The lower endpoint is earned points, the upper endpoint includes unresolved points; this is not a statistical confidence interval. All seven criteria are evaluated, but the evidence-backed count can be less than seven. A complete result has one number. An incomplete result is only labeled High when its supported points already reach 80, and only Low when even its upper endpoint is below 50; otherwise it remains Partial assessment. Unscored leads sort last in both directions. Fit sorting uses supported points, with evidence coverage breaking ties.

A Census match corroborates geography only. It does not establish residential use, company ownership/management, parcel identity or the contact’s association. Market demographics, asking-rent proxies and email domains do not add points. Property corroboration checks retained official company excerpts; it is not a dedicated property registry lookup. Sources must include the street address and city and be recent; corporate offices, sold/former properties, multiple-address paragraphs and saved samples cannot establish property fit. The contact’s connection to the specific building remains unverified even when company management is sourced.

Professional records flagged historical, conflicting, stale or mismatched remain unresolved. Fictional TEST contacts remain unresolved. Current-role evidence is shown with its public source; it is not an independent identity check. Saved company evidence keeps a provisional label. Changing evidence recalculates the assessment; edited/reviewed email wording remains preserved.

Validation covers positive and negative cases for all dimensions, including wrong address/city, office-versus-building confusion, stale and conflicting roles, role-function ambiguity and evidence-poor high-quality companies. Calibrate weights and thresholds against independently reviewed real inbound samples and outcomes before using them for automated routing. Public coverage is measured separately from correctness of accepted facts.

## Legacy compatibility model

The previous combined rubric below remains in stored/API compatibility fields and outreach history. It does not supply the current UI’s score or routing advice.

### Balanced lead priority and outreach

Model: `housing-balanced-v3` · September 29, 2026. The current interface displays the company component scaled to 100. The combined readiness model described below is retained for stored-data/API compatibility; it no longer drives on-page coaching. These weights are assessment assumptions for a housing sales team, not EliseAI's internal qualification rules or a calibrated probability of conversion.

## The sales decision

A rep needs to know: does this company operate housing, is there a relevant workflow, what need did the buyer actually state, who is involved, and what is the next useful conversation? Portfolio size provides context. Geographic reach, logo availability and an address match do not prove a sales opportunity.

The brief and inbox lead with High fit, Potential fit, Low fit, or Fit to review. The score doubles the company rubric below: 80+ is High; 50–79 Potential; below 50 Low; no assessed evidence is Fit to review. The brief shows supported reasons, evidence coverage and source links. The scoring drawer explains only the company criteria. Default sorting is company fit descending, with unassessed contacts last; reps can choose reverse fit, name or newest. Saved evidence is labeled. Buyer-readiness gauges, suggested next actions and conversation coaching are not displayed. Public research is summarized as information for the rep’s judgment.

The table below documents the retained API model. Only its first three company criteria appear in the current product, scaled to 100; the remaining stored fields are preserved for compatibility.

## Point model

| Component | Maximum | Evidence and award |
|---|---:|---|
| Housing operator | 25 | Company-matched sources describe residential ownership, management or operations. |
| Relevant operating workflow | 15 | Housing fit plus leasing/community operations in company sources. This supports potential applicability, not an actual pain point. |
| Apartment-home scale | 10 | At least 5,000: 10; 1,000–4,999: 7; 200–999: 4; fewer than 200: 1. Weight is deliberately small so enterprise size cannot dominate. |
| Buyer-confirmed need | 20 | Rep selects Need confirmed and records the buyer's inquiry/context. Explicit No active need earns 0 and overrides prioritization. |
| Timeline | 15 | Rep records timing and selects within 30 days: 15; within 90 days: 10; later/exploratory: 0. |
| Decision involvement | 10 | Rep records the person's involvement and confirms decision-maker: 10; evaluator/champion: 5. A job title on a website does not establish authority. |
| Initial scope | 5 | Rep records and confirms an agreed initial property/community scope. Company-wide portfolio is not rollout scope. |

Company fit totals 50; buyer readiness totals 50. Merely entering any text, having an inquiry, or completing all four discovery fields does not automatically award readiness. Selections require supporting notes of at least five characters; short/absent notes leave the criterion unassessed. This guards accidental completion, not truthfulness: rep assessments still require review. In the dated-evidence model, points also require server-dated evidence bound to the exact selection and note. Need, timing and scope expire after 30 days; decision involvement after 90 days. Undated legacy assessments, changed input, future timestamps and expired assessments remain unassessed until saved or explicitly reconfirmed.

Each criterion retains a reason, source IDs or rep note, points and maximum. The API computes the score from saved evidence and normalized enum values; it ignores supplied scores. The source drawer exposes the breakdown, and CSV exports total, tier, both components, unassessed weight and model version.

## Missing data and gates

The explanation drawer’s total is **points supported so far**, not “quality percentage.” Unknown criteria contribute no earned points but retain their possible weight as unassessed. A 50/100 with 50 unassessed differs from a fully assessed 50/100. No result is imputed from averages or provider failures, and the next action reflects the gap.

- No company identity match or pending research: unscored, Verify company.
- Software-provider, advisor, brokerage or contractor evidence: Outside housing ICP. Customer workflow descriptions cannot establish owned housing operations.
- Housing operations unestablished: Confirm operating model; a buyer's urgency cannot override the gap.
- Rep explicitly records no active need: No active need, regardless of size or other readiness fields.
- Saved sample, failed refresh or expired freshness: Recheck sources before top-priority promotion.
- 80+ supported points **and** confirmed need, timing within 90 days, evaluator/decision involvement and housing fit: Prioritize conversation.
- 60+ with a confirmed need and housing fit: Qualify next.
- Otherwise with housing fit: Discovery needed.

Company size alone can never create a top-priority lead. A 100-home operator with all readiness confirmed scores 91 and can outrank a large company with no buyer context. A 5,000-home company with no readiness confirmation scores 50 with 50 unassessed. “Prioritize conversation” does not authorize sending an email or imply a won deal.

Size points use apartment-home counts only. Property/community totals and mixed unit-and-bed counts are not converted. Conflicting comparable figures, totals dated more than 18 months ago, future reporting dates, and upper-bound phrases such as “nearly” are unassessed. Undated reported totals retain that limitation in the explanation. Thresholds are hypotheses, not proven product minimums or eligibility limits.

Markets served is now secondary context. One company may report eight markets and another the United States; those are different units and are not converted or ranked. Neither footprint, Census geography, GLEIF name matching nor logo presence changes the priority.

## Draft policy

Draft policy **Rules v7** is deterministic composition from approved language and retained evidence. No paid model, new API key or extra research call is required. The assessment remains focused on housing; EliseAI also serves healthcare, but healthcare qualification is outside the property-based assignment.

The key improvement is support for **the assignment’s minimum inputs**. An inquiry and manual qualification are optional. A researched operator can receive a personalized intro immediately; absent buyer context never becomes invented pain, authority or readiness.

### How the first reply is composed

1. **Honor the relationship and stage.** Existing-account routing, recorded no-need, integration questions and agreed commitments receive appropriate coordination or follow-up wording. An expired no-need assessment asks whether priorities changed.
2. **Identify the topic.** A current rep-confirmed need and workflow takes precedence. Otherwise the inquiry may select missed calls, prospect follow-up, after-hours leasing, tours, maintenance, renewals or payments. Negated clauses and instructions do not become positive needs. A positive clause after “but” can still establish a topic. Topic recognition does not award readiness points.
3. **Select at most one factual personalization.** Prefer a current, relevant buyer-reported measurement. Otherwise select a bounded observation supported by the company’s operating statements: geographic footprint, student housing, affordable housing, or residential operations. The exact excerpt, source link and sentence used are retained with the draft. A matched domain alone is insufficient.
4. **Connect to a useful capability.** With a stated topic, use approved EliseAI capability language. With no stated topic, introduce prospect follow-up as “One area we could explore”—a discovery hypothesis, not a diagnosis or product recommendation.
5. **Ask one question.** A sparse regional lead is asked whether follow-up is shared across markets or handled locally; a student-housing operator is asked about peak leasing periods. With buyer context, the next-action question guides discovery. The message uses a first-name greeting and a rep-editable signature.

Company apartment totals remain in the brief. A market count may be used with its exact qualifier when it explains the discovery question; it does not earn score points. Mixed unit/bed totals are never rewritten as apartment counts. Saved sample, failed-refresh, expired company evidence and known old/future publication dates do not supply asserted company facts in the email. Their retained excerpts can still explain the prior context while the app asks for fresh research. Unsupported or unresolved companies receive a neutral question without a product pitch.

A relevant positive operational baseline can appear only with a current, dated assessment, supporting measurement note, and current confirmed need/workflow. The email attributes it to the buyer (“You mentioned…”). Zero, missing, stale or irrelevant measurements are omitted from persuasive copy; zero remains a valid value in the sales brief. The app does not independently verify rep notes or derive ROI from them.

The default email is intended to stay below 120 words on the evaluated cases, with one question and one capability. It never promises a numerical improvement, invents installed technology, claims an integration is compatible, or treats company-wide units as an agreed rollout. Survey rents, demographics and registry matches are not email personalization. Hand-edited drafts remain the rep’s responsibility.

**Why this reply** explains the composition beneath the editable email. Source controls open the evidence retained with the draft. Untouched older drafts migrate to v7; edited/reviewed wording is preserved and flagged when its context changes. “Update from lead brief” regenerates explicitly. Nothing sends automatically.

### Product language and freshness

The following official product references were checked September 29, 2026. They support the general capabilities used in approved wording, not guaranteed outcomes or compatibility for a particular customer:

- [Prospect Management](https://eliseai.com/prospect-management): responses, follow-up and tour scheduling.
- [Maintenance](https://eliseai.com/maintenance): intake, work orders and routing.
- [Platform overview](https://eliseai.com/platform-overview): renewal follow-up and prospect/resident calls.
- [Delinquency](https://eliseai.com/delinquency): payment reminders and follow-up.
- [Product-specific integration guidance](https://support.meetelise.com/hc/en-us/articles/39523666991501-EliseAI-Supported-Integrations-Per-Product): verify the exact product and edition separately.

Customer case-study outcomes are intentionally excluded from the default pitch. Without a matching implementation, baseline and measurement period they are not a forecast for this buyer. No conversion experiment has validated this wording.

## Sales insights: fact → implication → next conversation

The brief puts a dedicated **Sales insights** section immediately after lead priority, ahead of optional market context:

| Insight | What a rep can do with it | Evidence boundary |
| --- | --- | --- |
| Why this account fits | Establish relevant leasing/resident communication use cases | Cited operating model; no assumed pain |
| Potential scope | Ask about first properties and inquiry volume | Company portfolio is not a rollout or an ARR estimate |
| Conversation hypothesis / confirmed workflow | Select the next useful discussion | Clearly distinguishes public-source hypothesis from rep-confirmed need |
| What is still unknown | Close need, timing, decision and scope gaps | Unknown readiness remains unassessed |
| Property relationship, when an address is supplied | Confirm the submitted property belongs in this opportunity | Census geography does not prove ownership, management or budget |

Every company insight retains source controls. Buyer notes remain separate from company statements. CSV export now includes the insights, draft strategy, rationale and retained draft evidence, so a handoff preserves why the suggested message was written.

## Evaluation and rollout

Automated checks cover threshold boundaries, missing versus negative answers, large-unqualified versus small-ready accounts, software/commercial/negated operations, stale/conflicting/mixed-unit data, source escaping, client score injection, qualification persistence, note requirements and draft preservation. Email checks cover topic relevance, negation, a single question, 120-word maximum on the evaluation set, Unicode names and retained grounding.

Before treating this model as an organizational standard:

1. **Week 1 — RevOps + SDR/AE manager:** label 50–100 historical inbound leads, including closed-lost, disqualified and missing-data cases. Record labels independently of the score. Review the meaning of housing fit and each readiness selection.
2. **Week 2 — Shadow mode:** compare priority order with rep decisions. Measure top-tier precision, missed high-priority opportunities, time to useful reply, missing-data rates and differences by company-size band. Keep a holdout set so tuning is not judged on the training examples.
3. **Week 3 — Small pilot:** 3–5 reps review scored leads and edit drafts. Track acceptance/edit reasons, factual mistakes, wrong-entity matches and actual meeting outcomes. Require an explicit buyer note for readiness; disagreements go to the sales manager rather than a silent model override.
4. **Week 4 — Sales/RevOps sign-off:** approve or revise weights and thresholds. Treat high precision and zero unsupported factual claims in the reviewed launch sample as gates; define quantitative targets with the team after measuring baseline. Version every scoring change and keep a rollback to the prior model.

A passing test suite proves specified behavior on tested cases, not predictive sales accuracy. No actual SDR pilot, interviewer study or historical-outcome calibration has been conducted. The public assessment's visitor sessions expire after 24 hours; production CRM rollout would additionally need authenticated owner controls, durable audit retention and CRM reconciliation. This assessment now records server-dated input changes in its isolated visitor session.


## Deterministic decision layer

See [decision specification](DECISION_RULES.md) for inputs, precedence, review windows, product mapping, evidence limitations and tests. Version `sales-action-v1` runs beside the 50/50 rubric. It never adds numeric points for operational metrics, system names, property demographics, account relationship, logos or buyer-trigger text. Those fields inform the next action and product suggestion only.

Product-specific draft wording uses an explicitly selected, dated buyer workflow and active need. For a qualified new prospect, the draft uses the same next question as the action card. Edited/reviewed wording is preserved and flagged when relevant inputs change.

## Worked email examples

These are **synthetic evaluation fixtures**, not claims about real companies or buyers. Generated directly from Rules v7 using fictional Jordan Lee at Acme Housing. The regional case assumes the provided company excerpt is current and matched; production only makes that observation when the research meets the evidence rules.

### Sparse inbound: regional operator

Supported points: 50; unassessed weight: 50. 60 words.

**Subject: A question about prospect follow-up**

> Hi Jordan,
>
> Thanks for getting in touch with EliseAI.
>
> Your company overview describes housing operations in eight U.S. markets.
>
> One area we could explore is routine prospect follow-up: EliseAI can answer leasing questions and help schedule tours, with staff handling conversations that need a person.
>
> Is prospect follow-up shared across your markets or handled by each community?
>
> Best,
> [Your name]

### Stated resident workflow: maintenance

Supported points: 50; unassessed weight: 50. 62 words.

**Subject: A simpler maintenance handoff**

> Hi Jordan,
>
> Thanks for the context on maintenance requests.
>
> Your company overview describes housing operations in eight U.S. markets.
>
> EliseAI can capture maintenance requests and route them to your team, so residents have a clear way to raise an issue and staff can handle the next step.
>
> Which of your markets would be in scope for an initial rollout?
>
> Best,
> [Your name]

### Current buyer measurement: missed calls

Supported points: 70; unassessed weight: 30. 50 words.

**Subject: Covering missed calls**

> Hi Jordan,
>
> Thanks for sharing the context. You mentioned 25 missed calls in a week.
>
> EliseAI can cover routine prospect and resident calls when your team is unavailable, while keeping those conversations organized for follow-up.
>
> Which of your markets would be in scope for an initial rollout?
>
> Best,
> [Your name]

### Unknown operating model

Supported points: 0; unassessed weight: 50. 16 words.

**Subject: A quick question about your inquiry**

> Hi Jordan,
>
> Thanks for getting in touch with EliseAI.
>
> What prompted your inquiry?
>
> Best,
> [Your name]

## Why use rules for this assessment?

The value comes from selecting relevant evidence and a useful next question. Bounded composition keeps this free-API implementation reproducible and makes every asserted company fact traceable. Its limitation is variety and nuance: it does not interpret arbitrary news, infer a buyer’s role, or reason through ambiguous intent. A production LLM could be a controlled rewriting step over the same approved facts and capability catalog, with a schema, sentence-level evidence checks, a deterministic fallback, evaluation on held-out examples and human review. It should not decide scores or invent qualification data. No LLM service or automated sending is configured here.

## Company-fit-first display

The headline and inbox badge show automatic company fit out of 100 (the 50-point company rubric subtotal doubled), not combined points out of 100. Unknown readiness is a qualification task, not a failed enrichment or zero score. Explicit no-need remains an assessed zero. CSV exports separate score maxima and leaves unknown readiness blank; the legacy `priority_score` column retains combined routing points for compatibility. No weights, gates or queue routing changed.


## Draft and recovery update

Writer v8 uses a workflow-specific question for calls, maintenance, renewals, payments, after-hours coverage and tours when the current workflow has not been recorded. Before company verification it can acknowledge the stated topic and ask a question, but does not assert company facts or product applicability. Edited and reviewed drafts remain preserved; untouched older drafts migrate.

Company research continues from a thin matched homepage to observed official links, domain-restricted search results, then conventional official overview paths. The four-attempt and 26-second limits remain in place, including discovery requests. Provider throttles, auth failures and quota limits still stop retries. Search summaries never become evidence; accepted page content must pass the existing source and identity checks. Property, area and registry lookups continue independently.

> Compatibility specification: this document describes the retained buyer-qualification and outreach decision layer. It does not define the current visible company-fit score or default fit sorting. See [current scoring and sales outputs](SCORING_AND_OUTREACH.md).

# Sales decision specification

September 29, 2026 · Score `housing-balanced-v3` · Actions `sales-action-v1`

## What is deterministic

The same normalized lead, retained company evidence, server-owned assessment metadata and evaluation time produce the same score and action. No LLM, randomness or external request is involved in evaluating a lead. Time is an explicit input because evidence expires and commitments become due. A provider outage changes available evidence; it is not randomly interpreted as poor company fit.

Deterministic does not mean predictive or independently verified. Public website extraction is heuristic. Rep selections and notes are human assessments. The weights and freshness windows below are documented pilot assumptions, not EliseAI's internal rules or a probability of closing.

## Scoring, kept separate from work routing

| Component | Maximum | Evidence |
| --- | ---: | --- |
| Housing operator | 25 | Company-matched residential ownership / management / operating evidence |
| Relevant workflow | 15 | Leasing or community operations in matched housing sources |
| Comparable apartment-home scale | 10 | 5,000+: 10; 1,000+: 7; 200+: 4; below 200: 1 |
| Active need | 20 | Rep-confirmed need with a supporting inquiry |
| Timing | 15 | Within 30 days: 15; within 90: 10; later: 0 |
| Decision involvement | 10 | Decision-maker: 10; evaluator/champion: 5 |
| Starting scope | 5 | Rep confirms an agreed scope and records it |

Unassessed criteria retain their possible weight. Unknown does not become a negative answer, a positive default or an average. An entirely unassessed component displays a dash. Raw totals mean supported points so far, not a quality percentage. A company identity must be established before displaying a total. Size, legal records and neighborhood information cannot establish buying readiness.

Top qualification requires at least 80 supported points, housing fit, current company evidence, active need, a timeline within 90 days and evaluator/decision involvement. At least 60 plus a confirmed need qualifies for further discovery. Explicit no-need, software-provider evidence, unresolved operating model and stale company evidence have separate gates. All boundaries and size exclusions remain in [SCORING_AND_OUTREACH.md](SCORING_AND_OUTREACH.md).

## Evidence requirements and freshness

Readiness requires an allowlisted selection, at least five characters of supporting note, and a current server-owned assessment timestamp bound to the exact note/selection. Five characters is an accidental-completion guard, not semantic validation.

| Assessment group | Review window | Required supporting fields |
| --- | ---: | --- |
| Need, timing, scope | 30 days | Selection + corresponding buyer note |
| Decision involvement | 90 days | Selection + role/decision-team note |
| Workflow | 30 days | Catalog selection + buyer evidence |
| Operational baseline | 30 days | Metric + nonnegative numeric value + source/period note |
| Integration | 30 days | Workflow, PMS/CRM, edition, status, official reference and check note |
| Account relationship | 90 days | Status + account-record check note |
| Buyer trigger | 30 days | Buyer-confirmed event note; event date is optional |
| Commitment | 30 days | Specific next-step note, owner and valid calendar date |

Zero is a valid measured value. Units come from the chosen metric. The app does not derive ROI, rent, revenue, conversion or savings from these inputs. Contextual measurements do not add score points.

Saving a changed group records its server time. Changing another group does not renew it. An explicit reconfirm checkbox renews recorded groups after the rep checks them again. Undated legacy values, future timestamps, changed inputs and expired assessments remain available as notes but do not earn readiness points. A note change made through lead-details editing invalidates the old need assessment until the buyer assessment is saved again.

Changing company, email or company website clears buyer assessments and their history. An integration check is reset if its workflow, PMS/CRM or edition changes. Company research uses its existing freshness cache; buyer assessments use the independent windows above. Displayed decisions update when saved state is loaded; this is not an unattended reminder service.

## Product mapping

| Rep-confirmed workflow | Suggested product |
| --- | --- |
| Prospect follow-up | LeasingAI |
| Tour coordination | LeasingAI |
| Missed prospect / resident calls | VoiceAI |
| Maintenance requests | ResidentAI · Maintenance |
| Renewal follow-up | ResidentAI · Renewals |
| Payment follow-up | ResidentAI · Delinquency |

A product suggestion additionally requires housing fit, current company research and a current confirmed need. Website keywords, a company name or a free-text inquiry alone cannot activate this mapping. This is a proposed discovery direction; it is not a technical solution certification. General product families are supported by [EliseAI's platform overview](https://eliseai.com/platform-overview).

Compatibility is recorded separately for the selected workflow and exact system edition. An official HTTPS reference, status and note are required to display a checked result. Exact allowed hosts: `eliseai.com`, `www.eliseai.com`, `support.meetelise.com`. The app does not read that reference or confirm its applicability automatically. Product and edition support must be checked against [current EliseAI integration guidance](https://support.meetelise.com/hc/en-us/articles/39523666991501-EliseAI-Supported-Integrations-Per-Product), including any authentication or product-specific prerequisites. No vendor-name-only compatibility list is embedded.

## Ordered next-action policy

First matching rule wins:

1. **Existing customer / open opportunity / duplicate selected:** route to the relevant account record. Without current supporting evidence, recheck the relationship before new outreach. No CRM is connected; these are rep-recorded classifications.
2. **Company research unavailable:** keep research pending. **Unresolved identity:** verify the company.
3. **Housing operations unestablished:** confirm the operating model.
4. **Current no-active-need assessment:** nurture / agree whether to revisit.
5. **Stale company sources:** refresh the evidence before advancing.
6. **Integration blocker selected:** resolve the question; incomplete or stale supporting evidence must be reconfirmed.
7. **Current, complete commitment due or overdue:** follow up today.
8. **Current, complete commitment in the future:** follow the agreed next step; do not replace it with an immediate new-reply recommendation.
9. **Top qualification + account checked as a new prospect:** respond today. Choose the next question from workflow → integration → operational baseline → remaining discovery. Recorded system/edition names are acknowledged rather than requested again.
10. **Top qualification without an account check:** confirm ownership before outreach.
11. **Otherwise:** qualify next using the most relevant missing discovery context.

Due dates are calendar dates in `America/New_York`, tested across a UTC date boundary. They change the action, not the score. Queue ranks are due commitment 6; qualified new reply 5; existing account/opportunity routing 4; discovery, planned commitments, integration or ownership checks 3; nurture or stale evidence 2; identity / operating-model / unavailable research 1; duplicate review 0. Ties use unreviewed drafts, qualification tier, supported points and creation time. No email is sent automatically.

## Explanation, retention and export

The main card contains the action, fit/readiness components, proposed product and next step. The evidence drawer exposes the full rubric, criteria, company-source links, assessment dates and expiry status, routing order and latest five assessment changes. The server retains ten changes, including before/after inputs, in the same visitor-scoped lead record. The CSV exports these alongside rule versions, next action, product basis, system context, metrics, owner and due date.

The public assessment retains visitor workspaces for 24 hours. Server-owned provenance prevents clients from supplying their own scores or timestamps, but it does not authenticate the rep or prove the truth of a note. This is not an organization-wide audit log or CRM integration.

## Validation and rollout gate

Automated cases cover replay determinism; missing versus negative evidence; score thresholds; all six product mappings; stale, future, changed and undated assessments; harmless edits versus reconfirmation; account routing; integration prerequisites and resets; commitments and timezones; numeric zero and malformed values; absence of context-based score inflation; source escaping; CSV formula protection; provenance injection; visitor isolation; record persistence; research-call counts and draft preservation.

These checks establish rule correctness, not predictive accuracy. Before organizational rollout, independently label 50–100 historical leads with RevOps and sales, freeze a holdout set, run in shadow mode and measure priority precision, missed opportunities, time to a useful response and rep overrides. Review outcomes by company size and missing-data coverage. Preserve the original labels; version any weight or gate changes. That sales calibration has not been performed for this assessment.

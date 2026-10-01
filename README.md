# Inbound Desk

An independent EliseAI GTM Engineer assignment: turn a sparse inbound lead into a sourced company/contact brief, an explainable company-fit label and review priority, and an editable outreach draft.

[Open the assessment](https://inbound-desk-assessment.henrydegrasse.chatgpt.site/). This is an interview MVP, not EliseAI's internal system.

Updated October 1, 2026. Current behavior: categorical fit, High/Medium/Low priority, deterministic writer v20, Jina + optional Tavily research, and cached property context.

## Try it

1. Add a lead or import Excel, CSV or TSV. Name, email and company are required; company website, inquiry and property address improve context.
2. Research starts automatically. Read the completion status and sourced facts, then open **Why this fit**.
3. Review **Email draft**, edit and copy. Nothing sends automatically. Edited/reviewed drafts survive research refreshes.
4. For unattended intake, connect a Google Sheet using the generated Apps Script and one-time Google authorization.

**Try 10 researched examples** loads nine records from the October 1 Sheet snapshot plus an explicitly synthetic contact/integration inquiry at Yardi, a sourced software-vendor non-fit. Four inquiries are illustrative; six are blank. Medium- and Low-priority demo leads have no inquiry context. Nine entries retain submitted property addresses; the vendor has none. Dated public evidence drives the same fit, priority and outreach engine. Recent enabled demo evidence may supply a grounded email hook, labeled **Saved demo research**. Loading examples uses no provider credits. This is a curated demo, not a live Sheet mirror; Sheet inputs and real imports are preserved. [Scenario guide and provenance](docs/RESEARCHED_EXAMPLES.md).

## What the tool does

- Company and contact checks run together. Relevant account facts include operating model, reported portfolio, markets, housing focus, explicit workflows/software and dated developments when supported.
- Contact briefs retain public roles, documented responsibilities and source links. Titles do not establish purchasing authority.
- A submitted U.S./Puerto Rico property can receive Census geography and local market context. Address matching does not verify the building, ownership or the contact's connection to it.
- The interface distinguishes running, finished, limited-evidence, interrupted and input-correction states. A finished attempt can still lack facts.
- Research and source dates are retained; failures preserve saved facts and draft edits.
- **Around this property** appears on every lead. It uses the submitted address, never a company headquarters as a substitute. Missing, ambiguous, unavailable and unsupported locations have explicit states.
- The property card shows the submitted address and an embedded, keyless Google Street View panorama near fresh, valid Census coordinates. Existing address-bound selected panoramas remain supported. A differing street number or stale/invalid match suppresses automatic imagery. Without usable coordinates or a saved panorama, a short unavailable state appears. Imagery may be nearby or older; it does not verify the exact building or ownership. No embed-code setup form is shown.
- Matched-tract statistics show renter-household share, homes in 5+ unit buildings, and median monthly gross rent with its margin of error, source and ACS period. These are neighborhood estimates, not building facts. Maps, demographics and logos never affect fit, priority or email claims.

## APIs and free-use boundary

| Source | Contribution | Boundary |
| --- | --- | --- |
| Jina Reader, Search and embeddings | Read official pages; optionally discover URLs and rank passages | Shared finite free allowance. Search summaries never become evidence. |
| Tavily basic search and extraction | Optional fallback URL discovery and official-page extraction | Dedicated free-plan key, verified usage limits and a separate app cap; no paid fallback. |
| U.S. Census geocoder | Submitted-address geography | U.S./Puerto Rico; no ownership or property-use verification. |
| Census Reporter | ACS tract-level rental-market context | Dated survey estimates, not property facts; no fit points. |
| GLEIF | Optional exact-name legal-entity candidate | Does not verify the contact, domain or property. |

Official websites supply company and professional evidence. Optional Jina Search and embeddings discover/rank passages; search snippets cannot become evidence. Optional Tavily basic search and page extraction require a dedicated free-plan key. Every request verifies the free plan and disabled pay-as-you-go; an atomic, non-renewing app allowance also applies. There is no paid enrichment connector or generative LLM service. Exa is disabled.

`JINA_FREE_API_KEY` is an optional server-only secret. With `JINA_TOKEN_ACCOUNTING=1`, the app verifies the provider’s free-only wallet through a read-only authorization endpoint, then creates a non-renewing allowance of at most 8M tokens (leaving a minimum 100k buffer). Each request reserves 20k; successful provider-reported usage releases the unused portion. Failed or unmetered calls retain their reservation. Concurrent requests share an atomic ledger. The legacy 400-attempt limit remains available when this rollout setting is off. No purchases or top-ups are implemented. Hosting/account charges are separate. See [provider controls](docs/FREE_APIS.md).

`TAVILY_FREE_API_KEY` is also server-only. The app accepts a verified Researcher/free account with a provider plan ceiling of at most 1,000 credits, no pay-as-you-go usage, and disabled/unset pay-as-you-go limits. It keeps a 10-credit buffer and reserves two credits per attempt against a **400-credit non-renewing app cap**. Failed requests keep reservations. Six attempts per minute are allowed globally. These are conservative app reservations, not final provider billing; the cap does not automatically reset when the provider allowance renews. Neither key belongs in the browser, README or repository.

## Fit and outreach

Current model: **housing-fit-v3**. High fit means sourced residential ownership or management. Low fit means a sourced business outside that focus. Missing or conflicting evidence means Fit unclear. Each label links to its reason and supporting quotes. No percentage or weighted-point score is shown.

Portfolio size, contact relevance, property context and buying intent remain separate. Missing optional research does not lower company fit. Fit sorting uses category, then name. The priority label has a separate evidence-strength label and five sourced questions under **Why this priority**. A separate priority sort uses the following review-order rules; neither predicts closing probability. [Fit and outreach specification](docs/SCORING_AND_OUTREACH.md).

| Priority | Rule |
| --- | --- |
| High (A) | Sourced housing operator with an explicit demo request or specific relevant workflow inquiry. |
| Medium (B) | Sourced housing operator with a general inquiry, no inquiry, or no active need stated. |
| Low (C) | Sourced business outside the residential owner/operator focus. |
| Needs review | Company evidence is unresolved, unprocessed or its refresh was interrupted. |

Priority model: `inbound-priority-v2`. Interest comes from the submitted inquiry, not public web text or a job title. Synthetic sample inquiries are labeled. There are **no numeric lead scores** in the current interface. Legacy numeric assessment fields remain only for compatibility and saved decision notes; consumers should use `company_fit` and `lead_priority`.

Writer **v20** is deterministic: the same inputs produce the same message, with no LLM call. It keeps the stated inquiry's topic and, when supported, includes one current sourced company observation, a relevant EliseAI capability and one question. Without an inquiry, it writes introductory outreach using supported company context or a basic discovery question, without claiming prior contact. Historical timeline statements are excluded from current-company observations; portfolio totals are not recited in emails.

Visible labels distinguish **Company-personalized**, **Contact-personalized** and **Basic response**, based on grounded hooks actually present. A label indicates evidence use, not independently validated persuasiveness. Non-housing partnership, integration, industrial-property and referral inquiries receive appropriate clarification without implying compatibility. No invented pain, authority, ROI or numerical lift. Nothing sends automatically. Edited/reviewed drafts stay intact and may be marked for re-review; untouched generated drafts update to the current writer.

## Caching and credit conservation

| Cached item | Freshness window |
| --- | --- |
| Company evidence and company URL discovery | Up to seven days |
| Contact research and contact pages | 24 hours |
| Census address match and GLEIF candidate | 24 hours |
| Census tract statistics | Seven days |

Contacts at the same company reuse company research within their visitor workspace. Addresses/tracts reuse their own cached lookups. Atomic leases deduplicate overlapping research. Cached results keep their original retrieval date; failed refreshes retain older evidence and respect cooldowns. **Refresh lead may reuse fresh cache**, rather than forcing new provider calls.

Private visitor caches do not cross workspaces. Only allowlisted published examples can share cached public research. Cache freshness does not extend session retention: a normal workspace expires after 24 hours, while a Sheets-connected workspace can persist for 90 days. A recent retrieval date does not make an old published fact current.

## Google Sheets architecture

`Sheet → Apps Script trigger → authenticated Worker endpoint → D1 lead record → server enrichment → saved brief and draft`.

The sheet-bound script installs edit, form-submit and five-minute triggers. It sends complete rows in batches of 25 (up to 100 per run), marks delivery only after acknowledgment, and requests processing of up to three queued leads per run. The timer catches API-written rows and continues when the website is closed. The server independently validates and deduplicates email/company/property identity.

Intake is one-way; a separate review loop writes generated drafts and fit back to the sheet and accepts “Would send” / “Would not send” feedback bound to the exact draft revision. This is not general CRM synchronization. Existing rows/drafts are not overwritten by repeated import. A token is scoped to one spreadsheet, tab and workspace, stored as a hash on the server, and revoked on disconnect/replacement. Connections expire after 90 days. The sheet tab is limited to 1,000 data rows/100 columns; the workspace holds at most 100 leads. No Gmail integration remains.

Manual/file intake uses a browser queue with bounded retries and resumes when the page is open. Google Sheets supplies the unattended scheduler; no separate 9 a.m. job is configured.

## Quality controls and operational history

- `pnpm eval:golden` replays 30 synthetic golden cases, compares fit/evidence/email snapshots, and exits nonzero on a failure or unexpected change. `pnpm build` runs this gate too. Inspect the HTML report in `.quality-reports/` before intentionally accepting a change with `pnpm eval:approve`. Never approve to conceal a regression.
- **Sources → Run log & saved assessments** shows source outcomes, recorded last success, durations, and frozen scoring inputs, evidence, rule fingerprint, exact draft and rep feedback.
- Generated personalization hooks require stored fact IDs, matching excerpts and approved rendering. Invalid hooks fall back to neutral wording. Rep edits remain separate and are not automatically certified.
- Existing Sheets users: **Import leads → Google Sheets → Update script for draft reviews**. Replace Code.gs in the same project and run `installInboundDesk`. It reuses the saved connection; do not reconnect or rotate the key. New review columns are appended without replacing lead columns.
- **GEPA experiments:** `pnpm gepa` runs the real optimizer offline over bounded email wording options, with training/validation separation and release checks. Default mode uses no model API; optional local-model reflection is available. Candidates produce review reports and never auto-publish. [Setup and executed result](docs/GEPA.md).
- [Quality controls and pilot protocol](docs/QUALITY_AND_PILOT.md) explains the evaluation workflow, retention, operational limits and controlled sales pilot.

## Security and limits

Each browser session gets a server-isolated workspace on shared infrastructure. Cookies are HttpOnly, Secure and SameSite=Strict. Normal workspaces expire after 24 hours; connecting Sheets extends them to 90 days. Clearing cookies loses access. There is no signed-in account recovery or shared-team access yet. Use approved demo data. [Security details](WEBSITE_SECURITY.md).

Public-source matching is heuristic. Provider outages, robots restrictions, JavaScript-only pages and incomplete websites limit coverage. Research completion does not mean every desired fact was found. Portfolio extraction recognizes apartments, residences and adjacent statistic blocks, keeps retail area and development totals separate, and retains conflicting totals with source provenance. Undated pages, geographic scope and published contact roles can still require review. See [portfolio extraction rules](docs/PORTFOLIO_EXTRACTION.md). Source links and human review remain necessary. No paid enrichment, generative LLM, Gmail sending, news feed or automatic CRM synchronization is included. Real-world SDR time savings and conversion impact have not been measured.

## Run and verify

Node.js 24 and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm preview
```

Local preview: `http://127.0.0.1:8765/`, disposable database and no external provider calls. `PREVIEW_PORT=8781 PREVIEW_RESEARCH_MODE=fixture pnpm preview` demonstrates delayed synthetic research. Local fixtures are not live performance evidence.

The public site runs `website/worker.mjs` on Cloudflare Workers with D1. Apply committed `drizzle/` migrations. Configure runtime settings privately through the host, using `.env.example` as documentation:

| Setting | Purpose |
| --- | --- |
| `PUBLIC_ORIGIN` | Exact deployed site origin. |
| `RATE_LIMIT_SALT` | Secret used by request-abuse controls. |
| `JINA_FREE_API_KEY` | Optional dedicated free-credit Jina secret. |
| `JINA_TOKEN_ACCOUNTING=1` | Enable verified free-token accounting for the Jina key. |
| `TAVILY_FREE_API_KEY` | Optional dedicated free-plan Tavily secret. |

The local preview does not load these secrets or contact live providers. Never commit real keys. `.openai/hosting.json` identifies this existing Site. Build output: `dist/server/index.js`.

## Live test observations

On October 1, a 12-company development recheck of **version 87** with Jina and Tavily configured produced 10 correct operating-model classifications, two unresolved results and no wrong classifications. Two of four named-contact roles were found, both verified. Tavily supplied extracted evidence in three cases; provider evidence can overlap. The median processing time was about 20 seconds. The same companies had seven correct classifications in an earlier run, but intervening code changes mean this was **not an isolated API A/B test**.

That run also exposed inaccurate/undated portfolio extraction and drafts that did not use company-specific research. The later v17 writer was replayed offline against the captured evidence: four drafts included grounded company observations; the rest remained basic responses. This replay spent no additional research credits and does not establish fresh retrieval accuracy or sales effectiveness. The small, selected development sample is not a population-wide accuracy estimate or a calibrated lead score.

## Evaluation and deliverables

- [Research reliability repair](docs/RESEARCH_RECOVERY.md): token-accounting fixes and the latest live company/contact coverage tests.
- [Current evaluation](docs/EVALUATION.md): controlled tests, fresh first-pass evaluation and honest limits.
- [Rollout and video script](design/DESIGN_SCRIPT.md): four-week plan, stakeholders, acceptance gates and 9–11-minute walkthrough.
- [Release checklist](RELEASE_REVIEW.md).
- `scripts/benchmark-quality.mjs --live`: explicitly opt-in anonymous first-pass test against the frozen inputs in `test-data/quality-holdout-inputs.json`; never accesses production visitor data or credentials.
- `scripts/package-submission.py`: creates the allowlisted reviewer ZIP with a source manifest and credential scan.

Earlier benchmarks in `test-data/` and historical validation documents are labeled observations of their respective versions, not current population-wide accuracy. The 5–15-minute narrated video and independent SDR review remain separate human deliverables.

## Code map

`website/`: API, extraction, scoring and drafting. `static/`: interface and intake. `db/` and `drizzle/`: persistence. `tests/`: regression/integration checks. `scripts/`: preview, evaluations and packaging. `test-data/`: labeled fixtures and recorded results. Historical Python server/tests are not production and are excluded from the reviewer ZIP.

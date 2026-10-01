# Automation and sales context

September 30, 2026. This is an implementation review and desk-research hypothesis, not a claim that SDR interviews have been conducted.

## What runs automatically

Manual intake and file imports mark each new lead pending. Company/address edits requeue that record; saved buyer-context changes already refresh untouched drafts without an external API call. The visible browser processes one record at a time, eleven seconds between starts, preserving edited drafts. Provider cooldowns and an initial attempt plus two automatic retries bound failures. Duplicate imports remain skipped, not silently merged.

Pending flags live in the visitor’s database records. Returning to the same unexpired session resumes pending work. Closing or hiding the browser pauses dispatch; a request already underway may finish. Browser sessions expire after 24 hours; connected Sheets use a separate 90-day workspace/connection lifecycle. This upload/edit trigger satisfies the assessment’s trigger alternative.

Google Sheets also supports unattended ingestion through the user-installed Apps Script: edit/time triggers send rows to a scoped webhook, deduplicate imports, and process a bounded batch. The browser does not need to stay open for those Sheets requests. See [README](OPERATING_GUIDE.md) for that separate path.

**No 9 a.m. application-wide schedule is configured.** The current Sites tools do not expose a scheduler, and the public app has visitor-scoped, temporary workspaces rather than a persistent sales-team account. A production daily job needs a persistent workspace, authorized service writer and cloud scheduler. It should enqueue stale records at 9 a.m. in a named IANA timezone (for example America/New_York), honor daylight saving time, deduplicate per workspace/date, and retain the existing provider budgets. A browser clock is not an unattended scheduler.

## What area data means

The matched property’s Census tract is queried through the [Census Reporter API](https://github.com/censusreporter/census-api/blob/master/API.md), an independent distributor of U.S. Census ACS data. The actual release is retained; the live checks returned **2020–2024 five-year estimates**.

| Measure | Definition | Sales use |
|---|---|---|
| Median gross rent | B25064; monthly rent plus tenant-paid utilities, for cash-rent units. Published 90% margin of error shown. | Prepare a market conversation. Never present it as current asking rent. |
| Renter share | B25003; renter-occupied / all occupied units. | Understand the surrounding housing market, not this operator’s portfolio. |
| Housing mix | B25024; housing units in 1-unit, 2–4-unit and 5+-unit structures, plus other types. | Frame questions about the operator’s actual asset mix. |
| Rent cost burden | B25070; households spending 30%+ of income on gross rent / households with a computed ratio. | Ask about resident payment communication without inferring delinquency. |

Missing or suppressed estimates remain unknown. Each percentage uses its stated universe; rounded chart values may not sum to exactly 100%. Source estimates and margins of error remain accessible. Area data does not affect scores or email claims.

## Restrictions are a separate verification task

There is no reliable single count of “rent restrictions” for an address. Rent-increase rules, local ordinances, property exemptions, income eligibility and recorded affordability agreements are different checks. The app provides official North Carolina/Washington guidance where relevant, plus [HUD LIHTC records](https://www.huduser.gov/lihtc/) and [HUD multifamily tax subsidy resources](https://www.huduser.gov/portal/datasets/mtsp.html).

The app has **not** established current asking rent, legal rent caps, income eligibility or the number of restricted units for a submitted property. HUD LIHTC data covers one program and can lag current conditions; no match never proves unrestricted status. The older HUD ArcGIS layers inspected during this work were not integrated as current restriction counts.

## Highest-value next facts for EliseAI reps

These priorities are an inference from EliseAI’s [affordable-housing workflows](https://eliseai.com/asset/affordable) and [resident payment workflows](https://eliseai.com/delinquency), plus the assessment’s sales task. Validate them with SDRs and RevOps before adding more dashboard fields.

1. **Initial rollout size and asset type:** properties, units, markets; conventional, affordable, student or single-family. Use a buyer-confirmed scope, not total global portfolio size.
2. **Existing PMS/CRM and integrations:** which systems own prospect, resident and payment records; who approves access. Capture this in Current workflow & tools.
3. **Operational workload and baseline:** monthly inquiries, after-hours share, response time, tours booked and staff time spent answering repetitive questions. Obtain from the buyer or authorized CRM, not area demographics.
4. **Business problem and success measure:** leasing response, renewals, maintenance triage, eligibility questions or payment follow-up. Agree on one measurable pilot result.
5. **Decision process and timing:** evaluator, sponsor, procurement/security reviewers, budget owner and target start. These buyer-confirmed facts support opportunity qualification; they do not add public-fit points.

For this assessment, a useful question beats an unsupported number. Public research establishes company and market context; discovery establishes the opportunity.

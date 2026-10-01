# Research reliability repair — October 1, 2026

Two application defects were identified from code inspection and live provider responses:

1. **Attempt count was treated as token exhaustion.** The application reserved 20,000 tokens for every attempt and stopped permanently at 400 attempts without reconciling actual usage. The existing dashboard still displayed unused credits. The replacement key was independently verified through Jina’s read-only authorization endpoint: 10,000,000 trial tokens, zero purchased tokens, no saved payment method, and no auto-recharge flag. No key is stored in this repository.
2. **Full HTML exceeded the per-request budget.** `markdown,html` returned HTTP 409 `BudgetExceededError` on the same official company page that succeeded with `markdown`. The observed intended charge was 82,412 tokens for the combined response; readable text succeeded with 4,688 reported tokens. Company research now requests Markdown. Branding retains its own bounded direct HTML fetch.

The new ledger initializes only after free-wallet verification. Its fixed ceiling is at most 8M tokens and leaves at least 100k tokens outside the allowance. Each request atomically reserves 20k tokens; successful usage settles exactly once. Failed or unmetered calls retain their full reservation. No daily resets or purchases occur. The old attempt counter remains intact. The app’s remaining allowance is explicitly not the provider’s current balance.

Additional changes prioritize operating divisions and company-story pages over awards, recognize explicit rental-home management and named property-management services, and reconcile a generic title with a department-specific title on current official employer pages. Distinct departments remain review cases. Source attribution, company/contact separation, edited-draft preservation and private workspaces remain enforced.

Validation: all 30 golden snapshots passed unchanged. Unit and integration checks cover concurrency, settlement, malformed balances, free-only verification, preserved old counters, corrected Reader request format and a successful cold lead past the legacy cutoff. The live evaluation below is separate from regression tests. A development recheck does not constitute independent accuracy; a new set is measured without tuning against its outputs. No emails are sent. Benchmark workspaces are isolated and deleted.

Live results follow. Earlier benchmark evidence remains in `test-data`; intermediate diagnostic runs are not final-version accuracy measurements.


## Guard added after the live evaluation

The untouched first pass exposed one false software-vendor label: Alpine Property Management’s description said that owners had access to software for tracking cash flow. That portal feature does not establish a software business. A final guard rejects this unsupported inference; a separate explicit vendor statement can still establish software fit.

Replaying all 42 archived leads through the final presentation/scoring path changes only Alpine, from a false non-operator label to unresolved. It does not manufacture a positive housing classification. The 30-case replay stays at 23 correct, seven unresolved and zero wrong labels. The 12-case replay remains six correct, now six unresolved and zero wrong labels. These are development replays, not another live or independent test. The original first-pass result, including its wrong label, is preserved below. [Replay evidence](../test-data/research-portal-guard-replay.json) · [Reproduction script](../scripts/replay-research-guard.mjs).

The release therefore repairs provider access and this false-label case; it does not establish 95% classification. Matched company source pages were available for 28/30 development cases and 11/12 previously unused cases. Interpreting those pages remains the main gap, especially for smaller managers, compound operating descriptions, and rebranded companies. The new local-manager subset produced zero correct classifications out of four. Contact roles matched five of nine on the development subset; fresh ordinary-contact and property accuracy were not tested. Independent human email review remains outstanding.

## Preserved live results — version 85

| Run | Correct classifications | Wrong | Unresolved | Matched public roles | Median / p90 attempt |
| --- | --- | --- | --- | --- | --- |
| 30-company development recheck | 23/30 | 0 | 7 | 5/9 | 20s / 33s |
| Untouched 12-company check | 6/12 | 1 | 5 | Not tested | 24s / 42s |

The earlier live development recheck returned 16/30 correct, one wrong label and 13 unresolved; the subsequent 19/30 result was an archived-evidence replay, not a live run. The new live recheck must not be conflated with the untouched set.

These are company-classification results, not buyer conversion, property accuracy or human email-quality scores. The 30 companies informed development and are not an independent test. The 12-company set was frozen before application calls and was not used to tune this release; it is still a small convenience sample. Unknown cases stay unknown. Synthetic inquiries and reserved email addresses were used. All benchmark visitors were deleted. Role coverage uses the same strict normalized name/title comparison as the earlier benchmark, with a current complete match required; retrieved variants are listed below for review.

Each case receives one processing attempt. Queued or unresolved results count as misses; automatic later retries are not measured. Attempt duration is not a promise of complete research. These runs returned 0 claimed role matches for the synthetic TEST-name negative controls.

| Run | Cohort | Correct / all |
| --- | --- | --- |
| Development 30 | large | 7/10 |
| Development 30 | local | 8/10 |
| Development 30 | nonfit | 8/10 |
| Untouched 12 | large | 3/4 |
| Untouched 12 | local | 0/4 |
| Untouched 12 | nonfit | 3/4 |

### Development cases

| Company | Expected | Actual | Result |
| --- | --- | --- | --- |
| Willow Bridge Property Company | housing_operator | housing_operator | Correct |
| RPM Living | housing_operator | housing_operator | Correct |
| Asset Living | housing_operator | housing_operator | Correct |
| UDR | housing_operator | housing_operator | Correct |
| Avenue5 Residential | housing_operator | housing_operator | Correct |
| Cortland | housing_operator | housing_operator | Correct |
| Hawthorne Residential Partners | housing_operator | unresolved | Unresolved |
| HHHunt | housing_operator | unresolved | Unresolved |
| S.L. Nusbaum Realty Co. | housing_operator | housing_operator | Correct |
| Weidner Apartment Homes | housing_operator | unresolved | Unresolved |
| Nestwell Property Management | housing_operator | housing_operator | Correct |
| Acorn + Oak | housing_operator | housing_operator | Correct |
| Oak City Properties | housing_operator | housing_operator | Correct |
| Parkwood Property Management | housing_operator | housing_operator | Correct |
| Gordon Property Management | housing_operator | housing_operator | Correct |
| Peabody Residential | housing_operator | housing_operator | Correct |
| Mavi Unlimited Property Management | housing_operator | unresolved | Unresolved |
| Keyrenter Denver | housing_operator | unresolved | Unresolved |
| EPOC Property Management | housing_operator | housing_operator | Correct |
| Real Property Management Richmond Metro | housing_operator | housing_operator | Correct |
| MRI Software | non_operator | non_operator | Correct |
| ResMan | non_operator | non_operator | Correct |
| Rentec Direct | non_operator | non_operator | Correct |
| RentRedi | non_operator | non_operator | Correct |
| TurboTenant | non_operator | non_operator | Correct |
| HappyCo | non_operator | non_operator | Correct |
| Property Meld | non_operator | non_operator | Correct |
| STAG Industrial | non_operator | non_operator | Correct |
| First Industrial Realty Trust | non_operator | unresolved | Unresolved |
| eXp Realty | non_operator | unresolved | Unresolved |

### Previously unused companies

| Company | Expected | Actual | Result |
| --- | --- | --- | --- |
| Gables Residential | housing_operator | housing_operator | Correct |
| RedSail Property Management | housing_operator | unresolved | Unresolved |
| Rentvine | non_operator | non_operator | Correct |
| Berkshire Residential Investments | housing_operator | unresolved | Unresolved |
| RentPros Property Management | housing_operator | unresolved | Unresolved |
| Hemlane | non_operator | non_operator | Correct |
| Mill Creek Residential | housing_operator | housing_operator | Correct |
| Gulf Coast Property Management | housing_operator | unresolved | Unresolved |
| VTS | non_operator | unresolved | Unresolved |
| Monarch Investment and Management Group | housing_operator | housing_operator | Correct |
| Alpine Property Management | housing_operator | non_operator | Check required |
| Avail | non_operator | non_operator | Correct |

### Unresolved cases and errors

| Company | Saved source pages | Source state | Recorded reason |
| --- | --- | --- | --- |
| Hawthorne Residential Partners | 0 | provider_queue | Company research is queued. Saved sources and your draft remain available. |
| HHHunt | 6 | No provider error reported | No explicit residential operating claim was found. |
| Weidner Apartment Homes | 3 | unavailable | Company website research is temporarily unavailable. Previous results are preserved. |
| Mavi Unlimited Property Management | 5 | No provider error reported | No explicit residential operating claim was found. |
| Keyrenter Denver | 4 | No provider error reported | No explicit residential operating claim was found. |
| First Industrial Realty Trust | 3 | No provider error reported | No explicit residential operating claim was found. |
| eXp Realty | 1 | No provider error reported | No explicit residential operating claim was found. |
| RedSail Property Management | 3 | No provider error reported | No explicit residential operating claim was found. |
| Berkshire Residential Investments | 4 | No provider error reported | No explicit residential operating claim was found. |
| RentPros Property Management | 4 | No provider error reported | No explicit residential operating claim was found. |
| Gulf Coast Property Management | 4 | No provider error reported | No explicit residential operating claim was found. |
| VTS | 4 | No provider error reported | No explicit residential operating claim was found. |
| Alpine Property Management | 2 | No provider error reported | Sources describe services supplied to property companies; this does not establish property operations. |

### Public contact subset

| Company | Contact | Expected role | Retrieved role | Match state |
| --- | --- | --- | --- | --- |
| Willow Bridge Property Company | Jennifer Staciokas | Chief Operating Officer | Chief Operating Officer | name_company_match |
| RPM Living | Cynthia Miller | President of National Operations | No accepted role | unresolved |
| Asset Living | Ryan McGrath | CEO & President | CEO and President | name_company_match |
| Avenue5 Residential | Walt Smith | Chief Executive Officer | Chief Executive Officer | name_company_match |
| Cortland | Steven DeFrancis | Chief Executive Officer | Chief Executive Officer | name_company_match |
| Hawthorne Residential Partners | Ed Harrington | Founding Principal | No accepted role | unresolved |
| HHHunt | Lance Goss | Senior Vice President HHHunt Apartment Living | Senior Vice President, HHHunt Apartment Living | name_company_match |
| S.L. Nusbaum Realty Co. | Allison Altobellis | Regional Property Manager | No accepted role | unresolved |
| Parkwood Property Management | Katie Howard | Managing Broker, Property Manager | No accepted role | unresolved |

Raw runs: `test-data/holdout-development-recheck-2026-10-01T15-39-21-056Z.json`, `test-data/fresh-12-first-pass-2026-10-01T15-50-38-510Z.json`.

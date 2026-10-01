# Real-company integration checks

September 29, 2026. These checks used the built Worker, an isolated local Cloudflare runtime and database, and actual keyless Jina Reader, Census, GLEIF and USGS requests. They did not create production leads or send messages. Test contacts use `example.invalid`; the five additional records intentionally contain no property address.

## Observed results

| Submitted company | Result from retrieved evidence | Remaining limit |
|---|---|---|
| Greystar | Strong fit; approximately 1.1 million multifamily units and student beds; approximately 260 markets. Census matched the submitted address and USGS returned an aerial image. | Global portfolio figures, not units at the submitted property; registry candidate not found. |
| Camden Property Trust | Strong fit; 56,995 apartment homes in the United States, as of August 31, 2026. Census matched the submitted address; USGS returned an aerial image; GLEIF returned one exact legal-name candidate. | Name match and imagery do not establish ownership or the lead's company relationship. |
| AMLI | Strong fit; over 25,000 apartment homes in eight U.S. markets. Census matched the submitted address and USGS returned an aerial image. | Company-level figure; registry candidate not found. |
| AvalonBay Communities | Strong fit; residential operations and footprint of 12 states supported. | No trustworthy portfolio total extracted; no property address supplied. |
| Equity Residential | Check company. Pages on the supplied domain now identify Vivmark Residential. | Do not assign that entity's figures to the submitted company without confirming identity. No address supplied. |
| MAA | Check company. Reader returned a robots/access restriction; UI explains the restriction. | No company facts recovered. Confirm the website or supply another official company website; no address supplied. |
| Bozzuto | Strong fit; residential property operations supported. | No trustworthy portfolio total or footprint extracted; no address supplied. |
| RealPage | Fit not established. Source identifies a software/technology provider. | Product and customer workflow descriptions cannot establish that RealPage operates the properties. No address supplied. |

Seven of eight cases returned public pages. Six established relevant company context (five property operators and one software vendor); Equity and MAA require follow-up. This is not complete enrichment for every company, nor a representative accuracy study.

## Source trail

The app retains the actual source URL, excerpt and retrieval date. Selected sources from this run:

- [Greystar business](https://www.greystar.com/business)
- [Camden corporate profile](https://investors.camdenliving.com/investors/corporate-overview/corporate-profile/default.aspx)
- [AMLI company website](https://www.amli.com/)
- [AvalonBay company information](https://investors.avalonbay.com/company-information)
- [Submitted Equity domain](https://www.equityapartments.com/about), whose linked investor material identifies Vivmark
- [MAA supplied website](https://maac.com/), which restricted automated access
- [Bozzuto company website](https://www.bozzuto.com/)
- [RealPage company website](https://www.realpage.com/)

A figure is a company statement, not independent verification. Retrieval time is separate from the statement's reporting date. Missing figures remain unknown. Camden's dated public fallback was also replaced with an actual investor-page excerpt, so a failed refresh no longer leaves only contact-page information.

## Performance, visuals and regression checks

- All eight immediate repeated lookups made **zero additional provider calls**. For MAA, this demonstrates the failure cooldown rather than a successful research cache.
- All three complete sample addresses produced fresh Census matches and valid 720 × 420 USGS JPEGs. Five company-only rows correctly skipped address research.
- Aerial imagery loads only when the property section approaches the viewport; it does not block company research or the email. Results have 24-hour server freshness. Provider failure leaves explicit Google satellite / Street View links.
- Desktop and 390-pixel mobile previews were inspected with actual captured sample imagery and isolated provider mocks. Camden's image decoded at 720 × 420, attribution remained readable, and no horizontal overflow was observed. The approximate point and variable capture date are stated beside the image.
- **150 automated tests passed**, including reader discovery, software-vendor negatives, grounded facts/drafts, image validation, session ownership, CSRF, quotas, cache reuse and failure preservation. The production build succeeded.

Request durations observed locally are not a production latency guarantee: provider-side caches and shared-IP limits affect performance. Aerial coverage is limited to the conterminous United States and is not live, parcel identification or ownership evidence. Google links use approximate Census coordinates; no Google API key or billing account is configured.

## Repeat the checks

```sh
pnpm build
pnpm test
node scripts/check-free-providers.mjs --live --extended --aerial --output /tmp/inbound-company-checks.json
```

This command deliberately calls public providers, spaces cases to respect limits, and uses its own disposable database. The JSON output is a local diagnostic, not a committed fixture. For UI testing, import `test-data/public-company-samples.csv` and `test-data/additional-company-samples.csv`. No test record represents a real person's inquiry or employment.

## Twelve additional contact cases — balanced-score release

The new `contact-validation-samples.csv` contains two fictional TEST contacts at each of six real companies. It intentionally includes accented and hyphenated first names, different emails, and different synthetic inquiries. No real person or employment is asserted, and no property address was invented.

| Company | Contacts | Research and logo result | Initial priority |
|---|---:|---|---|
| Greystar | 2 | Current company research; bundled logo found | 40 supported, 60 unassessed; mixed units/beds cannot earn apartment-home scale points |
| Camden Property Trust | 2 | Current company research; bundled logo found | 50 supported, 50 unassessed |
| AMLI | 2 | Current company research; bundled logo found | 50 supported, 50 unassessed |
| Essex Property Trust | 2 | Current company research; dynamically retrieved logo found | 40 supported, 60 unassessed; no reliable scale total extracted |
| Morgan Properties | 2 | Company retrieval temporarily unavailable; logo missing | Unscored; company identity needs research |
| RPM Living | 2 | Website restricts automated research; logo missing | Unscored; company identity needs research |

All 12 cases passed first-name personalization, retained edited drafts after research, separate per-contact notes, and duplicate-intake handling. Every immediate repeat made zero extra research-provider or logo-Reader calls. Every second contact at the same company made zero additional research calls; unavailable cases reused the failure cooldown, not a successful result. Inquiries alone awarded no readiness points. Four of six companies supplied both current research and usable marks; this is not 100% coverage.

This was an actual keyless-provider run against the built Worker in an isolated disposable database. Application research requests were spaced at least 11 seconds apart to respect the six-per-minute session limit; logged elapsed times can include this pacing and are not a latency benchmark. A first, more tightly spaced diagnostic run hit that protection; the final run completed normally without weakening the app's controls.

Source sites for the new cases were checked against official pages: [Essex](https://www.essexapartmenthomes.com/about-us), [Morgan Properties](https://www.morgan-properties.com/about-us), and [RPM Living](https://rpmliving.com/about-us/). They are real companies even when the research provider cannot retrieve their pages.

Run this separate contact-focused check with:

```sh
node scripts/check-free-providers.mjs --live --contacts --logos --output /tmp/contact-checks.json
```

The final regression suite has 172 tests. The public app retains initial images/initials on logo failure, rather than substituting an unrelated brand. New logos load lazily for visible rows, at two simultaneous lookups maximum, and share the result between the list and account header.


## Research reliability recheck — September 29, 2026

A fresh, isolated Worker/D1 run checked one fictional contact at each of the six real companies, with company research, logo retrieval, repeat lookups, edited-email preservation and contact isolation. No production visitor records or paid credentials were used.

| Company | Current company evidence | Cold research time | Extra Reader calls for logo |
|---|---|---:|---:|
| Greystar | Returned | 6.5 s | 0 |
| Camden Property Trust | Returned | 6.9 s | 0 |
| AMLI | Returned | 11.2 s | 0 |
| Essex Property Trust | Returned | 14.8 s | 0 |
| Morgan Properties | Temporarily unavailable | 13.3 s | 0; initials retained |
| RPM Living | Automated access restricted | 10.5 s | 0; initials retained |

All six repeat lookups made zero provider calls. The four successful company lookups yielded sourced operator context and did not require a property address. The two unavailable cases are unresolved coverage limits, not successful enrichment. Timing is a single local smoke run, not hosted latency or load certification.

A separate offline browser recovery check returned a simulated Reader 429 once, waited the advertised 60-second cooldown, then automatically populated company research. The unsaved email text remained intact while the email tab stayed open. Worker tests also cover shared cooldowns, per-visitor daily-limit isolation, concurrent homepage deduplication, linked-page recovery, and pacing across minute boundaries.

## Company and property locations — September 29, 2026

The location update was checked against the actual keyless providers in an isolated Worker/D1 database. The three property samples were submitted as one pasted address, with the separate city and state fields empty.

| Company | Sourced company location | Submitted property lookup |
|---|---|---|
| Greystar | Charleston, South Carolina headquarters city, explicitly stated on the business page. Street address remains unknown. | Census matched 1731 Tupelo Hill Lane, Raleigh, NC 27607. |
| Camden Property Trust | Corporate office at 2800 Post Oak Blvd, Suite 2700, Houston, TX 77056, from its contact page. | Census matched 309 E Morehead St, Charlotte, NC 28202. |
| AMLI | Three office addresses extracted from its corporate office directory: Atlanta, Austin and Chicago. | Census matched 1800 Boren Ave, Seattle, WA 98101. |

An additional company-only run recovered two Essex office addresses. Morgan and RPM remained unavailable or restricted; no office was invented for either. The app shows at most three retrieved offices and does not claim to inventory every company location.

Sources: [Greystar business](https://www.greystar.com/business), [Camden contact](https://camdenliving.com/contact-us), [AMLI offices](https://amli.com/contact). Each company-location card retains its source and excerpt. Company office facts and registry candidates never fill the submitted property field or establish a property-company relationship.

All immediate repeat lookups made zero additional provider calls. The three address checks took approximately 6–10 seconds locally, including company research; these are individual smoke checks, not production performance guarantees. Census locations remain approximate address-range matches.

The final regression suite has **199 passing tests**, including structured and pasted addresses, street-plus-ZIP input, one bounded no-match fallback, ambiguous-match handling, scoped company locations, legacy inquiry cleanup, migration freshness and preservation of edited drafts. Desktop and 390-pixel mobile previews were checked with isolated fixtures. The legacy inquiry marker is removed from new imports, existing-record display and CSV exports; fictional contact names remain labeled.

```sh
node scripts/check-free-providers.mjs --live --one-line --logos --output /tmp/location-checks.json
```

## Rental-market context and upload trigger — September 29, 2026

Three live checks against the built Worker returned Census Reporter ACS data for the matched property tracts. Contacts were fictional, the D1 database was disposable, and nothing was sent to a prospect.

| Sample property area | ACS period | Median monthly gross rent | Published rent margin of error | Renter share | Rent cost burden |
|---|---|---:|---:|---:|---:|
| Raleigh sample / Wake tract 515.02 | 2020–2024 | $2,246 | ±$147 | 41.6% | 43.7% |
| Charlotte sample / Mecklenburg tract 1.01 | 2020–2024 | $1,919 | ±$161 | 91.8% | 26.9% |
| Seattle sample / King tract 73.02 | 2020–2024 | $2,994 | ±$166 | 90.9% | 34.5% |

These are surrounding-tract survey estimates, not the three properties’ asking rents or residents’ characteristics. Rent includes tenant-paid utilities. Burden is rent of 30%+ of income among households with a computed ratio. Repeat research made zero additional provider calls for all three. Total first-research times were approximately 6.1, 8.9 and 11.0 seconds locally, not a production latency guarantee.

A browser CSV upload of three explicitly fictional Acme contacts automatically completed all three research jobs without opening each contact. The brief showed local-market estimates and the separate restriction-verification prompt. The **210-test** suite also verifies source geography, missing/sentinel values, distinct denominators, cache reuse, failure preservation, session ownership, automatic candidate selection and no score/email changes from area context.

No unattended 9 a.m. scheduler or property-level restriction determination was enabled. See [automation and context boundaries](AUTOMATION_AND_MARKET_CONTEXT.md).


## Reviewer recovery release — September 29, 2026

Fresh calls through the built Worker, using an isolated D1 database and anonymous providers (no production credential or visitor data):

| Company | Company result | Cold elapsed time | Additional calls on repeat |
|---|---|---:|---:|
| Greystar | Current company pages; Strong fit | 9.9 s | 0 |
| Camden Property Trust | Current company pages; Strong fit | 19.4 s | 0 |
| AMLI | Current company pages; Strong fit | 28.5 s | 0 |
| Essex Property Trust | Unavailable; unscored | 28.5 s | 0 |
| Morgan Properties | Unavailable; unscored | 32.4 s | 0 |
| RPM Living | Unavailable; unscored | 27.4 s | 0 |

These are six smoke cases, not an accuracy benchmark. The keyless path retains eight-second pacing; this run does not measure the hosted credential's one-second pacing or authenticated discovery coverage. A zero-call repeat on an unavailable company verifies cooldown reuse, not successful enrichment. Saved drafts and contact separation passed for every case. Search and explicit-page recovery were additionally verified with controlled Worker and browser scenarios. The three unresolved sites remain coverage limits. No SEC filing adapter, universal fallback provider or human sales-rep pilot is claimed.

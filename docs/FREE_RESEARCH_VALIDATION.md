# Free research validation · September 30, 2026

A paired, local Worker check ran the previous free implementation and the improved implementation on the same six public professionals across six companies, plus two deliberately wrong-employer pairs. Both runs used fresh isolated databases and live public pages; no production visitor data, research credentials or paid services were used. The runner restricts outbound requests to the sample company domains, anonymous Reader and public DNS, and rejects authorization headers. Expected titles and source URLs were withheld from the application.

| Result | Previous free version | Improved free version |
|---|---:|---:|
| Fully matching current-title results | 3 / 6 | 5 / 6 |
| Role returned with a spurious shortened-title conflict | 1 / 6 | 0 / 6 |
| No accepted current role | 2 / 6 | 1 / 6 |
| Wrong-employer controls assigned a role | 0 / 2 | 0 / 2 |

Toby Bozzuto’s profile was recovered. Courtney Whitear’s full title was already present, but the old extractor also emitted “Director,” creating a false conflict; the new extractor preserves the complete title. Amber Hildebrand, Debbie Topping and Lori Burger remained matched. Jessica Werner remained unresolved: a relevant team page was unavailable during the check. We did not replace that missing result with a guess.

This is a small convenience sample of people with public biographies, not an 83% general accuracy claim. Titles were compared with previously audited labels and returned excerpts, not independently recertified employment. The two negative controls are far too few to establish a population false-positive rate. Sequential live runs can encounter different availability. Local timing is not a production latency guarantee. This check covers individual research; it does not measure company enrichment accuracy.

Changes: retain link labels, rank exact-name profile links, follow safe same-company sitemaps, preserve full titles and name variations, and reuse retrieved pages across contacts within one visitor session. Every role still needs a retrieved page excerpt with a supported person/title/employer association. Sitemap URLs and labels alone cannot create evidence. Original retrieval timestamps survive reuse. No paid API or authenticated fallback exists.

Raw bounded results: `test-data/free-people-before.json` and `test-data/free-people-after.json`. Reproduce with `node scripts/benchmark-free-people.mjs --live --output /tmp/free-people-check.json` after building. Running again depends on current public-site availability; it makes real anonymous/public requests.

Validation: production build succeeded and all 383 automated tests passed, including source matching, profile discovery, sitemap safety, page reuse, visitor isolation, saved-email preservation, and the absence of paid research endpoints or credentials in the production bundle.

## Expanded run: 50 professionals and 10 controls

The follow-up used all 50 previously labeled public professionals across 11 companies, plus 10 deliberately wrong-employer combinations. Expected titles and source URLs were withheld from research. Every outbound request was restricted to the listed company domains, anonymous Reader and public DNS; authorization headers were forbidden. The workspace/database was disposable and separate from production.

| Measure | Observed result |
|---|---:|
| Expected current title found | 35 / 50 (70%) |
| No accepted current role | 15 / 50 |
| Returned current title differed from the label | 0 / 50 |
| Wrong-employer controls assigned a role | 0 / 10 |
| Operations/management title coverage | 32 / 38 |
| Executive title coverage | 3 / 12 |

Company breakdown: Bozzuto 3/3; Flaherty & Collins 8/8; RedPeak 6/6; Atlantic Residential 6/6; Nxt 6/6; EBMC 6/6. Unresolved: Greystar 0/3; MAA 0/1; Camden 0/3; Equity Residential 0/2; Baceline 0/6. These clusters show a site-discovery/availability dependency, not 50 independent trials. The corpus favors published professional profiles, and nine negative controls use Greystar as the wrong employer. Zero failures in those controls does not establish a zero false-match rate.

Across all 60 cases, outbound responses included seven HTTP 403s, three 404s, one 409 and one timeout. No rate-limit 429 was observed in this person run. Fifteen unresolved positives had no extracted candidate; they were not declared incorrect employment matches. Some relevant pages were unreadable; others were not reached within the bounded crawl.

Thirty-nine of fifty positive cases reused at least one page. The local case-time median was 1.701 seconds, but this includes deliberate 1.7-second request pacing and benefits heavily from shared company pages; it must not be used as a cold-production latency promise. The slowest case took 41.531 seconds, including pacing and overhead.

Additional adversarial tests found a real defect not caught by the ten wrong-employer pairs: a customer/partner story on the supplied company's domain could assign the guest's role to that company. Version 6 now rejects these non-employer source contexts and explicit conflicting employer language. Nine new regression checks cover these failures and preserve ordinary departmental titles. Replaying the new employer-conflict filters over all 35 accepted excerpts retained all 35; this is a filter replay, not a second full live retrieval run.

The expanded live corpus was retrieved on version 5. The new source safeguards are validated separately as described above; there is no claim that a full version-6 live benchmark was run. The original 3/6 → 5/6 small-sample comparison remains historical. The larger 35/50 result is the stronger coverage estimate for this corpus.

Artifacts: `test-data/free-people-expanded.json`, `test-data/free-people-expanded-results.csv`, and `test-data/free-people-employer-replay.json`. Reproduce all 60 cases with `node scripts/benchmark-free-people.mjs --live --all --output /tmp/free-people-expanded.json`. The runner imports once, respects mutation pacing, records HTTP status, and does not count unavailable negative controls as successful abstentions.

## Eight company and property integration checks

A separate isolated live run checked Greystar, Camden, AMLI, AvalonBay, Equity Residential, MAA, Bozzuto and RealPage. All eight returned public company-page evidence without relying on the bundled sample snapshots. Seven names were corroborated on their supplied domains; Equity Residential stayed in identity review. All eight repeated lookups made zero additional counted provider calls. All three supplied U.S. property addresses matched through Census; five cases intentionally omitted addresses, so they were not counted as property failures.

The company run exposed a classification miss: AvalonBay's retrieved statement explicitly described a residential REIT managing apartment communities, but gerund wording was not recognized. The classifier now accepts this bounded, company-subject statement form and consistently passes company identity into the residential-signal check. Tests retain exclusions for other-company claims, advisers, software and commercial-only portfolios. Replaying the exact captured excerpts changes AvalonBay to Strong fit; the other seven outcomes remain unchanged.

| Company | Result after classification replay |
|---|---|
| Greystar | Housing operator / Strong fit |
| Camden Property Trust | Housing operator / Strong fit |
| AMLI | Housing operator / Strong fit |
| AvalonBay Communities | Housing operator / Strong fit; fixed extraction rule |
| Equity Residential | Needs company identity confirmation |
| MAA | Public facts available; housing operator classification remains unconfirmed |
| Bozzuto | Housing operator / Strong fit |
| RealPage | Software vendor; housing operator fit not assigned |

The retrieved pages alone do not independently establish company ownership, contact employment or buying intent. This is eight integration cases, not a representative company-accuracy study. Local first-look timings were approximately 10–37 seconds, including the harness's deliberate pacing; repeat checks reused cached results.

Artifacts: `test-data/free-company-expanded.json` and `test-data/free-company-classification-replay.json`. The classification correction was tested against captured evidence; it was not another eight-company network run. Reproduce retrieval with `node scripts/check-free-providers.mjs --live --extended --output /tmp/free-company-expanded.json`.

Final release validation: all 397 automated tests passed after both corrections (383 existing checks plus nine person-employer and five company-classification cases). Build and diff checks passed. No paid research calls, credentials or paid fallbacks were added.

## Version 7: measured progress toward 95% coverage

The target is at least 48 of the same 50 positive cases (96%, the first whole-contact result above 95%). A fresh isolated live run of all 60 cases on version 7 found 39/50 expected titles (78%). Eleven remained unresolved; no returned title differed from its expected label, and all ten wrong-employer controls abstained after successful page retrieval. **The 95% target was not achieved.** This measures expected-title coverage on this fixed corpus, not overall accuracy or independently verified employment.

All 35 previously successful contacts remained successful. Newly recovered: Bob Faith, Toni Eubanks and Derek Ramsey at Greystar, and Laurie A. Baker at Camden. Better link ranking reached Greystar's business leadership pages; parsing explicit name/position records in public JSON recovered Camden's profile. No expected source URL or title was passed to the researcher, and no benchmark-specific company or person names were added to the implementation.

The unresolved cases are Brad Hill (MAA); Alexander J. Jessett and Richard J. Campo (Camden); Mark J. Parrell and Michael L. Manelis (Equity Residential); and Jessica Werner, Michelle Montgomery, Claudia Walker, Cole Proctor, Jessica Daniels and Layla Vossoughi (Baceline). Camden's current directory uses shortened first names for the two unresolved identities; the system does not equate nicknames without corroboration. Baceline's previously labeled team page returned 404 in both direct and anonymous Reader diagnostics. Indexed snippets of that page were not accepted as verified current roles. MAA and Equity encountered access/discovery limits within the bounded crawl. These cases remain in the denominator.

A preliminary targeted run exposed an incorrect neighboring-card title association. HTML card boundaries now prevent this: a title before the next person's name cannot become the preceding person's role. The final full run returned Toni Eubanks's matching title from her individual biography. New regression tests cover this layout, JSON field association, malformed/executable scripts, and prioritization of professional directories over editorial/navigation noise.

The crawler remains free-only, same-company, robots-aware and bounded by eight pages plus two sitemap requests within a nominal 40-second deadline. Provider pacing and request overhead can extend measured case duration. No authorization headers, paid API calls, production lead mutations or benchmark labels were used by research. As before, the sample is clustered by website, favors people with published biographies, and does not establish a population false-match rate. Repeated runs may differ as public pages change.

Artifacts: `test-data/free-people-v7.json` and `test-data/free-people-v7-results.csv`. Reproduce with `node scripts/benchmark-free-people.mjs --live --all --output /tmp/free-people-v7.json` after building. All 402 automated tests passed, along with the production build and diff checks. Reaching the target requires nine additional verified matches; broader discovery and corroborated identity resolution remain unimplemented work, not promised coverage.

## Version 8: 94% first-pass coverage

The final complete live run of the unchanged 50-contact corpus plus ten wrong-employer controls found **47/50 matching titles (94%) on the first pass**, compared with 39/50 (78%) on version 7. All 39 earlier successes remained successful. No returned title differed from its benchmark label, and all ten negative controls correctly abstained after retrieving public pages. No production leads or paid services were used.

Eight additional matches came from six Baceline contacts in the live tenant-resource directory and two Camden executives in a dated leadership announcement. The Baceline team-page 404 remained a real failure; the successful source was a different, live, publicly linked directory. Camden's announcement supplied the exact legal names, so no nickname equivalence was assumed. MAA was recovered in the earlier full exploratory run, but its robots request timed out in the final full run; that failure is retained in the first-pass score.

Changes include public resource-directory discovery, career culture navigation, dated leadership-announcement discovery, explicit promotion wording, and structurally bounded title-before-name extraction. A reversed row must contain a single person's name inside one actual HTML paragraph or profile card. Phone suffixes are omitted from displayed excerpts. No arbitrary preceding title is assigned from flattened text. Official attribution such as a message from the company's president is supported separately. Career-site navigation declarations are read as data without running scripts. Undated, future and stale news announcements stay historical. Page limits, free-only requests, employer checks, cache isolation and provider pacing remain enforced.

The first exploratory full run exposed a ranking regression: an unlabeled duplicate URL overwrote the higher score of a labeled team link. The fix keeps the strongest observed rank, with a regression test. The final full run restored all eight Flaherty & Collins profiles. This is why the final report uses the completed release run, rather than adding together favorable pilot results.

Independent source review also found label drift in the two unresolved Equity Residential cases. Its merger closed on August 17, 2026. Parrell ceased serving as an officer, while Manelis became COO of successor Vivmark Residential. The original company/domain assumptions therefore need revision; neither case was removed from the 50-contact denominator or silently reassigned by the app. This manual audit is recorded separately in `test-data/professional-label-audit-2026-09-30.json`; it is not runtime input. Sources: [SEC closing filing](https://www.sec.gov/Archives/edgar/data/906107/000114036126033377/ef20080318_8k.htm) and [successor-company announcement](https://investors.vivmarkresidential.com/news-events/press-releases/detail/113/vivmark-residential-launches-as-one-of-the-countrys-leading-real-estate-companies).

Final first-pass artifacts: `test-data/free-people-v8.json` and `test-data/free-people-v8-results.csv`. The source corpus and expected labels were withheld from the researcher exactly as before. The run recorded a transport timeout and mixed public HTTP failures; successes often reuse a company page. Local timing includes harness pacing and desktop execution delays and is not a production latency measurement. All **411 automated tests** passed; the production build and diff checks passed. No research API charges or authenticated fallback were introduced. The result remains fixed-corpus coverage across eleven companies, not population-wide accuracy.

### One targeted timeout retry: 96% recovered coverage

After the full run completed, one fresh isolated lookup repeated only the MAA case that had timed out. The unchanged release build found Brad Hill's President & CEO attribution on the public career-culture page. No expected role or source URL was passed to research. This raises combined recovered coverage to **48/50 (96%) after one targeted retry**. It is not 96% first-pass coverage or a second full 60-case run. The published first-pass artifact remains unchanged at 47/50; the retry is separate in `test-data/free-people-v8-timeout-retry.json`. Runtime retry cooldowns remain in place; this fresh test session does not demonstrate immediate recovery within a production session. The remaining two cases retain their original inputs and the label-drift caveat above.

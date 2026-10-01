# Company logos

Recognized companies use reviewed company assets bundled with the app. No API call or research allowance is needed to display them. Both the company name and exact domain must match; unrelated companies never receive a sample mark. The frontend selects an allowlisted same-origin PNG immediately, and the session-authorized logo API returns the same selection.

## Bundled asset provenance

Retrieved and visually inspected September 29, 2026. The files identify the source companies; no endorsement or unrestricted reuse license is claimed.

| Company | Website source | Original asset | Shipped resolution |
| --- | --- | --- | --- |
| Greystar | [Company homepage](https://www.greystar.com/) | `GreystarLogo_Navy_NoTagline.png`, declared company logo on the homepage, hosted on `cdn.cookielaw.org` | 783 × 171, original PNG |
| Camden | [Company homepage](https://www.camdenliving.com/) | [Header logo](https://www.camdenliving.com/images/camden-logo-black.png) | 833 × 292, original PNG |
| AMLI | [Company homepage](https://www.amli.com/) | [Dark logo](https://www.amli.com/logo-dark.svg) | 456 × 212 PNG rendered from the original vector through wsrv.nl |

The ten-lead showcase adds six marks retrieved from official company websites and visually inspected September 30, 2026:

| Company | Original asset | Processing |
| --- | --- | --- |
| RedPeak | [Company wordmark](https://redpeak.com/wp-content/uploads/2021/12/RedPeak_PrimaryLogo_Web_FullColor.svg) | Original vector rendered locally to PNG. |
| Atlantic Residential | [Company header logo](https://atlanticresi.com/wp-content/uploads/2019/07/ar-logo-white-rgb@2x.png) | Original PNG, fitted to the dark logo frame. |
| Bozzuto | [Company header logo](https://www.bozzuto.com/_next/static/media/logo-dark.80ba3327.svg) | Original vector rendered locally to PNG. |
| Yardi | [Company icon](https://www.yardi.com/wp-content/client-mu-plugins/cmw-icons/svg/icons/yardi_icon.svg) | Original vector rendered locally to PNG. |
| AppFolio | [Company homepage](https://www.appfolio.com/) inline header SVG `mobile_logo` | Original paths rendered locally to PNG; nonvisual framework attributes removed. |
| Marcus & Millichap | [Company homepage](https://www.marcusmillichap.com/) header asset `marcus-millichap-logo-white svg.svg` | Original vector rendered locally to PNG, fitted to the dark logo frame. |

Image bytes are embedded in `website/company-brand-images.json`; only its exact allowlisted public image routes are served. Existing marks for Herzog, Trimark, CP Management and AAMCI remain bundled. This avoids exposing arbitrary files or executing third-party SVG. No captured company HTML is bundled. The marks are reviewed source assets, separate from dated research evidence. Updates require verifying and replacing the corresponding asset. Prologis uses the ordinary dynamic lookup/initials fallback.

## Other companies

1. A session-authorized background request reads only previously cached homepage metadata from company research. It never calls Jina Reader. Without a researched homepage, it returns a deferred result and keeps initials; after research, the browser retries the logo lookup.
2. Matching organization logo metadata and branded header declarations are candidates. Three logo candidates and two icon candidates are retained so a crowded header cannot remove every fallback. Unrelated vendor marks, social cards and arbitrary photography are excluded.
3. Up to three logo candidates and one declared icon are tried through the fixed free wsrv.nl service. The PNG output is limited to 480 × 192 pixels and 120 KB. `we` prevents enlarging small raster originals; `page=-1` chooses the largest available icon resolution. PNG signature and dimensions are checked.
4. The browser displays only same-origin assets or bounded PNG data URLs. The full logo fits in its frame without clipping; icons stay at 24 CSS pixels. Missing or undecodable assets preserve initials. The browser caches successes and expires failures, so reopening a lead after its cooldown can retry.

Successful dynamic lookups use seven-day public-sample caching or private session caching. Missing declarations and image failures use a ten-minute private retry cooldown rather than a seven-day negative result. Public failures do not suppress other visitors. Cache version 2 discards old low-resolution results. Logos never modify source claims, qualification, drafts or reviewed status.

Logo identity remains a heuristic for arbitrary websites. A submitted domain can be wrong, websites can expose obsolete assets, and free providers can block or throttle requests. Branding does not establish employment, ownership, authorization or buying intent. The initials fallback is intentional when a usable image cannot be obtained.

References: [Jina HTML output](https://github.com/jina-ai/reader#using-request-headers), [Schema.org logo](https://schema.org/logo), [wsrv resizing without enlargement](https://wsrv.nl/docs/fit), [PNG output and icon resolution](https://wsrv.nl/docs/format), [free-service limitations](https://wsrv.nl/faq/).

The left lead list and account header share one browser lookup per company/website. One dynamic logo request runs at a time, at least four seconds between starts, yielding to queued company research; off-screen rows wait until near the viewport. Imports display their leads immediately. Research and logos share cached homepage excerpts and logo metadata, and logos cannot initiate an extra Reader request. Known sample marks are local and immediate; cold dynamic retrieval is best effort and does not block research or drafting.

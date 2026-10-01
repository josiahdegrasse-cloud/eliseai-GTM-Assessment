# Public assessment security

This deployment is a public job-assessment tool. Anyone can open it without a login. It is designed for public company examples and synthetic contact details, not a shared production CRM containing confidential inquiries.

## Visitor boundary

- A browser receives a cryptographically random 256-bit bearer session in a `__Host-` cookie with Secure, HttpOnly, SameSite=Strict, Path=/ and a 24-hour maximum age. Only the token's SHA-256 digest is stored in D1.
- Every lead read, save, update and research operation includes a server-controlled session predicate. Knowing another lead ID does not grant access. Session IDs supplied in request bodies are never authoritative.
- A session expires after 24 hours. Reads fail immediately at expiry. Expired records and private research caches are physically purged when the next visitor initializes a session. No scheduled deletion SLA is claimed. Clear my data immediately deletes that visitor's session, leads and private caches through foreign-key cascades.
- Cookie possession is the access boundary. This is not a verified human identity, and another person using the same browser profile can access its current session. It is not a multi-tenant enterprise authentication system.

## Request protection

- The site requires its exact configured HTTPS origin. POST requests require a matching Origin, JSON content type and a session-bound CSRF token. Cross-site API requests are rejected; ordinary links to the public page work.
- Responses use no-store, HSTS, nosniff, no-referrer, clickjacking protection and a Content Security Policy restricting scripts and connections to the same origin. User and source text is escaped before HTML rendering.
- Only explicitly listed static files and API routes are served. There are no public connect, disconnect, test-key, administrative or filesystem endpoints.
- Uploads are bounded to 1 MB and 100 CSV rows. Each session holds at most 100 leads; at most 100 unexpired sessions exist. Provider responses are bounded to 3 MB and requests time out after 12 seconds.
- Parameterized SQL handles all database input. Atomic counters enforce budgets. Compare-and-swap updates and per-lead research locks protect concurrent edits.

## Free usage and abuse limits

- Research is free-only: anonymous Reader, direct company HTML and public keyless data APIs. Paid Exa and Jina Search calls are disabled; adding API keys cannot re-enable them.
- Company Reader: 60 attempts per visitor per UTC day and eight globally per minute. All Reader starts share eight-second pacing and cooldown. Individual lookups: 60 per visitor per day, six pages and at most two sitemap requests within a 40-second crawl deadline each. Census/GLEIF: 30 per visitor per day.
- Successful public research for the three published sample companies and addresses is retained for seven days as fallback. Company freshness expires after 24 hours and address freshness after 24 hours, independently of retention. Refreshes consume the existing allowance; no unlimited freshness claim is made. The shared cache contains public research only, never contacts, lead records, notes or drafts. All other research caches are scoped to the visitor.
- Additional limits: 120 API requests per minute per platform network identifier; 10 new sessions per hour per identifier; 40 mutations per minute per session; six research actions per minute per session. The network identifier is salted and hashed. If the edge supplies no client address, a shared bucket applies conservatively.
- On a rate limit or outage, saved evidence and draft editing remain available. Exact public sample companies/addresses have dated source snapshots as a last resort, explicitly labeled. A visitor-specific failure never writes a cooldown into another visitor's shared sample cache. No unlimited availability claim is made; edge controls may be needed under sustained abuse.


## Credentials and data

The network-hashing salt is a private runtime secret. Research keys are neither required nor forwarded. Anonymous Reader receives validated company URLs; direct HTML requests validate public DNS, robots rules and same-domain HTTPS redirects. Contact inquiry text, private notes, cookies and authorization headers are never forwarded. Paid provider requests and authenticated retries are disabled in code as well as by removing the live credentials.

Jina receives the company-domain URL ; GLEIF receives company name, Census receives address/city/state, and wsrv.nl receives an image URL observed on that company website. No submitted name is sent as a search query. Official biography URLs can contain a person’s name. Complete email addresses, inquiry text, discovery answers, notes and drafts are never forwarded. Registry name matches are labeled candidates, not domain/ownership verification, and cannot affect the fit score or email. Stored and exported registry data stays within the same visitor boundary as the lead.

Security events record only a session digest, operation type, timestamp and random event ID. They contain no drafts, contact fields, IP addresses, credentials or request bodies. They are purged after seven days on session initialization. Database-provider backups and retention are separate from these application deletion rules.

The historical Exa secret is not used, read or forwarded by the active Worker. It has not been printed, committed or packaged. This change does not create a replacement Exa account or reset its provider allowance.

Streamed research uses the same session/CSRF checks and returns only sanitized saved lead objects. Company evidence is persisted first; final context updates use compare-and-swap against the latest draft. The stream parser rejects a different lead ID and reports interrupted completion. Disconnecting the stream does not intentionally discard saved results. Provider diagnostics record only the provider name and response status, never raw bodies or credentials.

## Validation

- The original Python suite: 29 passing tests with isolated SQLite databases and mocked providers.
- The hosted suite: 274 passing tests. Worker tests use a local Cloudflare runtime and D1, covering session flags/hashing, expiry, origin/CSRF rejection, cross-visitor read/write/research denial, import/save flows, deletion cascades, quota concurrency, caching, provider behavior and same-origin module delivery. Brief tests cover original units/dates, rejected development and recruitment sources, unsupported provider observations, citation rendering and HTML escaping.
- The earlier dependency audit reported zero known advisories after patched transitive dependencies were pinned. This is a point-in-time package-database result, not proof that the application has no vulnerabilities.
- A manual browser journey was checked in an isolated local Worker preview with mocked providers: intake, research, source-backed draft, qualification save, edited-lead recovery and robust search. No unattended browser regression suite, formal penetration test, production load test, or accessibility certification has been performed. Earlier live integration spot checks succeeded; the current keyless migration also includes opt-in live checks with public samples in an isolated database. Mocked tests are not evidence of live data accuracy.

## Deployment

The original Python files remain a local reference; public requests run `dist/server/index.js`. The public HTML, CSS and JavaScript are embedded in the Worker so that all responses pass through its security headers instead of bypassing them through a separate asset server. The archive contains the Worker and schema migrations. The local SQLite database, Keychain contents, `.env`, virtual environment and development dependencies are excluded.

Required runtime configuration: `PUBLIC_ORIGIN` set to the exact HTTPS site origin, `RATE_LIMIT_SALT` as a random secret. D1 binding `DB` is declared in `.openai/hosting.json`. Sites manages HTTPS and the database binding. No application sign-in capability is requested.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm audit
```

Review new schema migrations, push the matching source commit, package the validated build with the Sites helper, save a version and deploy it to the user-authorized public audience. Do not put credentials in Git URLs or configuration.

Design references: [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) and [browser request/session security considerations](https://flask.palletsprojects.com/en/stable/web-security/). The implementation uses the hosted Worker runtime rather than Flask.

Buyer context is bounded to 2,000 characters for the inquiry and 1,500 per discovery answer, escaped in the UI, isolated by visitor session and excluded from provider requests. Context changes invalidate review on edited drafts without replacing wording. Unedited drafts update without an API call.


Cache leases use a separate `cache-flight:` namespace in the existing atomic limits table and expire after 50 seconds; they never reset or alter provider allowances. Repeated same-company lookups share results across Worker instances only within the existing public-sample or visitor scope. Private failures cache a ten-minute retry window; known throttles use a bounded provider/minute cooldown or the daily reset time. Visitor-specific failures are never written to the shared sample cache. Prior excerpts remain dated and visibly stale when refresh is unavailable. Reader reads the homepage and up to two observed corporate pages sequentially (12 seconds each); Census and GLEIF run concurrently alongside that chain with 12-second request timeouts. The 50-second cache lease and 65-second lead lock bound duplicate work.

## Company logo retrieval

`POST /api/logo` requires the same owning session, Origin and CSRF checks as research. It accepts an existing lead ID; client-supplied image URLs are ignored. The server derives the website from that record, reads the homepage through Jina with robots checking, and ranks explicit organization logo, branded header and site-icon declarations. It never fetches arbitrary company/CDN hosts directly.

The fixed wsrv.nl service rasterizes dynamically discovered images to PNG, at most 480 × 192 pixels, without enlarging small raster originals. The Worker bounds the result to 120 KB and validates PNG signature/dimensions; SVG/HTML and redirects cannot reach the browser as executable content. The same-origin JSON response carries a PNG data URL. The original `img-src 'self' data:` policy remains intact. A decoding failure preserves initials.

Greystar, Camden and AMLI additionally have fixed, reviewed PNG assets embedded in the Worker and served from an exact route allowlist. No third-party request, session data or research allowance is involved in displaying these public marks. Both company name and exact domain must match before selecting one. These routes expose only the three public images, not arbitrary files. Source provenance is in `docs/COMPANY_LOGOS.md`.

A cold dynamic logo lookup consumes one Reader attempt from the existing Reader allowance. Separate limits allow 30 logo lookups per visitor/day and 12 globally/minute, with up to four five-second image attempts per lookup. Successes are cached for seven days for exact public samples and at most the visitor session for other companies. Missing declarations/images use a ten-minute private cooldown; other failures use the existing bounded cache policy. Browser misses expire rather than persisting for the life of the page. Public failures do not poison another visitor’s cache. Branding never changes a lead, fit, draft or reviewed state and does not independently verify identity.


## Property aerial imagery

`POST /api/property-image` requires owning-session authorization, Origin and CSRF. It accepts a lead ID; caller URLs and coordinates are ignored. The server derives a bounded 600 × 350 metre neighborhood from the matched Census point and calls the fixed `imagery.nationalmap.gov` ImageServer endpoint. Coverage is bounded to conterminous U.S. coordinates. Responses require JPEG content type/signature, dimensions no larger than 720 × 420 and at most 300 KB. Trailing provider padding after EOI is stripped. Browser images remain same-origin PNG/JPEG data URLs under the existing CSP.

Imagery is lazy on visibility, deduplicated and cached for 24-hour freshness. Only the existing exact public sample address allowlist can share image caches; all other results remain visitor-scoped and expire with the session. Limits are 20 attempts per visitor/day and 12 globally/minute. Failure preserves the brief and draft and leaves an explicit Google Maps address link. The lazy Google Street View iframe sends fresh validated Census coordinates to Google, or loads an existing address-bound selected panorama. No contact name, email, inquiry or draft is included. The compact card labels the submitted address; nearby imagery is not verification of that building. Invalid, stale or street-number-mismatched coordinates cannot select automatic imagery. USGS receives approximate coordinates, never names, email addresses, inquiries or drafts. Images are not live, date/coverage vary, and the point does not establish a parcel, building, ownership or company relationship.

Readiness assessments are enum-validated inside the visitor-scoped qualification record. Supporting notes remain private and are never included in provider queries. Lead priority is recomputed server-side; client-supplied scores are ignored. Unknown or unsupported selections cannot earn readiness points. Source text and rep notes in the explanation drawer are HTML-escaped.


### Research traffic coordination

Reader starts use an atomic D1 pacing slot (eight-second spacing, eight-second maximum wait) alongside existing atomic daily/minute caps. Provider HTTP 429 responses create a provider-only cooldown; user-specific allowance errors never block other visitors. Retry-After seconds and HTTP dates are honored up to 24 hours. Logs record only provider name, throttling event and delay, without contact data, company URLs or response bodies.

Combined Reader HTML/Markdown is parsed into bounded source excerpts and candidate logo URLs. Raw HTML is neither stored nor served. Non-sample parsed pages remain in the visitor-private cache; shared cache eligibility is unchanged. A successful homepage can serve concurrent logo and research requests without a second provider call. Frontend pacing and bounded automatic retries complement, but do not replace, server enforcement.

## Area context and automatic intake queue

Area lookup accepts no client URL or geography: the Worker derives an eleven-digit tract from its own matched Census response. Only that tract and four fixed housing table IDs go to the fixed `api.censusreporter.org` origin. Redirects are rejected, requests time out after ten seconds, responses are bounded, and malformed/missing/sentinel estimates remain unknown. This integration uses the existing session-private cache, provider cooldowns and atomic quotas. The browser uses same-origin modules and SVG attributes for charts; CSP is not weakened to allow inline styles.

New/changed research inputs set a server-owned pending flag. The browser processes one job at a time while visible; return visits resume pending records in the same session. Every research call still requires owner session, Origin and CSRF. No public batch endpoint, service credential, cross-visitor scheduler or extended retention was added. Area data and rent-restriction prompts never affect scoring or generate outreach claims.


## Buyer-assessment integrity

Qualification choices and the additional sales fields are allowlisted and normalized on the Worker. Scores, decision objects, history and evidence timestamps supplied by clients are ignored. The server binds each timestamp to the exact group of inputs; changes invalidate the old assessment. Official integration references accept only HTTPS URLs on exact EliseAI documentation hosts, without credentials or ports. They are stored as references and never fetched by the server.

The latest ten assessment changes live inside the existing session-scoped lead JSON, protected by the existing CSRF, ownership, optimistic version and expiry controls. Company/contact-domain changes clear qualifications and their provenance. This is a session record, not an authenticated rep audit trail; no CRM connection or organization-wide account verification is implied. CSV escaping applies to the added fields and serialized evidence.


The Reader failure streak and recovery lease are provider-only D1 records with bounded expiry. Repeated 429s produce exponential backoff, a longer Retry-After takes precedence, and one request tests recovery after a pause. Success cannot clear a newer active cooldown. Logo endpoints only consume cached company-page metadata and cannot spend Reader allowance. Company evidence now has 24-hour reuse; retained retrieval dates remain unchanged.

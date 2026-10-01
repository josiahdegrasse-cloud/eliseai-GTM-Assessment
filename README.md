# EliseAI GTM Assessment — Inbound Desk

An independent interview project that turns an inbound lead into sourced company and contact research, an explained review priority, and an editable outreach email.

**[Open the live app](https://inbound-desk-assessment.henrydegrasse.chatgpt.site/)** · **[Documentation](docs/README.md)** · **[Evaluation and limitations](docs/EVALUATION.md)**

## Try it

1. Load the researched examples, add a lead, or import Excel/CSV/TSV.
2. Review the company facts, source links and High/Medium/Low priority explanation.
3. Review and edit the personalized email draft. Nothing sends automatically.
4. Optionally connect Google Sheets for unattended lead intake.

Company fit and buyer interest are separate. Unknown evidence stays unknown. Public portfolio figures support account research; they do not establish budget, pain or buying authority. [Rules and assumptions](docs/SCORING_AND_OUTREACH.md).

## What is included

- Official company/contact research using Jina and optional Tavily, with bounded free allowances and caching.
- Source-backed portfolio extraction, sales insights and deterministic email drafting.
- Property location and optional neighborhood context, kept separate from qualification.
- Google Sheets intake, isolated visitor workspaces and saved assessment history.
- Regression tests, frozen evaluation cases and documented historical experiments.

This is an interview MVP, not EliseAI's internal system. Human sales review is required; no conversion lift or population-wide accuracy is claimed.

## Run locally

Use Node.js 24 and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm preview
```

Preview runs at `http://127.0.0.1:8765/` with a disposable database and no live provider calls. See [setup, hosting and operating details](docs/OPERATING_GUIDE.md#run-and-verify). Runtime secret names are documented in [.env.example](.env.example); real keys must not be committed.

The app is currently hosted through Sites on Cloudflare Workers with D1. This GitHub repository stores the source; pushing here does **not** automatically deploy the hosted app.

## Repository map

| Folder | Purpose |
|---|---|
| `website/` | Worker API, research, qualification and drafting |
| `static/` | Browser interface and bundled assets |
| `db/`, `drizzle/` | Database schema and migrations |
| `tests/` | Regression and integration tests |
| `test-data/` | Fixtures and dated research results; [guide](test-data/README.md) |
| `scripts/` | Preview, evaluation, benchmark and packaging tools |
| `docs/` | Current documentation and [historical archive](docs/archive/README.md) |
| `design/` | Interview walkthrough and proposed rollout |

Start with the [documentation index](docs/README.md). Historical HTML reports are preserved as downloadable artifacts; GitHub displays their source rather than an interactive report.

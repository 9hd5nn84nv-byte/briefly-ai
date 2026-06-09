# Briefly — AI Industry Intelligence

## What this app does
Briefly delivers a daily AI-generated briefing of the most important tech/AI news
to the founder's inbox. Users subscribe with their email and receive a curated
3-5 story digest each morning.

## Stack
Express.js + EJS + PostgreSQL (Neon) + native RSS/Atom parser + OpenAI for synthesis.
Deployed on Render; scheduled by GitHub Actions.

## Directory map
- `server.js`      — Express entry point; mounts routes, starts listener
- `routes/`        — Express routers; one file per endpoint group
- `services/`       — Shared business logic (scraper, synthesize, email, sources, slack)
- `jobs/`          — Standalone script entry points for the pipeline / weekly digest
- `views/`         — EJS templates (layout.ejs is the landing page)
- `public/css/`    — Stylesheets (theme.css = landing page styles)
- `lib/`           — Landing page context builder
- `migrations/`    — node-pg-migrate migration files (run via `node migrate.js`)
- `.github/workflows/` — `daily-briefing.yml` triggers the briefing on a schedule

## Database
- `users` — subscribers: email, industry, competitors[], keywords[], referral fields,
  slack_webhook_url, onboarded_at, subscription fields
- `briefings` — saved daily briefings: date_str, subject, stories (JSONB), html, counts

## External integrations
- OpenAI (`OPENAI_API_KEY`) — AI synthesis of scraped content into briefing stories.
  Uses api.openai.com directly. Only set `OPENAI_BASE_URL` to override the endpoint.
- Resend (`RESEND_API_KEY`) — delivers HTML briefing emails. `BRIEFLY_FROM_EMAIL`
  sets the From address (needs a verified domain to email non-owner addresses).
- RSS/Atom feeds — ~100 sources in services/sources.js, fetched + parsed in scraper.js.
- Slack (optional) — per-user `slack_webhook_url` or global `SLACK_WEBHOOK_URL`.

## Scheduling
The daily run is triggered by `.github/workflows/daily-briefing.yml`, which calls
`GET /api/briefing/run`. Protect that endpoint by setting `BRIEFING_RUN_TOKEN`
(same value as the GitHub repo secret of the same name).

## Recent changes
- 2026-06-05: Built core briefing pipeline MVP — scraper, AI synthesis, email delivery
- 2026-06-08: Expanded to ~100 sources; wired per-subscriber personalization;
  cut out Polsia (email → Resend, AI → OpenAI direct, cron → GitHub Actions,
  removed analytics beacon).
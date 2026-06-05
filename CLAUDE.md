# Briefly — AI Industry Intelligence

## What this app does
Briefly delivers a daily AI-generated briefing of the most important tech/AI news
to the founder's inbox. Users subscribe with their email and receive a curated
3-5 story digest each morning.

## Stack
Express.js + EJS + PostgreSQL (Neon) + cheerio for scraping + OpenAI for synthesis.

## Directory map
- `server.js`      — Express entry point; mounts routes, starts listener
- `routes/`        — Express routers; one file per endpoint group
- `services/`       — Shared business logic (scraper, AI synthesis)
- `jobs/`          — Cron entry points (runs on schedule via polsia.toml)
- `views/`         — EJS templates (layout.ejs is the landing page)
- `public/css/`    — Stylesheets (theme.css = landing page styles)
- `lib/`           — Landing page context builder
- `db/`            — Database queries (when persistence is added)

## Database
No tables yet — MVP is stateless. Persistence layer added when subscription
storage is needed.

## External integrations
- OpenAI (`OPENAI_API_KEY`) — AI synthesis of scraped content into briefing stories
- Polsia email API (internal) — delivers HTML briefing to subscriber inbox
- RSS/HTML feeds — scraped via cheerio for source content

## Recent changes
- 2026-06-05: Built core briefing pipeline MVP — scraper, AI synthesis, email delivery
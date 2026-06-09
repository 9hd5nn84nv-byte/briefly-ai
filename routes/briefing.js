/**
 * Briefing pipeline — scrapes sources, synthesizes with AI, delivers email.
 * Manual trigger: GET /api/briefing/run
 * Status:         GET /api/briefing/status
 */
const express = require('express');
const router  = express.Router();
const { scrapeAll }                        = require('../services/scraper');
const { synthesizeBriefing }               = require('../services/synthesize');
const { sendBriefingEmail, buildBriefingHtml } = require('../services/email');
const { sendBriefingToSlack }              = require('../services/slack');

// In-memory run tracker (MVP)
let lastRunAt     = null;
let lastRunStatus = 'idle';
let lastRunError  = null;
let lastRunStories = null;

// Optional shared secret protecting the /run endpoint.
// If BRIEFING_RUN_TOKEN is set, callers must pass ?token=<value>.
// If unset, the endpoint stays open (convenient for local/manual testing).
const RUN_TOKEN = process.env.BRIEFING_RUN_TOKEN || '';

// ─────────────────────────────────────────────────────────────
// Core pipeline
// ─────────────────────────────────────────────────────────────
async function runBriefingPipeline(pool) {
  if (!pool) throw new Error('runBriefingPipeline requires a pool argument');

  if (lastRunStatus === 'running') {
    return { status: 'already_running', message: 'A briefing is already in progress' };
  }

  lastRunStatus  = 'running';
  lastRunError   = null;
  lastRunStories = null;
  lastRunAt      = new Date().toISOString();

  try {
    console.log('[briefing] Starting pipeline...');

    // ── Step 1: Scrape all sources (shared across every subscriber) ──
    const articles = await scrapeAll();
    if (articles.length === 0) throw new Error('No articles scraped — check source URLs');
    console.log(`[briefing] Scraped ${articles.length} articles`);

    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });

    // ── Step 2: Generic briefing — saved to DB, shown on /today ──
    const genericStories = await synthesizeBriefing(articles);
    lastRunStories = genericStories;
    console.log(`[briefing] Generated generic briefing (${genericStories.length} stories)`);

    const alertCount    = genericStories.filter(s => s.type === 'alert').length;
    const genericSubject = `Briefly — ${alertCount > 0 ? '🔴 ' : ''}${dateStr}`;
    const genericHtml   = buildBriefingHtml(genericStories, dateStr);

    try {
      await pool.query(
        `INSERT INTO briefings (date_str, subject, stories, html, story_count, article_count)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [dateStr, genericSubject, JSON.stringify(genericStories), genericHtml,
         genericStories.length, articles.length]
      );
      console.log('[briefing] Generic briefing saved to DB');
    } catch (dbErr) {
      console.error('[briefing] DB save failed (non-fatal):', dbErr.message);
    }

    // ── Step 3: Fetch all subscribers with their preferences ──
    let subscribers = [];
    try {
      const result = await pool.query(
        `SELECT email, industry, competitors, keywords, slack_webhook_url
         FROM users
         WHERE email IS NOT NULL`
      );
      subscribers = result.rows;
      console.log(`[briefing] Sending to ${subscribers.length} subscriber(s)...`);
    } catch (dbErr) {
      console.error('[briefing] Could not fetch subscribers (non-fatal):', dbErr.message);
    }

    // ── Step 4: Per-subscriber personalized synthesis + delivery ──
    let sentCount = 0;
    for (const sub of subscribers) {
      try {
        const hasPrefs = sub.industry ||
                         (sub.competitors && sub.competitors.length > 0) ||
                         (sub.keywords    && sub.keywords.length > 0);

        let stories, subject, html;

        if (hasPrefs) {
          // Personalized briefing for this subscriber
          const prefs = {
            industry:    sub.industry    || '',
            competitors: sub.competitors || [],
            keywords:    sub.keywords    || [],
          };
          console.log(`[briefing] Personalizing for ${sub.email} (${prefs.industry || 'no industry'})`);
          stories = await synthesizeBriefing(articles, prefs);
          const personalAlerts = stories.filter(s => s.type === 'alert').length;
          subject = `Briefly — ${personalAlerts > 0 ? '🔴 ' : ''}${dateStr}`;
          html    = buildBriefingHtml(stories, dateStr);
        } else {
          // No prefs set — use the generic briefing (free API call)
          stories = genericStories;
          subject = genericSubject;
          html    = genericHtml;
        }

        await sendBriefingEmail(sub.email, subject, html);
        sentCount++;
      } catch (err) {
        console.error(`[briefing] Failed to send to ${sub.email}:`, err.message);
        // Continue to next subscriber
      }
    }
    console.log(`[briefing] Sent ${sentCount}/${subscribers.length} emails`);

    // ── Step 5: Post generic briefing to global Slack webhook ──
    try {
      if (process.env.SLACK_WEBHOOK_URL) {
        await sendBriefingToSlack(genericStories, dateStr);
      }
    } catch (slackErr) {
      console.error('[briefing] Global Slack post failed (non-fatal):', slackErr.message);
    }

    // ── Step 6: Per-user Slack webhooks (skip global to avoid duplicates) ──
    try {
      const globalWebhook = process.env.SLACK_WEBHOOK_URL || '';
      const slackUsers = await pool.query(
        `SELECT slack_webhook_url FROM users
         WHERE slack_webhook_url IS NOT NULL
           AND slack_webhook_url != ''
           AND slack_webhook_url != $1`,
        [globalWebhook]
      );
      for (const u of slackUsers.rows) {
        try {
          await sendBriefingToSlack(genericStories, dateStr, u.slack_webhook_url);
        } catch (e) {
          console.error('[briefing] Per-user Slack failed (non-fatal):', e.message);
        }
      }
    } catch (slackErr) {
      console.error('[briefing] Per-user Slack query failed (non-fatal):', slackErr.message);
    }

    lastRunStatus = 'success';
    console.log('[briefing] Pipeline complete!');
    return {
      status:   'success',
      stories:  genericStories.length,
      articles: articles.length,
      sent:     sentCount,
      total:    subscribers.length,
    };
  } catch (err) {
    lastRunStatus = 'error';
    lastRunError  = err.message;
    console.error(`[briefing] Pipeline error: ${err.message}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

// Manual + scheduled trigger
router.get('/run', async (req, res) => {
  // Reject unauthorized callers when a token is configured
  if (RUN_TOKEN && req.query.token !== RUN_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const pool = req.app.get('db');
  if (lastRunStatus === 'running') {
    if (req.query.force === '1') {
      lastRunStatus = 'idle';
    } else {
      return res.json({ ok: false, status: 'already_running', message: 'Add ?force=1 to override.' });
    }
  }
  try {
    const result = await runBriefingPipeline(pool);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Debug: test a single source
router.get('/debug', async (_req, res) => {
  const { scrapeSource } = require('../services/scraper');
  const source = { url: 'https://news.ycombinator.com/rss', name: 'Hacker News', priority: 1 };
  const articles = await scrapeSource(source);
  res.json({ count: articles.length, first3: articles.slice(0, 3) });
});

// Debug: test scrapeAll
router.get('/debug-all', async (_req, res) => {
  const articles = await scrapeAll();
  res.json({ count: articles.length, first3: articles.slice(0, 3) });
});

// Status check
router.get('/status', (_req, res) => {
  res.json({ lastRunAt, lastRunStatus, lastRunError, storyCount: lastRunStories?.length ?? null });
});

module.exports = { router, runBriefingPipeline };

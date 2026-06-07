/**
 * Briefing pipeline — scrapes sources, synthesizes with AI, delivers email.
 * Manual trigger: GET /api/briefing/run
 * Status: GET /api/briefing/status
 */
const express = require('express');
const router = express.Router();
const { scrapeAll } = require('../services/scraper');
const { synthesizeBriefing } = require('../services/synthesize');
const { sendBriefingEmail, buildBriefingHtml } = require('../services/email');
const { sendBriefingToSlack } = require('../services/slack');

// Pool is injected per-request via req.app.get('db') or set once on first run
let _pool = null;
function getPool(req) {
  if (req) return req.app.get('db');
  return _pool;
}
function setPool(pool) { _pool = pool; }

// In-memory run tracker (MVP)
let lastRunAt = null;
let lastRunStatus = 'idle';
let lastRunError = null;
let lastRunStories = null;

async function runBriefingPipeline() {
  if (lastRunStatus === 'running') {
    return { status: 'already_running', message: 'A briefing is already in progress' };
  }

  lastRunStatus = 'running';
  lastRunError = null;
  lastRunStories = null;
  lastRunAt = new Date().toISOString();

  try {
    console.log('[briefing] Starting pipeline...');

    // Step 1: Scrape
    const articles = await scrapeAll();
    if (articles.length === 0) throw new Error('No articles scraped — check source URLs');
    console.log(`[briefing] Scraped ${articles.length} articles`);

    // Step 2: Synthesize
    const stories = await synthesizeBriefing(articles);
    lastRunStories = stories;
    console.log(`[briefing] Generated ${stories.length} briefing stories`);

    // Step 3: Build HTML
    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const alertCount = stories.filter(s => s.type === 'alert').length;
    const subject = `Briefly — ${alertCount > 0 ? '🔴 ' : ''}${dateStr}`;
    const html = buildBriefingHtml(stories, dateStr);

    // Step 4: Save briefing to DB
    const pool = getPool();
    try {
      await pool.query(
        `INSERT INTO briefings (date_str, subject, stories, html, story_count, article_count)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [dateStr, subject, JSON.stringify(stories), html, stories.length, articles.length]
      );
      console.log('[briefing] Saved to DB');
    } catch (dbErr) {
      console.error('[briefing] DB save failed (non-fatal):', dbErr.message);
    }

    // Step 5: Send to all subscribers
    let sentCount = 0;
    try {
      const subs = await pool.query(`SELECT email FROM users WHERE email IS NOT NULL`);
      console.log(`[briefing] Sending to ${subs.rows.length} subscriber(s)...`);
      for (const sub of subs.rows) {
        await sendBriefingEmail(sub.email, subject, html);
        sentCount++;
      }
    } catch (emailErr) {
      console.error('[briefing] Email send failed:', emailErr.message);
    }

    // Step 6: Post to Slack (global webhook)
    await sendBriefingToSlack(stories, dateStr);

    // Step 7: Post to per-user Slack webhooks
    try {
      const slackUsers = await pool.query(
        `SELECT slack_webhook_url FROM users WHERE slack_webhook_url IS NOT NULL AND slack_webhook_url != ''`
      );
      for (const u of slackUsers.rows) {
        await sendBriefingToSlack(stories, dateStr, u.slack_webhook_url);
      }
    } catch (slackErr) {
      console.error('[briefing] Per-user Slack failed (non-fatal):', slackErr.message);
    }

    lastRunStatus = 'success';
    console.log('[briefing] Pipeline complete!');
    return { status: 'success', stories: stories.length, articles: articles.length, sent: sentCount };
  } catch (err) {
    lastRunStatus = 'error';
    lastRunError = err.message;
    console.error(`[briefing] Pipeline error: ${err.message}`);
    throw err;
  }
}

// Manual trigger
router.get('/run', async (req, res) => {
  setPool(req.app.get('db'));
  if (lastRunStatus === 'running') {
    if (req.query.force === '1') {
      lastRunStatus = 'idle';
    } else {
      return res.json({ ok: false, status: 'already_running', message: 'Add ?force=1 to override.' });
    }
  }
  try {
    const result = await runBriefingPipeline();
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
  const { scrapeAll } = require('../services/scraper');
  const articles = await scrapeAll();
  res.json({ count: articles.length, first3: articles.slice(0, 3) });
});

// Status check
router.get('/status', (_req, res) => {
  res.json({ lastRunAt, lastRunStatus, lastRunError, storyCount: lastRunStories?.length ?? null });
});

module.exports = { router, runBriefingPipeline };

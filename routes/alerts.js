/**
 * Real-time alert pipeline — runs hourly (via GitHub Actions).
 * Scrapes sources, finds articles that match a subscriber's tracked
 * competitors/keywords, and emails a dedicated alert per *new* match.
 *
 * Trigger: GET /api/alerts/run   (protected by BRIEFING_RUN_TOKEN if set)
 * Status:  GET /api/alerts/status
 */
const express = require('express');
const router  = express.Router();
const { scrapeAll }                 = require('../services/scraper');
const { findAlertWorthyArticles }   = require('../services/synthesize');
const { sendBriefingEmail, buildAlertHtml } = require('../services/email');

const RUN_TOKEN = process.env.BRIEFING_RUN_TOKEN || '';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Only alert on articles published in the last N hours — prevents the first
// run from blasting out the entire backlog. Combined with the sent_alerts
// dedup table, each story alerts at most once per user.
const ALERT_RECENCY_HOURS = 3;
// Cap per user per run so a busy news hour can't flood an inbox.
const MAX_ALERTS_PER_USER = 3;

let lastRunAt = null;
let lastRunStatus = 'idle';
let lastRunError = null;

// Which tracked term triggered this alert (for the subject + banner)
function matchedTerm(article, prefs) {
  const title = (article.title || '').toLowerCase();
  const terms = [...(prefs.competitors || []), ...(prefs.keywords || [])];
  return terms.find(t => t && title.includes(t.toLowerCase())) || 'your watchlist';
}

async function runAlertsPipeline(pool) {
  if (!pool) throw new Error('runAlertsPipeline requires a pool argument');
  if (lastRunStatus === 'running') {
    return { status: 'already_running', message: 'An alert run is already in progress' };
  }

  lastRunStatus = 'running';
  lastRunError  = null;
  lastRunAt     = new Date().toISOString();

  try {
    console.log('[alerts] Starting alert run...');

    const articles = await scrapeAll();
    const cutoff = Date.now() - ALERT_RECENCY_HOURS * 3600 * 1000;
    const recent = articles.filter(a => {
      if (!a.publishedAt) return false; // can't confirm freshness → skip
      const t = new Date(a.publishedAt).getTime();
      return !Number.isNaN(t) && t >= cutoff;
    });
    console.log(`[alerts] ${recent.length} articles in the last ${ALERT_RECENCY_HOURS}h`);

    if (recent.length === 0) {
      lastRunStatus = 'success';
      return { status: 'success', recent: 0, subscribers: 0, alertsSent: 0 };
    }

    let subscribers = [];
    try {
      const result = await pool.query(
        `SELECT email, competitors, keywords FROM users WHERE email IS NOT NULL`
      );
      subscribers = result.rows;
    } catch (dbErr) {
      console.error('[alerts] Could not fetch subscribers:', dbErr.message);
      throw dbErr;
    }

    let alertsSent = 0;
    for (const sub of subscribers) {
      const prefs = { competitors: sub.competitors || [], keywords: sub.keywords || [] };
      if (prefs.competitors.length === 0 && prefs.keywords.length === 0) continue;

      const matches = findAlertWorthyArticles(recent, prefs);
      let sentForUser = 0;

      for (const article of matches) {
        if (sentForUser >= MAX_ALERTS_PER_USER) break;
        if (!article.url) continue;

        // Claim this (user, article) pair atomically. If it already exists,
        // rowCount is 0 → we've alerted before → skip.
        const claim = await pool.query(
          `INSERT INTO sent_alerts (user_email, article_url)
           VALUES ($1, $2)
           ON CONFLICT (user_email, article_url) DO NOTHING
           RETURNING id`,
          [sub.email, article.url]
        );
        if (claim.rowCount === 0) continue;

        const term    = matchedTerm(article, prefs);
        const subject = `🔴 ${term}: ${(article.title || '').slice(0, 80)}`;
        const html    = buildAlertHtml(article, term);

        const r = await sendBriefingEmail(sub.email, subject, html);
        if (r && r.success) {
          alertsSent++;
          sentForUser++;
        } else {
          // Send failed — release the claim so a later run can retry.
          await pool.query(
            `DELETE FROM sent_alerts WHERE user_email = $1 AND article_url = $2`,
            [sub.email, article.url]
          );
          console.error(`[alerts] Send failed to ${sub.email}: ${r?.reason || 'unknown'}`);
        }
        await sleep(600); // Resend rate limit
      }
    }

    lastRunStatus = 'success';
    console.log(`[alerts] Done — ${alertsSent} alert(s) sent`);
    return {
      status: 'success',
      recent: recent.length,
      subscribers: subscribers.length,
      alertsSent,
    };
  } catch (err) {
    lastRunStatus = 'error';
    lastRunError  = err.message;
    console.error(`[alerts] Pipeline error: ${err.message}`);
    throw err;
  }
}

router.get('/run', async (req, res) => {
  if (RUN_TOKEN && req.query.token !== RUN_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (lastRunStatus === 'running') {
    if (req.query.force === '1') lastRunStatus = 'idle';
    else return res.json({ ok: false, status: 'already_running', message: 'Add ?force=1 to override.' });
  }
  const pool = req.app.get('db');
  try {
    const result = await runAlertsPipeline(pool);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Diagnostic — shows what the alert engine sees, without sending anything.
// e.g. /api/alerts/debug?email=you@example.com
router.get('/debug', async (req, res) => {
  if (RUN_TOKEN && req.query.token !== RUN_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  const pool  = req.app.get('db');
  const email = req.query.email || '';
  try {
    const articles = await scrapeAll();
    const cutoff = Date.now() - ALERT_RECENCY_HOURS * 3600 * 1000;
    const withDates = articles.filter(a => {
      if (!a.publishedAt) return false;
      const t = new Date(a.publishedAt).getTime();
      return !Number.isNaN(t);
    });
    const recent = withDates.filter(a => new Date(a.publishedAt).getTime() >= cutoff);

    let user = 'no email provided';
    let matchCount = 0;
    let matches = [];
    if (email) {
      const r = await pool.query(
        `SELECT email, competitors, keywords FROM users WHERE LOWER(email) = LOWER($1)`,
        [email]
      );
      if (r.rows[0]) {
        const u = r.rows[0];
        user = { email: u.email, competitors: u.competitors || [], keywords: u.keywords || [] };
        const found = findAlertWorthyArticles(recent, { competitors: u.competitors || [], keywords: u.keywords || [] });
        matchCount = found.length;
        matches = found.slice(0, 10).map(a => ({ title: a.title, publishedAt: a.publishedAt, url: a.url }));
      } else {
        user = `not found: ${email}`;
      }
    }

    res.json({
      totalArticles: articles.length,
      articlesWithParseableDate: withDates.length,
      recentArticles: recent.length,
      recencyWindowHours: ALERT_RECENCY_HOURS,
      newestArticles: withDates
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
        .slice(0, 5)
        .map(a => ({ title: a.title.slice(0, 70), publishedAt: a.publishedAt })),
      user,
      matchCount,
      matches,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/status', (_req, res) => {
  res.json({ lastRunAt, lastRunStatus, lastRunError });
});

module.exports = { router, runAlertsPipeline };

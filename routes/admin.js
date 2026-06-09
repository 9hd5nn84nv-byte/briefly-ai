/**
 * Admin dashboard — private overview of subscribers, briefings, and alerts.
 *
 * Protected by a token. Set ADMIN_TOKEN (falls back to BRIEFING_RUN_TOKEN)
 * in the environment, then visit /admin?token=YOUR_TOKEN.
 *
 * GET  /admin                  → dashboard
 * POST /admin/run-briefing     → trigger the daily briefing pipeline
 * POST /admin/run-alerts       → trigger the real-time alert check
 * POST /admin/delete-subscriber→ remove a subscriber (purge test/spam rows)
 */
const express = require('express');
const router  = express.Router();
const { runBriefingPipeline } = require('./briefing');
const { runAlertsPipeline }   = require('./alerts');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.BRIEFING_RUN_TOKEN || '';

// Shared auth check for both GET (query) and POST (form body) routes.
function authed(req) {
  return ADMIN_TOKEN && (req.query.token === ADMIN_TOKEN || req.body.token === ADMIN_TOKEN);
}
function backToAdmin(res, msg) {
  res.redirect(`/admin?token=${encodeURIComponent(ADMIN_TOKEN)}${msg ? `&msg=${msg}` : ''}`);
}

router.get('/', async (req, res) => {
  if (!ADMIN_TOKEN) {
    return res
      .status(403)
      .send('Admin is locked. Set an ADMIN_TOKEN environment variable in Render, then visit /admin?token=YOUR_TOKEN');
  }
  if (req.query.token !== ADMIN_TOKEN) {
    return res.status(401).send('Unauthorized. Append ?token=YOUR_ADMIN_TOKEN to the URL.');
  }

  const pool = req.app.get('db');

  // Run every query independently so a missing/empty table can't 500 the page.
  const results = await Promise.allSettled([
    pool.query(`
      SELECT
        COUNT(*)::int                                                  AS total,
        COUNT(onboarded_at)::int                                       AS onboarded,
        COUNT(*) FILTER (WHERE COALESCE(array_length(competitors,1),0) > 0)::int AS with_competitors
      FROM users
    `),
    pool.query(`
      SELECT email, industry, competitors, keywords, slack_webhook_url, onboarded_at, created_at
      FROM users
      ORDER BY created_at DESC NULLS LAST
      LIMIT 200
    `),
    pool.query(`
      SELECT date_str, subject, story_count, article_count, created_at
      FROM briefings
      ORDER BY created_at DESC
      LIMIT 15
    `),
    pool.query(`
      SELECT
        COUNT(*)::int                                                       AS total,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS last24h
      FROM sent_alerts
    `),
    pool.query(`
      SELECT user_email, article_url, created_at
      FROM sent_alerts
      ORDER BY created_at DESC
      LIMIT 15
    `),
  ]);

  const rows = (i, def) => (results[i].status === 'fulfilled' ? results[i].value.rows : def);
  const first = (i, def) => {
    const r = rows(i, null);
    return r && r[0] ? r[0] : def;
  };

  // Log any failures for debugging, but still render the page.
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`[admin] query ${i} failed:`, r.reason?.message);
  });

  res.render('admin', {
    token:        ADMIN_TOKEN,
    msg:          req.query.msg || '',
    stats:        first(0, { total: 0, onboarded: 0, with_competitors: 0 }),
    subscribers:  rows(1, []),
    briefings:    rows(2, []),
    alertStats:   first(3, { total: 0, last24h: 0 }),
    recentAlerts: rows(4, []),
  });
});

// ── Actions (POST, token-gated) ──────────────────────────────

// Kick off the daily briefing pipeline (fire-and-forget; it takes ~90s).
router.post('/run-briefing', (req, res) => {
  if (!authed(req)) return res.status(401).send('Unauthorized.');
  const pool = req.app.get('db');
  runBriefingPipeline(pool).catch(e => console.error('[admin] briefing run failed:', e.message));
  backToAdmin(res, 'briefing_started');
});

// Kick off the real-time alert check (fire-and-forget).
router.post('/run-alerts', (req, res) => {
  if (!authed(req)) return res.status(401).send('Unauthorized.');
  const pool = req.app.get('db');
  runAlertsPipeline(pool).catch(e => console.error('[admin] alerts run failed:', e.message));
  backToAdmin(res, 'alerts_started');
});

// Remove a subscriber (and their alert history). Used to purge test/spam rows.
router.post('/delete-subscriber', async (req, res) => {
  if (!authed(req)) return res.status(401).send('Unauthorized.');
  const email = (req.body.email || '').trim();
  if (!email) return backToAdmin(res, 'delete_failed');
  const pool = req.app.get('db');
  try {
    await pool.query(`DELETE FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    await pool.query(`DELETE FROM sent_alerts WHERE LOWER(user_email) = LOWER($1)`, [email]).catch(() => {});
    backToAdmin(res, 'deleted');
  } catch (e) {
    console.error('[admin] delete failed:', e.message);
    backToAdmin(res, 'delete_failed');
  }
});

module.exports = router;

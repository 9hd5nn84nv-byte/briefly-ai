/**
 * Weekly digest cron job — synthesizes the past 7 days of briefings into a
 * "big picture" email and sends to all subscribers.
 * Run via: node jobs/weekly-digest.js
 * Schedule: Sundays at 8 AM via polsia.toml [[crons]]
 */
require('../server');

const pool = require('../db/pool');
const { synthesizeBriefing } = require('../services/synthesize');
const { sendBriefingEmail, buildWeeklyDigestHtml } = require('../services/email');

(async () => {
  console.log('[weekly-digest] Starting...');

  try {
    // Pull last 7 briefings from DB
    const result = await pool.query(
      `SELECT stories, date_str FROM briefings ORDER BY created_at DESC LIMIT 7`
    );

    if (result.rows.length === 0) {
      console.log('[weekly-digest] No briefings found — skipping');
      process.exit(0);
    }

    // Flatten all stories from the week
    const allStories = result.rows.flatMap(row =>
      Array.isArray(row.stories) ? row.stories : []
    );

    // Deduplicate by title similarity (simple check)
    const seen = new Set();
    const uniqueStories = allStories.filter(s => {
      const key = s.title.slice(0, 40).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Build week label
    const oldest = result.rows[result.rows.length - 1].date_str || '';
    const newest = result.rows[0].date_str || '';
    const weekLabel = oldest && newest ? `${oldest} – ${newest}` : newest || 'This Week';

    const html = buildWeeklyDigestHtml(uniqueStories, weekLabel);
    const subject = `Briefly Weekly — The Week in AI & Tech`;

    // Send to all subscribers
    const subs = await pool.query(`SELECT email FROM users WHERE email IS NOT NULL`);
    console.log(`[weekly-digest] Sending to ${subs.rows.length} subscriber(s)...`);

    for (const sub of subs.rows) {
      await sendBriefingEmail(sub.email, subject, html);
    }

    console.log('[weekly-digest] Done!');
    process.exit(0);
  } catch (err) {
    console.error('[weekly-digest] Failed:', err.message);
    process.exit(1);
  }
})();

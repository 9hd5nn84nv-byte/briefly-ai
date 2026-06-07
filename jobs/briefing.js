/**
 * Daily briefing cron job entry point.
 * Run via: node jobs/briefing.js
 * Scheduled via polsia.toml [[crons]]
 */
const app = require('../server');
const { runBriefingPipeline } = require('../routes/briefing');

(async () => {
  console.log('[briefing:cron] Starting daily briefing run...');
  const pool = app.get('db');
  try {
    const result = await runBriefingPipeline(pool);
    console.log('[briefing:cron] Done:', JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    console.error('[briefing:cron] Failed:', err.message);
    process.exit(1);
  }
})();

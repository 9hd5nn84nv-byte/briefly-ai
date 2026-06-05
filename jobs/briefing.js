/**
 * Daily briefing cron job entry point.
 * Run via: node jobs/briefing.js
 * Scheduled via polsia.toml [[crons]]
 */
require('../server'); // Load env + DB pool

const { runBriefingPipeline } = require('../routes/briefing');

(async () => {
  console.log('[briefing:cron] Starting daily briefing run...');
  try {
    const result = await runBriefingPipeline();
    console.log('[briefing:cron] Done:', JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    console.error('[briefing:cron] Failed:', err.message);
    process.exit(1);
  }
})();
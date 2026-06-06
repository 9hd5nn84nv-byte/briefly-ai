const express = require('express');
const router = express.Router();

// Cache results for 60s so every page load doesn't hit the DB
let cache = { data: null, at: 0 };
const CACHE_TTL = 60 * 1000;

router.get('/', async (req, res) => {
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_TTL) {
    return res.json(cache.data);
  }

  const pool = req.app.get('db');
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)                                             AS total_subscribers,
        COUNT(*) FILTER (WHERE subscription_status = 'active') AS active_paid
      FROM users
    `);
    const row = result.rows[0];
    const data = {
      totalSubscribers: parseInt(row.total_subscribers, 10),
      activePaid: parseInt(row.active_paid, 10),
    };
    cache = { data, at: now };
    res.json(data);
  } catch (err) {
    console.error('[stats] DB error:', err.message);
    res.status(500).json({ totalSubscribers: 0, activePaid: 0 });
  }
});

module.exports = router;

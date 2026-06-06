const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  const pool = req.app.get('db');

  try {
    const result = await pool.query(
      `SELECT * FROM briefings ORDER BY created_at DESC LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.render('today', { briefing: null });
    }

    res.render('today', { briefing: result.rows[0] });
  } catch (err) {
    console.error('[today] DB error:', err.message);
    res.render('today', { briefing: null });
  }
});

module.exports = router;

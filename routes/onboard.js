const express = require('express');
const router = express.Router();

// GET /onboard?email=xxx — show onboarding form
router.get('/', (req, res) => {
  const email = req.query.email || '';
  res.render('onboard', { email });
});

// POST /onboard — save preferences
router.post('/', async (req, res) => {
  const { email, industry, competitors, keywords, slack_webhook_url } = req.body;

  if (!email) return res.redirect('/');

  const pool = req.app.get('db');

  const competitorList = (competitors || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const keywordList = (keywords || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  try {
    await pool.query(
      `UPDATE users SET
        industry          = $1,
        competitors       = $2,
        keywords          = $3,
        slack_webhook_url = $4,
        onboarded_at      = NOW()
       WHERE LOWER(email) = LOWER($5)`,
      [industry || null, competitorList, keywordList, slack_webhook_url || null, email]
    );
  } catch (err) {
    console.error('[onboard] DB error:', err.message);
  }

  res.redirect('/?onboarded=1');
});

module.exports = router;

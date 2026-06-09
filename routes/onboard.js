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

  if (!email || !email.trim()) {
    return res.status(400).send('An email is required. Please go back and enter the email you subscribed with.');
  }

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
    const result = await pool.query(
      `UPDATE users SET
        industry          = $1,
        competitors       = $2,
        keywords          = $3,
        slack_webhook_url = $4,
        onboarded_at      = NOW()
       WHERE LOWER(email) = LOWER($5)`,
      [industry || null, competitorList, keywordList, slack_webhook_url || null, email.trim()]
    );

    // No existing subscriber with this email — create one so onboarding never
    // silently no-ops for someone who hasn't hit the signup form yet.
    if (result.rowCount === 0) {
      await pool.query(
        `INSERT INTO users (email, industry, competitors, keywords, slack_webhook_url, onboarded_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [email.trim(), industry || null, competitorList, keywordList, slack_webhook_url || null]
      );
    }
  } catch (err) {
    console.error('[onboard] DB error:', err.message);
    return res.status(500).send('Something went wrong saving your preferences. Please go back and try again.');
  }

  res.redirect('/?onboarded=1');
});

module.exports = router;

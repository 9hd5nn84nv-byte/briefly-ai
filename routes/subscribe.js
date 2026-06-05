const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }

  const pool = req.app.get('db');

  try {
    await pool.query(
      `INSERT INTO users (email) VALUES ($1)
       ON CONFLICT (LOWER(email)) DO NOTHING`,
      [email.trim().toLowerCase()]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[subscribe] DB error:', err.message);
    res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;

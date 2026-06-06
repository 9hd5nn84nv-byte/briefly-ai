const express = require('express');
const router = express.Router();

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

router.post('/', async (req, res) => {
  const { email, ref } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }

  const pool = req.app.get('db');
  const referralCode = generateReferralCode();

  try {
    // Insert subscriber with their new referral code
    const result = await pool.query(
      `INSERT INTO users (email, referral_code)
       VALUES ($1, $2)
       ON CONFLICT (LOWER(email)) DO UPDATE SET referral_code = COALESCE(users.referral_code, EXCLUDED.referral_code)
       RETURNING referral_code`,
      [email.trim().toLowerCase(), referralCode]
    );

    const userReferralCode = result.rows[0]?.referral_code || referralCode;

    // If they came via a referral link, credit the referrer
    if (ref) {
      await pool.query(
        `UPDATE users SET referral_count = referral_count + 1 WHERE referral_code = $1`,
        [ref]
      ).catch(() => {}); // Non-fatal

      await pool.query(
        `UPDATE users SET referred_by = $1 WHERE LOWER(email) = LOWER($2) AND referred_by IS NULL`,
        [ref, email.trim()]
      ).catch(() => {});
    }

    res.json({ ok: true, referralCode: userReferralCode });
  } catch (err) {
    console.error('[subscribe] DB error:', err.message);
    res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;

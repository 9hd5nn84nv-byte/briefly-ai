const express = require('express');
const router = express.Router();

// /ref/:code — stores the referral code and redirects to homepage
router.get('/:code', (req, res) => {
  const code = req.params.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) return res.redirect('/');
  // Pass ref code as query param — JS on homepage picks it up and stores in localStorage
  res.redirect(`/?ref=${encodeURIComponent(code)}`);
});

module.exports = router;

module.exports = {
  name: 'add_user_preferences',
  up: async (client) => {
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS industry        VARCHAR(255),
        ADD COLUMN IF NOT EXISTS competitors     TEXT[],
        ADD COLUMN IF NOT EXISTS keywords        TEXT[],
        ADD COLUMN IF NOT EXISTS referral_code   VARCHAR(20) UNIQUE,
        ADD COLUMN IF NOT EXISTS referred_by     VARCHAR(20),
        ADD COLUMN IF NOT EXISTS referral_count  INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT,
        ADD COLUMN IF NOT EXISTS onboarded_at    TIMESTAMPTZ
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS users_referral_code_idx ON users (referral_code)
    `);
  },
};

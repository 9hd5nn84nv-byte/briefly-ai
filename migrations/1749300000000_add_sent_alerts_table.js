module.exports = {
  name: 'add_sent_alerts_table',
  up: async (client) => {
    // Tracks which real-time alerts have already been sent to which user,
    // so the hourly alert job never sends the same story twice.
    await client.query(`
      CREATE TABLE IF NOT EXISTS sent_alerts (
        id          SERIAL PRIMARY KEY,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        user_email  VARCHAR(255) NOT NULL,
        article_url TEXT NOT NULL
      )
    `);

    // One alert per (user, article) — enables INSERT ... ON CONFLICT DO NOTHING
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sent_alerts_email_url_idx
        ON sent_alerts (user_email, article_url)
    `);

    // Used to prune old rows over time
    await client.query(`
      CREATE INDEX IF NOT EXISTS sent_alerts_created_at_idx
        ON sent_alerts (created_at DESC)
    `);
  },
};

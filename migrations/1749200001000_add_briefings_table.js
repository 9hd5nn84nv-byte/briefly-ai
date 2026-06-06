module.exports = {
  name: 'add_briefings_table',
  up: async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS briefings (
        id           SERIAL PRIMARY KEY,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        date_str     VARCHAR(100),
        subject      VARCHAR(255),
        stories      JSONB NOT NULL,
        html         TEXT,
        story_count  INT,
        article_count INT
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS briefings_created_at_idx ON briefings (created_at DESC)
    `);
  },
};

/**
 * Express entry point — wires middleware, mounts routes, starts listener.
 * Cap: 300 lines. All route groups live in routes/. All DB access via db/.
 */
const express = require('express');
const path = require('path');
const { buildLandingContext } = require('./lib/landing-context');
const { router: briefingRouter } = require('./routes/briefing');
const subscribeRouter = require('./routes/subscribe');
const statsRouter = require('./routes/stats');

const app = express();
const port = process.env.PORT || 3000;

// DATABASE_URL is set by the Neon provisioner; fail fast if missing
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

// Neon auto-suspends idle connections — pool errors are non-fatal
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});
pool.on('error', (err) => {
  console.error('[pg pool] idle client error (non-fatal):', err && err.message);
});

// Make pool available to db/ modules
app.set('db', pool);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// EJS view engine — landing page served from views/layout.ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files (css, js, images) — `index: false` so / doesn't serve public/index.html
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Health check (Render requires this — does NOT query DB so Neon can auto-suspend)
app.get('/health', (_req, res) => res.json({ status: 'healthy' }));

// Landing page
app.get('/', (_req, res) => res.render('layout', buildLandingContext()));

// API routes
app.use('/api/briefing', briefingRouter);
app.use('/api/subscribe', subscribeRouter);
app.use('/api/stats', statsRouter);

// Only start HTTP server when run as `node server.js` (not when required as module)
if (require.main === module) {
  app.listen(port, () => console.log(`Briefly running on port ${port}`));
}

module.exports = app;
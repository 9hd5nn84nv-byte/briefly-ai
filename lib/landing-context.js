/**
 * Builds the render context passed to `views/layout.ejs`.
 *
 *   themeCSS: HTML chunk that loads the site stylesheet(s).
 *             Emits one `<link rel="stylesheet">` per file under
 *             public/css/. Use in the layout via `<%- themeCSS %>`.
 *
 * CSS files are read on each request. The directory is tiny (typically one
 * file) and the read is negligible compared to render time. Memoize at boot
 * if it ever becomes a hot path.
 */
const fs = require('fs');
const path = require('path');

const CSS_DIR = path.join(__dirname, '..', 'public', 'css');

function buildThemeCSS() {
  if (!fs.existsSync(CSS_DIR)) return '';
  const files = fs
    .readdirSync(CSS_DIR)
    .filter((f) => f.endsWith('.css'))
    .sort();
  if (files.length === 0) return '';
  return files.map((f) => `<link rel="stylesheet" href="/css/${f}">`).join('\n');
}

function buildLandingContext() {
  return {
    theme: {},
    themeCSS: buildThemeCSS(),
  };
}

module.exports = { buildLandingContext, buildThemeCSS };

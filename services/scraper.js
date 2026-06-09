/**
 * Web scraper — fetches and parses RSS/HTML from news sources.
 * Uses native fetch + expat-style tag extraction (no external deps).
 */
const { SOURCES } = require('./sources');

const USER_AGENT = 'Briefly/1.0 (AI industry briefing; contact: colecarriger53@gmail.com)';
const TIMEOUT_MS = 12000;

/**
 * Strip CDATA wrappers and decode common XML entities.
 */
function cleanFeedXml(raw) {
  return raw
    .replace(/<![[\r\n\t ]*CDATA\//gi, '<!--CDATA_START')
    .replace(/]]>/g, '<!--CDATA_END-->')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, (m) => m) // keep tags
    ;
}

/**
 * Extract all text content from an XML block between opening and closing tags.
 * Handles nested tags.
 */
function extractTagText(xml, tagName) {
  const open = `<${tagName}`;
  const close = `</${tagName}>`;
  const start = xml.indexOf(open);
  if (start === -1) return '';
  const tagEnd = xml.indexOf('>', start);
  if (tagEnd === -1) return '';
  const contentStart = tagEnd + 1;
  const endIdx = xml.indexOf(close, contentStart);
  if (endIdx === -1) return '';
  return xml.slice(contentStart, endIdx).trim();
}

/**
 * Extract all instances of a tag from an XML string.
 */
function extractAllTags(xml, tagName) {
  const results = [];
  const open = `<${tagName}`;
  const close = `</${tagName}>`;
  let pos = 0;
  while (pos < xml.length) {
    const start = xml.indexOf(open, pos);
    if (start === -1) break;
    const tagEnd = xml.indexOf('>', start);
    if (tagEnd === -1) { pos = start + 1; continue; }
    const contentStart = tagEnd + 1;
    const endIdx = xml.indexOf(close, contentStart);
    if (endIdx === -1) break;
    results.push(xml.slice(contentStart, endIdx));
    pos = endIdx + close.length;
  }
  return results;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').replace(/[\r\n\t]+/g, ' ').trim();
}

function cleanText(str) {
  return str.replace(/\\s+/g, ' ').replace(/[\r\n\t]+/g, ' ').trim();
}

/**
 * Parse a feed XML string and return articles.
 * Handles both RSS 2.0 and Atom formats.
 */
function parseFeedXml(rawXml, source) {
  const xml = cleanFeedXml(rawXml);

  // Detect feed type
  if (xml.includes('<rss') || xml.includes('<channel')) {
    return parseRSSItems(xml, source);
  } else if (xml.includes('<feed')) {
    return parseAtomItems(xml, source);
  }
  return [];
}

function parseRSSItems(xml, source) {
  const channelStart = xml.indexOf('<channel>');
  if (channelStart === -1) return [];
  const channelEnd = xml.indexOf('</channel>');
  const channel = xml.slice(channelStart, channelEnd + '</channel>'.length);

  const itemBlocks = extractAllTags(channel, 'item');
  const articles = [];

  for (const block of itemBlocks) {
    const title = cleanText(extractTagText(block, 'title'));
    const link = cleanText(extractTagText(block, 'link'));
    const description = cleanText(stripTags(extractTagText(block, 'description') || extractTagText(block, 'content:encoded')));
    const pubDate = cleanText(extractTagText(block, 'pubDate'));

    if (!title || title.length < 3) continue;

    articles.push({
      title,
      url: link,
      description: description.slice(0, 500),
      publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
      sourceName: source.name,
    });
  }
  return articles;
}

function parseAtomItems(xml, source) {
  const feedEnd = xml.indexOf('</feed>');
  const feed = feedEnd === -1 ? xml : xml.slice(0, feedEnd + '</feed>'.length);

  const entryBlocks = extractAllTags(feed, 'entry');
  const articles = [];

  for (const block of entryBlocks) {
    const title = cleanText(extractTagText(block, 'title'));
    const linkBlock = extractTagText(block, 'link');
    // Atom link can be href attribute or text content
    const link = cleanText(linkBlock.match(/href=["']([^"']+)["']/)?.[1] || linkBlock);
    const summary = cleanText(stripTags(extractTagText(block, 'summary') || extractTagText(block, 'content')));
    const published = cleanText(extractTagText(block, 'published') || extractTagText(block, 'updated'));

    if (!title || title.length < 3) continue;

    articles.push({
      title,
      url: link,
      description: summary.slice(0, 500),
      publishedAt: published ? new Date(published).toISOString() : null,
      sourceName: source.name,
    });
  }
  return articles;
}

/**
 * Fetch a single source URL and return parsed articles.
 */
async function scrapeSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(source.url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[scraper] ${source.name} returned ${res.status}`);
      return [];
    }

    const text = await res.text();
    const articles = parseFeedXml(text, source);
    return articles;
  } catch (err) {
    clearTimeout(timer);
    if (err.name !== 'AbortError') {
      console.warn(`[scraper] ${source.name}: ${err.message}`);
    }
    return [];
  }
}

/**
 * Scrape all sources, deduplicate, sort by recency.
 */
async function scrapeAll() {
  const allArticles = [];

  // Process in batches of 10 — safe with 12 s per-source timeout
  const BATCH_SIZE = 10;
  for (let i = 0; i < SOURCES.length; i += BATCH_SIZE) {
    const batch = SOURCES.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(s => scrapeSource(s)));
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
      }
    }
  }

  // Deduplicate by URL
  const seen = new Set();
  const unique = allArticles.filter(a => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  // Sort by date, newest first
  unique.sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0;
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });

  console.log(`[scraper] ${unique.length} unique articles from ${SOURCES.length} sources`);
  return unique;
}

module.exports = { scrapeAll, scrapeSource };
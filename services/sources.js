/**
 * Source list — 20 high-signal RSS/HTML feeds for tech/AI industry focus.
 * Each source has: url, name, category, priority
 *   priority: 1 = must-include (top signal), 2 = important, 3 = supplemental
 */

const SOURCES = [
  // Top signal
  { url: 'https://news.ycombinator.com/rss', name: 'Hacker News', category: 'community', priority: 1 },
  { url: 'https://www.theinformation.com/rss', name: 'The Information', category: 'journalism', priority: 1 },
  { url: 'https://stratechery.com/feed/', name: 'Stratechery', category: 'analysis', priority: 1 },

  // Important tech/AI
  { url: 'https://techcrunch.com/feed/', name: 'TechCrunch', category: 'news', priority: 2 },
  { url: 'https://feeds.feedburner.com/venturebeat/SZYF', name: 'VentureBeat', category: 'news', priority: 2 },
  { url: 'https://www.wired.com/feed/rss', name: 'Wired', category: 'news', priority: 2 },
  { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge', category: 'news', priority: 2 },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', name: 'Ars Technica', category: 'news', priority: 2 },
  { url: 'https://www.technologyreview.com/feed/', name: 'MIT Tech Review', category: 'research', priority: 2 },

  // AI-specific
  { url: 'https://blogs.nvidia.com/feed/', name: 'NVIDIA Blog', category: 'ai_chip', priority: 2 },
  { url: 'https://ai.googleblog.com/feeds/blog/blog.xml', name: 'Google AI Blog', category: 'ai_research', priority: 2 },
  { url: 'https://openai.com/blog/rss/', name: 'OpenAI Blog', category: 'ai_research', priority: 2 },
  { url: 'https://anthropic.com/rss.xml', name: 'Anthropic News', category: 'ai_research', priority: 2 },

  // Business/startup
  { url: 'https://feeds.feedburner.com/businessinsider', name: 'Business Insider', category: 'business', priority: 3 },
  { url: 'https://www.semafor.com/rss.xml', name: 'Semafor', category: 'news', priority: 3 },
  { url: 'https://www.protocol.com/rss', name: 'Protocol', category: 'news', priority: 3 },
  { url: 'https://monday.com/blog/feed/', name: 'Monday.com Blog', category: 'saas', priority: 3 },

  // Developer/technical
  { url: 'https://dev.to/feed', name: 'DEV Community', category: 'developer', priority: 3 },
  { url: 'https://stackoverflow.blog/feed/', name: 'Stack Overflow Blog', category: 'developer', priority: 3 },
  { url: 'https://github.blog/engineering.atom', name: 'GitHub Engineering', category: 'developer', priority: 3 },
];

module.exports = { SOURCES };
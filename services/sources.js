/**
 * Source list — 100+ high-signal RSS/Atom feeds across tech, AI, startups,
 * VC, engineering, business, policy, and community.
 *
 * priority: 1 = must-include, 2 = important, 3 = supplemental
 * category: used for future per-user filtering
 */

const SOURCES = [

  // ============================================================
  // TIER 1 — Highest signal, always read
  // ============================================================
  { url: 'https://news.ycombinator.com/rss',            name: 'Hacker News',          category: 'community',   priority: 1 },
  { url: 'https://techcrunch.com/feed/',                 name: 'TechCrunch',           category: 'news',        priority: 1 },
  { url: 'https://stratechery.com/feed/',               name: 'Stratechery',           category: 'analysis',    priority: 1 },
  { url: 'https://www.theinformation.com/rss',          name: 'The Information',       category: 'journalism',  priority: 1 },
  { url: 'https://www.ycombinator.com/blog/rss.xml',    name: 'Y Combinator Blog',     category: 'vc',          priority: 1 },
  { url: 'https://openai.com/blog/rss/',                name: 'OpenAI Blog',           category: 'ai',          priority: 1 },
  { url: 'https://anthropic.com/rss.xml',               name: 'Anthropic',             category: 'ai',          priority: 1 },
  { url: 'https://huggingface.co/blog/feed.xml',        name: 'Hugging Face',          category: 'ai',          priority: 1 },
  { url: 'https://news.crunchbase.com/feed/',           name: 'Crunchbase News',       category: 'startups',    priority: 1 },

  // ============================================================
  // TECH & AI NEWS
  // ============================================================
  { url: 'https://feeds.feedburner.com/venturebeat/SZYF', name: 'VentureBeat',        category: 'news',        priority: 2 },
  { url: 'https://www.wired.com/feed/rss',              name: 'Wired',                 category: 'news',        priority: 2 },
  { url: 'https://www.theverge.com/rss/index.xml',      name: 'The Verge',             category: 'news',        priority: 2 },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', name: 'Ars Technica',      category: 'news',        priority: 2 },
  { url: 'https://www.technologyreview.com/feed/',      name: 'MIT Tech Review',       category: 'research',    priority: 2 },
  { url: 'https://www.zdnet.com/news/rss.xml',          name: 'ZDNet',                 category: 'news',        priority: 2 },
  { url: 'https://www.engadget.com/rss.xml',            name: 'Engadget',              category: 'news',        priority: 2 },
  { url: 'https://spectrum.ieee.org/feeds/feed.rss',    name: 'IEEE Spectrum',         category: 'research',    priority: 2 },
  { url: 'https://www.theregister.com/headlines.atom',  name: 'The Register',          category: 'news',        priority: 2 },
  { url: 'https://www.semafor.com/rss.xml',             name: 'Semafor',               category: 'news',        priority: 2 },
  { url: 'https://feed.infoq.com/',                     name: 'InfoQ',                 category: 'developer',   priority: 2 },
  { url: 'https://feeds.reuters.com/reuters/technologyNews', name: 'Reuters Technology', category: 'news',      priority: 2 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', name: 'NYT Technology', category: 'news', priority: 2 },
  { url: 'https://www.axios.com/feeds/feed.rss',        name: 'Axios',                 category: 'news',        priority: 2 },
  { url: 'https://fortune.com/feed/',                   name: 'Fortune',               category: 'business',    priority: 2 },
  { url: 'https://www.businessinsider.com/rss',         name: 'Business Insider',      category: 'business',    priority: 2 },
  { url: 'https://feeds.hbr.org/harvardbusiness',       name: 'Harvard Business Review', category: 'business',  priority: 2 },
  { url: 'https://www.inc.com/rss',                     name: 'Inc.',                  category: 'business',    priority: 3 },
  { url: 'https://www.entrepreneur.com/latest.rss',     name: 'Entrepreneur',          category: 'business',    priority: 3 },

  // ============================================================
  // AI & MACHINE LEARNING
  // ============================================================
  { url: 'https://ai.googleblog.com/feeds/blog/blog.xml', name: 'Google AI Blog',      category: 'ai',          priority: 2 },
  { url: 'https://deepmind.google/blog/rss.xml',        name: 'Google DeepMind',       category: 'ai',          priority: 2 },
  { url: 'https://ai.meta.com/blog/rss/',               name: 'Meta AI',               category: 'ai',          priority: 2 },
  { url: 'https://blogs.microsoft.com/ai/feed/',        name: 'Microsoft AI',          category: 'ai',          priority: 2 },
  { url: 'https://aws.amazon.com/blogs/machine-learning/feed/', name: 'AWS Machine Learning', category: 'ai',   priority: 2 },
  { url: 'https://blogs.nvidia.com/feed/',              name: 'NVIDIA Blog',            category: 'ai',          priority: 2 },
  { url: 'https://arxiv.org/rss/cs.AI',                 name: 'ArXiv AI',              category: 'research',    priority: 2 },
  { url: 'https://arxiv.org/rss/cs.LG',                 name: 'ArXiv ML',              category: 'research',    priority: 2 },
  { url: 'https://thegradient.pub/rss/',                name: 'The Gradient',          category: 'ai',          priority: 2 },
  { url: 'https://simonwillison.net/atom/everything/',  name: 'Simon Willison',        category: 'ai',          priority: 2 },
  { url: 'https://www.oneusefulthing.org/feed',         name: 'One Useful Thing',      category: 'ai',          priority: 2 },
  { url: 'https://aisnakeoil.substack.com/feed',        name: 'AI Snake Oil',          category: 'ai',          priority: 2 },
  { url: 'https://www.reddit.com/r/MachineLearning/.rss', name: 'r/MachineLearning',  category: 'community',   priority: 2 },
  { url: 'https://www.reddit.com/r/artificial/.rss',   name: 'r/Artificial',          category: 'community',   priority: 2 },

  // ============================================================
  // VENTURE CAPITAL & INVESTMENT
  // ============================================================
  { url: 'https://a16z.com/feed/',                      name: 'a16z',                  category: 'vc',          priority: 2 },
  { url: 'https://www.sequoiacap.com/stories/rss/',     name: 'Sequoia Capital',       category: 'vc',          priority: 2 },
  { url: 'https://review.firstround.com/feed.xml',      name: 'First Round Review',    category: 'vc',          priority: 2 },
  { url: 'https://avc.com/feed/',                       name: 'AVC (Fred Wilson)',      category: 'vc',          priority: 2 },
  { url: 'https://bothsidesofthetable.com/feed',        name: 'Both Sides of the Table', category: 'vc',        priority: 2 },
  { url: 'https://techcrunch.com/category/venture/feed/', name: 'TechCrunch Venture',  category: 'vc',          priority: 2 },
  { url: 'https://www.cbinsights.com/research/feed/',   name: 'CB Insights',           category: 'vc',          priority: 2 },
  { url: 'https://www.notboring.co/feed',               name: 'Not Boring',            category: 'analysis',    priority: 2 },
  { url: 'https://every.to/feed',                       name: 'Every',                 category: 'analysis',    priority: 2 },

  // ============================================================
  // STARTUPS & SAAS
  // ============================================================
  { url: 'https://www.saastr.com/feed/',                name: 'SaaStr',                category: 'saas',        priority: 2 },
  { url: 'https://techcrunch.com/category/startups/feed/', name: 'TechCrunch Startups', category: 'startups',  priority: 2 },
  { url: 'https://www.lennysnewsletter.com/feed',       name: "Lenny's Newsletter",    category: 'product',     priority: 2 },
  { url: 'https://www.producthunt.com/feed',            name: 'Product Hunt',          category: 'product',     priority: 3 },
  { url: 'https://baremetrics.com/blog/feed',           name: 'Baremetrics',           category: 'saas',        priority: 3 },
  { url: 'https://www.intercom.com/blog/feed',          name: 'Intercom Blog',         category: 'saas',        priority: 3 },
  { url: 'https://www.reddit.com/r/startups/.rss',      name: 'r/Startups',            category: 'community',   priority: 3 },
  { url: 'https://www.indiehackers.com/feed.xml',       name: 'Indie Hackers',         category: 'startups',    priority: 3 },

  // ============================================================
  // ENGINEERING & DEVELOPER
  // ============================================================
  { url: 'https://dev.to/feed',                         name: 'DEV Community',         category: 'developer',   priority: 3 },
  { url: 'https://stackoverflow.blog/feed/',            name: 'Stack Overflow Blog',   category: 'developer',   priority: 3 },
  { url: 'https://github.blog/feed/',                   name: 'GitHub Blog',           category: 'developer',   priority: 2 },
  { url: 'https://netflixtechblog.com/feed',            name: 'Netflix Tech Blog',     category: 'engineering', priority: 2 },
  { url: 'https://engineering.fb.com/feed/',            name: 'Meta Engineering',      category: 'engineering', priority: 2 },
  { url: 'https://aws.amazon.com/blogs/aws/feed/',      name: 'AWS Blog',              category: 'cloud',       priority: 2 },
  { url: 'https://azure.microsoft.com/en-us/blog/feed/', name: 'Microsoft Azure',      category: 'cloud',       priority: 2 },
  { url: 'https://about.gitlab.com/atom.xml',           name: 'GitLab Blog',           category: 'developer',   priority: 3 },
  { url: 'https://eng.uber.com/feed/',                  name: 'Uber Engineering',      category: 'engineering', priority: 3 },
  { url: 'https://stripe.com/blog/feed/rss/engineering', name: 'Stripe Engineering',   category: 'engineering', priority: 3 },
  { url: 'https://newsletter.pragmaticengineer.com/feed', name: 'The Pragmatic Engineer', category: 'developer', priority: 2 },
  { url: 'https://www.reddit.com/r/programming/.rss',   name: 'r/Programming',         category: 'community',   priority: 3 },
  { url: 'https://www.reddit.com/r/technology/.rss',    name: 'r/Technology',          category: 'community',   priority: 3 },

  // ============================================================
  // SECURITY & PRIVACY
  // ============================================================
  { url: 'https://krebsonsecurity.com/feed/',           name: 'Krebs on Security',     category: 'security',    priority: 2 },
  { url: 'https://www.schneier.com/feed/atom/',         name: 'Schneier on Security',  category: 'security',    priority: 2 },
  { url: 'https://www.eff.org/rss/updates.xml',         name: 'EFF',                   category: 'policy',      priority: 2 },
  { url: 'https://threatpost.com/feed/',                name: 'Threatpost',            category: 'security',    priority: 3 },
  { url: 'https://www.darkreading.com/rss.xml',         name: 'Dark Reading',          category: 'security',    priority: 3 },

  // ============================================================
  // POLICY & REGULATION
  // ============================================================
  { url: 'https://www.ftc.gov/feeds/news.xml',          name: 'FTC',                   category: 'regulation',  priority: 2 },
  { url: 'https://www.nist.gov/news-events/news/rss.xml', name: 'NIST',               category: 'regulation',  priority: 3 },
  { url: 'https://techpolicy.press/feed/',              name: 'Tech Policy Press',     category: 'policy',      priority: 2 },
  { url: 'https://www.politico.com/rss/technology.xml', name: 'Politico Tech',        category: 'policy',      priority: 2 },

  // ============================================================
  // CRYPTO & WEB3 (signal only — funding, enterprise adoption)
  // ============================================================
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk',          category: 'crypto',      priority: 3 },
  { url: 'https://cointelegraph.com/rss',               name: 'CoinTelegraph',         category: 'crypto',      priority: 3 },

  // ============================================================
  // NEWSLETTERS & INDEPENDENT ANALYSIS
  // ============================================================
  { url: 'https://www.platformer.news/feed',            name: 'Platformer',            category: 'analysis',    priority: 2 },
  { url: 'https://www.bigtechnology.com/feed',          name: 'Big Technology',        category: 'analysis',    priority: 2 },
  { url: 'https://garymarcus.substack.com/feed',        name: 'Gary Marcus',           category: 'ai',          priority: 2 },
  { url: 'https://karpathy.github.io/feed.xml',         name: 'Andrej Karpathy',       category: 'ai',          priority: 2 },
  { url: 'https://www.interconnects.ai/feed',           name: 'Interconnects',         category: 'ai',          priority: 2 },
  { url: 'https://newsletter.theaiedge.io/feed',        name: 'The AI Edge',           category: 'ai',          priority: 2 },
  { url: 'https://www.ben-evans.com/benedictevans/rss.xml', name: 'Benedict Evans',    category: 'analysis',    priority: 2 },
  { url: 'https://stratechery.com/category/articles/feed/', name: 'Stratechery Articles', category: 'analysis', priority: 2 },

  // ============================================================
  // ACADEMIC & RESEARCH
  // ============================================================
  { url: 'https://bair.berkeley.edu/blog/feed.xml',     name: 'Berkeley AI Research',  category: 'research',    priority: 2 },
  { url: 'https://hai.stanford.edu/news/rss.xml',       name: 'Stanford HAI',          category: 'research',    priority: 2 },
  { url: 'https://paperswithcode.com/latest/rss',       name: 'Papers With Code',      category: 'research',    priority: 2 },

  // ============================================================
  // ENGINEERING — INFRA & CLOUD
  // ============================================================
  { url: 'https://blog.cloudflare.com/rss/',            name: 'Cloudflare Blog',       category: 'engineering', priority: 2 },
  { url: 'https://vercel.com/blog/rss.xml',             name: 'Vercel Blog',           category: 'engineering', priority: 3 },
  { url: 'https://shopify.engineering/feed.atom',       name: 'Shopify Engineering',   category: 'engineering', priority: 3 },
  { url: 'https://changelog.com/feed',                  name: 'The Changelog',         category: 'developer',   priority: 3 },
  { url: 'https://www.databricks.com/blog/feed',        name: 'Databricks Blog',       category: 'ai',          priority: 2 },
  { url: 'https://cloud.google.com/blog/rss/',          name: 'Google Cloud Blog',     category: 'cloud',       priority: 2 },

];

module.exports = { SOURCES };

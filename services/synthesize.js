/**
 * AI synthesis — converts scraped articles into a briefing.
 *
 * Exports:
 *   synthesizeBriefing(articles, prefs)  → [{title,type,summary,angle,action,url}]
 *   buildSubjectLine(stories, dateStr)   → smart subject from the top story
 *   buildCompetitorRadar(articles, comps)→ [{name,status,url,active}]
 *   extractFundingNews(articles, prefs)  → [{company,amount,summary,url}]
 *   findAlertWorthyArticles(articles, prefs) → articles matching competitors/keywords
 *   selectArticlesForUser(articles, prefs, limit)
 */
const OpenAI = require('openai');

let client = null;
function getClient() {
  if (!client) {
    const options = { apiKey: process.env.OPENAI_API_KEY || 'missing' };
    // Only use a custom base URL if explicitly set — avoids proxy 404 errors
    if (process.env.OPENAI_BASE_URL) options.baseURL = process.env.OPENAI_BASE_URL;
    client = new OpenAI(options);
  }
  return client;
}

/**
 * Shared helper — runs a chat completion expecting JSON back and parses it
 * defensively. Returns the parsed object/array, or null on any failure.
 */
async function callJSON(systemPrompt, userContent, maxTokens = 1500) {
  try {
    const resp = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    });

    const raw = resp.choices[0]?.message?.content || '';
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      // Salvage a JSON array/object embedded in extra text
      const start = Math.min(
        ...[raw.indexOf('['), raw.indexOf('{')].filter(i => i >= 0)
      );
      const end = Math.max(raw.lastIndexOf(']'), raw.lastIndexOf('}'));
      if (start >= 0 && end > start) {
        try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
      }
      return null;
    }
  } catch (err) {
    console.error('[synthesize] OpenAI error:', err.message);
    return null;
  }
}

/**
 * Score articles by relevance to a user's prefs, return the top N.
 */
function selectArticlesForUser(articles, prefs = {}, limit = 30) {
  const competitors = (prefs.competitors || []).map(c => c.toLowerCase());
  const keywords    = (prefs.keywords    || []).map(k => k.toLowerCase());
  const industry    = (prefs.industry    || '').toLowerCase();
  const terms = [...competitors, ...keywords, ...(industry ? [industry] : [])];

  if (terms.length === 0) return articles.slice(0, limit);

  const scored = articles.map((a, idx) => {
    let score = 0;
    const title = a.title.toLowerCase();
    const desc  = (a.description || '').toLowerCase();
    for (const term of terms) {
      if (title.includes(term)) score += 4; // title match = high signal
      if (desc.includes(term))  score += 1;
    }
    if (idx < 20) score += 1; // small recency bump
    return { article: a, score };
  });

  scored.sort((a, b) => b.score - a.score || 0);
  return scored.slice(0, limit).map(s => s.article);
}

/**
 * Personalization block injected into the briefing system prompt.
 */
function buildPersonalizationBlock(prefs = {}) {
  const { industry, competitors = [], keywords = [] } = prefs;
  if (!industry && competitors.length === 0 && keywords.length === 0) return '';

  const lines = ['\n\n[READER CONTEXT — use this to personalize every story]'];
  if (industry)           lines.push(`- Industry: ${industry}`);
  if (competitors.length) lines.push(`- Key competitors to watch: ${competitors.join(', ')}`);
  if (keywords.length)    lines.push(`- Topics they care most about: ${keywords.join(', ')}`);
  lines.push('');
  lines.push('Instructions:');
  lines.push(`- Prioritize stories relevant to ${industry || 'their space'}`);
  if (competitors.length) {
    lines.push(`- If any story involves ${competitors.join(' or ')}, call that out explicitly in the angle and action`);
  }
  lines.push(`- Write every "So what" angle as if speaking directly to a founder in ${industry || 'their industry'}`);
  lines.push('- If a story has no relevance to their industry or competitors, skip it in favour of one that does');
  return lines.join('\n');
}

/**
 * Synthesize scraped articles into 3-5 briefing stories.
 * Each story: { title, type, summary, angle, action, url }
 */
async function synthesizeBriefing(articles, prefs = {}) {
  if (articles.length === 0) {
    return [{ title: 'No significant news today', type: 'news',
      summary: 'No high-signal articles found today.', url: '', angle: '', action: '' }];
  }

  const selected = selectArticlesForUser(articles, prefs, 30);
  const articleList = selected.map((a, i) =>
    `${i + 1}. [${a.sourceName || 'unknown'}] ${a.title}\n   ${a.description || ''}`.slice(0, 400)
  ).join('\n\n');

  const systemPrompt =
    `You are Briefly — an opinionated AI intelligence briefing for founders, operators, and investors. ` +
    `You don't just summarize news. You tell busy people what it means for their business.\n\n` +
    `Return JSON: {"stories": [ ... ]} with 3-5 story objects. Each story must have:\n` +
    `- title: short punchy headline (under 80 chars) — like a smart friend texting you, not a press release\n` +
    `- type: "alert" (urgent, act now), "signal" (important trend forming), "news" (worth knowing), or "low" (background)\n` +
    `- summary: 2-3 sentences — what happened, why, and who it affects. Specific, not vague.\n` +
    `- angle: the "So what" — one sharp sentence on what this means for the reader's business. Opinionated, uses "you".\n` +
    `- action: the "Now what" — one concrete next step the reader could take this week. ` +
    `Start with a verb. Example: "Audit your onboarding flow before their new pricing makes you look expensive." ` +
    `If there is genuinely no useful action, use an empty string.\n` +
    `- url: the source URL (string, can be empty)\n\n` +
    `Rules:\n` +
    `- Pick the most important news across the full batch; diversity of topics is good\n` +
    `- No more than 1 story per source\n` +
    `- Never use filler like "it remains to be seen" or "only time will tell"\n` +
    `- Return ONLY the JSON object. Max 5 stories.` +
    buildPersonalizationBlock(prefs);

  const parsed = await callJSON(systemPrompt, `Here are today's articles:\n\n${articleList}`, 1800);
  if (!parsed) return fallbackBriefing(selected);

  const stories = parsed.stories || (Array.isArray(parsed) ? parsed : null);
  if (!Array.isArray(stories) || stories.length === 0) return fallbackBriefing(selected);
  return stories.slice(0, 5);
}

/**
 * Smart subject line — leads with the single most important story.
 */
function buildSubjectLine(stories, dateStr) {
  if (!stories || stories.length === 0) return `Briefly — ${dateStr}`;
  const order = { alert: 0, signal: 1, news: 2, low: 3 };
  const top = [...stories].sort(
    (a, b) => (order[a.type] ?? 2) - (order[b.type] ?? 2)
  )[0];
  if (!top || !top.title) return `Briefly — ${dateStr}`;
  const prefix = top.type === 'alert' ? '🔴 ' : top.type === 'signal' ? '🟡 ' : '';
  let title = top.title.trim();
  if (title.length > 90) title = title.slice(0, 87).trimEnd() + '…';
  return `${prefix}${title}`;
}

/**
 * Competitor Radar — for each tracked competitor, find the most recent
 * matching article and write a one-line status. Competitors with no news
 * get a "quiet today" line. One AI call total (only for competitors w/ news).
 */
async function buildCompetitorRadar(articles, competitors = []) {
  if (!competitors || competitors.length === 0) return [];

  const matches = {};
  for (const comp of competitors) {
    const c = comp.toLowerCase();
    matches[comp] = articles.find(a =>
      `${a.title} ${a.description || ''}`.toLowerCase().includes(c)
    ) || null;
  }

  const withNews = competitors.filter(c => matches[c]);
  let aiLines = {};
  if (withNews.length > 0) {
    const input = withNews.map(c => {
      const a = matches[c];
      return `${c} :: ${a.title} — ${(a.description || '').slice(0, 200)}`;
    }).join('\n');

    const sys =
      `You track competitors for a founder. For each competitor below, write ONE short, ` +
      `punchy status line (max 18 words) describing what they did and why it matters. ` +
      `No fluff. Return JSON: {"radar": {"CompetitorName": "status line", ...}} using the exact names given.`;
    const parsed = await callJSON(sys, input, 800);
    if (parsed && parsed.radar) aiLines = parsed.radar;
  }

  return competitors.map(comp => {
    const a = matches[comp];
    if (a) {
      return { name: comp, status: aiLines[comp] || a.title, url: a.url || '', active: true };
    }
    return { name: comp, status: 'Quiet today — no coverage.', url: '', active: false };
  });
}

// Detects funding / M&A / raise language
const FUNDING_RE = /\b(raises?|raised|funding round|seed round|series\s+[a-e]\b|pre-seed|valuation|led by|venture round|acqui(re|red|sition)|\$\d+(\.\d+)?\s?(m|b|k|million|billion))\b/i;

/**
 * Funding & new-entrant intelligence — pulls funding/M&A stories from the
 * batch and summarizes the top few. One AI call.
 */
async function extractFundingNews(articles, prefs = {}) {
  const candidates = articles.filter(a =>
    FUNDING_RE.test(`${a.title} ${a.description || ''}`)
  );
  if (candidates.length === 0) return [];

  const top = candidates.slice(0, 10);
  const input = top.map((a, i) =>
    `${i + 1}. [${a.sourceName || 'unknown'}] ${a.title}\n   ${(a.description || '').slice(0, 200)}\n   URL: ${a.url || ''}`
  ).join('\n\n');

  const industry = prefs.industry ? ` Prioritize anything relevant to ${prefs.industry}.` : '';
  const sys =
    `You are a VC analyst. From the funding/M&A headlines below, pick the up to 3 most ` +
    `significant for a startup founder.${industry} For each, return: company (name), ` +
    `amount (e.g. "$30M Series B" or "" if unknown), summary (one sentence on what they do ` +
    `and why it matters), url. Return JSON: {"funding": [ {company, amount, summary, url} ]}. ` +
    `If none are truly significant, return {"funding": []}.`;

  const parsed = await callJSON(sys, input, 900);
  if (!parsed || !Array.isArray(parsed.funding)) return [];
  return parsed.funding.slice(0, 3);
}

/**
 * Real-time alert detector — returns articles that strongly match a user's
 * tracked competitors or keywords (title match = strong signal). Used by the
 * hourly alert job, NOT the daily digest.
 */
function findAlertWorthyArticles(articles, prefs = {}) {
  const competitors = (prefs.competitors || []).map(c => c.toLowerCase()).filter(Boolean);
  const keywords    = (prefs.keywords    || []).map(k => k.toLowerCase()).filter(Boolean);
  const terms = [...competitors, ...keywords];
  if (terms.length === 0) return [];

  return articles.filter(a => {
    const title = (a.title || '').toLowerCase();
    // Only alert on TITLE matches — high precision, low noise
    return terms.some(t => title.includes(t));
  });
}

function fallbackBriefing(articles) {
  return articles.slice(0, 4).map(a => ({
    title:   a.title.slice(0, 80),
    type:    'news',
    summary: (a.description || '').slice(0, 300),
    angle:   `Source: ${a.sourceName || 'unknown'}`,
    action:  '',
    url:     a.url || '',
  }));
}

module.exports = {
  synthesizeBriefing,
  buildSubjectLine,
  buildCompetitorRadar,
  extractFundingNews,
  findAlertWorthyArticles,
  selectArticlesForUser,
};

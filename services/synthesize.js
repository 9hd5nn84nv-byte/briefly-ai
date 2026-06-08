/**
 * AI synthesis — converts scraped articles into a 3-5 story briefing.
 * Accepts optional user prefs to personalize story selection and angles.
 */
const OpenAI = require('openai');

let client = null;
function getClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'missing',
      baseURL: process.env.OPENAI_BASE_URL || 'https://llm.services.proxy.sapiom.ai',
      defaultHeaders: {
        'x-polsia-company-id': '184140',
      },
    });
  }
  return client;
}

/**
 * Score articles by relevance to a user's prefs.
 * Returns the top N articles, blending relevance + recency.
 *
 * @param {Array}  articles - full scraped article list (sorted newest first)
 * @param {Object} prefs    - { industry, competitors: [], keywords: [] }
 * @param {number} limit    - how many to return (default 30)
 */
function selectArticlesForUser(articles, prefs = {}, limit = 30) {
  const competitors = (prefs.competitors || []).map(c => c.toLowerCase());
  const keywords    = (prefs.keywords    || []).map(k => k.toLowerCase());
  const industry    = (prefs.industry    || '').toLowerCase();

  // Build one flat list of terms to match against
  const terms = [...competitors, ...keywords, ...(industry ? [industry] : [])];

  if (terms.length === 0) {
    // No prefs — just take the most recent 30
    return articles.slice(0, limit);
  }

  const scored = articles.map((a, idx) => {
    const haystack = `${a.title} ${a.description || ''}`.toLowerCase();
    let score = 0;

    for (const term of terms) {
      if (a.title.toLowerCase().includes(term))       score += 4; // title match = high signal
      if ((a.description || '').toLowerCase().includes(term)) score += 1;
    }

    // Recency bonus — articles in position 0–19 get a small bump so fresh news still shows
    if (idx < 20) score += 1;

    return { article: a, score };
  });

  // Sort: highest score first, then original recency order for ties
  scored.sort((a, b) => b.score - a.score || 0);

  return scored.slice(0, limit).map(s => s.article);
}

/**
 * Build the personalization block injected into the system prompt.
 */
function buildPersonalizationBlock(prefs = {}) {
  const { industry, competitors = [], keywords = [] } = prefs;

  if (!industry && competitors.length === 0 && keywords.length === 0) return '';

  const lines = ['\n\n[READER CONTEXT — use this to personalize every story]'];
  if (industry)              lines.push(`- Industry: ${industry}`);
  if (competitors.length)    lines.push(`- Key competitors to watch: ${competitors.join(', ')}`);
  if (keywords.length)       lines.push(`- Topics they care most about: ${keywords.join(', ')}`);

  lines.push('');
  lines.push('Instructions:');
  lines.push(`- Prioritize stories relevant to ${industry || 'their space'}`);
  if (competitors.length) {
    lines.push(`- If any story involves ${competitors.join(' or ')}, call that out explicitly in the angle`);
  }
  lines.push(`- Write every "So what" angle as if speaking directly to a founder in ${industry || 'their industry'}`);
  lines.push('- If a story has no relevance to their industry or competitors, skip it in favour of one that does');

  return lines.join('\n');
}

/**
 * Synthesize scraped articles into a structured briefing.
 *
 * @param {Array}  articles - Array of { title, url, description, publishedAt, sourceName }
 * @param {Object} prefs    - Optional { industry, competitors: [], keywords: [] }
 * @returns {Array} 3-5 briefing stories
 */
async function synthesizeBriefing(articles, prefs = {}) {
  if (articles.length === 0) {
    return [{
      title: 'No significant news today',
      type: 'news',
      summary: 'No high-signal articles found today.',
      url: '',
      angle: '',
    }];
  }

  const selected = selectArticlesForUser(articles, prefs, 30);

  const articleList = selected.map((a, i) =>
    `${i + 1}. [${a.sourceName || 'unknown'}] ${a.title}\n   ${a.description || ''}`.slice(0, 400)
  ).join('\n\n');

  const personalizationBlock = buildPersonalizationBlock(prefs);

  const systemPrompt =
    `You are Briefly — an opinionated AI intelligence briefing for founders, operators, and investors. ` +
    `You don't just summarize news. You tell busy people what it means for their business.\n\n` +
    `Return a JSON array of 3-5 briefing "stories". Each story must be an object with:\n` +
    `- title: short punchy headline (under 80 chars) — written like a smart friend texting you, not a press release\n` +
    `- type: "alert" (urgent, act now), "signal" (important trend forming), "news" (worth knowing), or "low" (background noise)\n` +
    `- summary: 2-3 sentences — what happened, why it happened, and who it affects. Be specific, not vague.\n` +
    `- angle: the "So what" — one sharp sentence telling the reader exactly what this means for their business or decisions. ` +
    `This is Briefly's signature. Make it actionable and opinionated, not generic. ` +
    `Bad example: "This is an important development." ` +
    `Good example: "If you're selling to enterprise, their procurement teams are already evaluating this — get in front of your champion before Q3 budget locks."\n` +
    `- url: the source URL (string, can be empty)\n\n` +
    `Rules:\n` +
    `- Pick stories that represent the most important news across the full batch\n` +
    `- Diversity of topics is good — don't pick 5 stories about the same company\n` +
    `- Do not pick more than 1 story per source\n` +
    `- Always write the angle as if you are advising the reader directly — use "you", be direct\n` +
    `- Never use filler phrases like "it remains to be seen" or "only time will tell"\n` +
    `- Return ONLY the JSON array, no markdown, no explanation. Max 5 stories.` +
    personalizationBlock;

  try {
    const resp = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `Here are today's articles:\n\n${articleList}` },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const raw = resp.choices[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const arrayText = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1);
      try { parsed = JSON.parse(arrayText); } catch { return fallbackBriefing(selected); }
    }

    if (parsed.stories)       return parsed.stories.slice(0, 5);
    if (Array.isArray(parsed)) return parsed.slice(0, 5);
    return fallbackBriefing(selected);
  } catch (err) {
    console.error('[synthesize] OpenAI error:', err.message);
    return fallbackBriefing(selected);
  }
}

function fallbackBriefing(articles) {
  return articles.slice(0, 4).map(a => ({
    title:   a.title.slice(0, 80),
    type:    'news',
    summary: (a.description || '').slice(0, 300),
    angle:   `Source: ${a.sourceName || 'unknown'}`,
    url:     a.url || '',
  }));
}

module.exports = { synthesizeBriefing, selectArticlesForUser };

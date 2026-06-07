/**
 * AI synthesis — converts scraped articles into a 3-5 story briefing
 * with signal/news/alert classification.
 * Uses OpenAI via the Polsia AI proxy.
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
 * Classify an article's signal level.
 * @param {string} headline
 * @param {string} description
 * @returns {'alert'|'signal'|'news'|'low'}
 */
async function classifySignal(headline, description) {
  const text = `${headline}\n\n${description}`.slice(0, 1000);
  try {
    const resp = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Classify this article as one of: alert, signal, news, low\n\n${text}`,
      }],
      temperature: 0,
      max_tokens: 20,
    });
    const label = resp.choices[0]?.message?.content?.trim().toLowerCase();
    if (['alert', 'signal', 'news', 'low'].includes(label)) return label;
    return 'news';
  } catch {
    return 'news';
  }
}

/**
 * Synthesize scraped articles into a structured briefing.
 * @param {Array} articles - Array of { title, url, description, publishedAt, sourceName }
 * @returns {Array} Briefing stories with signal classification, summary, and angle
 */
async function synthesizeBriefing(articles) {
  if (articles.length === 0) {
    return [{ title: 'No significant news today', type: 'news', summary: 'No high-signal articles found in today.', url: '', angle: '' }];
  }

  // Prep articles for the prompt — take top 30 by recency
  const top = articles.slice(0, 30);
  const articleList = top.map((a, i) =>
    `${i + 1}. [${a.sourceName || 'unknown'}] ${a.title}\n   ${a.description}`.slice(0, 400)
  ).join('\n\n');

  try {
    const resp = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `You are Briefly — an opinionated AI intelligence briefing for founders, operators, and investors. You don't just summarize news. You tell busy people what it means for their business.\n\nReturn a JSON array of 3-5 briefing "stories". Each story must be an object with:\n- title: short punchy headline (under 80 chars) — written like a smart friend texting you, not a press release\n- type: "alert" (urgent, act now), "signal" (important trend forming), "news" (worth knowing), or "low" (background noise)\n- summary: 2-3 sentences — what happened, why it happened, and who it affects. Be specific, not vague.\n- angle: the "So what" — one sharp sentence telling the reader exactly what this means for their business or decisions. This is Briefly's signature. Make it actionable and opinionated, not generic. Bad example: "This is an important development." Good example: "If you're selling to enterprise, their procurement teams are already evaluating this — get in front of your champion before Q3 budget locks."\n- url: the source URL (string, can be empty)\n\nRules:\n- Pick stories that represent the most important news across the full batch\n- Diversity of topics is good — don't pick 5 stories about the same company\n- Do not pick more than 1 story per source\n- Always write the angle as if you are advising the reader directly — use "you", be direct\n- Never use filler phrases like "it remains to be seen" or "only time will tell"\n\nReturn ONLY the JSON array, no markdown, no explanation. Max 5 stories.`,
      }, {
        role: 'user',
        content: `Here are today's scraped articles:\n\n${articleList}`,
      }],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const raw = resp.choices[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try extracting array from response
      const match = raw.match(/\\[[\r\n\t ]*{[\r\n\t ]*"title"/);
      if (match) {
        const arrayText = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1);
        parsed = JSON.parse(arrayText);
      } else {
        return fallbackBriefing(articles);
      }
    }

    // Handle wrapped format
    if (parsed.stories) {
      return parsed.stories.slice(0, 5);
    }
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 5);
    }
    return fallbackBriefing(articles);
  } catch (err) {
    console.error('[synthesize] OpenAI error:', err.message);
    return fallbackBriefing(articles);
  }
}

function fallbackBriefing(articles) {
  return articles.slice(0, 4).map(a => ({
    title: a.title.slice(0, 80),
    type: 'news',
    summary: (a.description || '').slice(0, 300),
    angle: `Source: ${a.sourceName || 'unknown'}`,
    url: a.url || '',
  }));
}

module.exports = { synthesizeBriefing, classifySignal };
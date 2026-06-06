/**
 * Slack integration — posts the daily briefing to a configured webhook.
 * Set SLACK_WEBHOOK_URL in environment to enable.
 */

const signalEmoji = { alert: '🔴', signal: '🟡', news: '🟢', low: '⚪' };

async function sendBriefingToSlack(stories, dateStr, webhookUrl) {
  const url = webhookUrl || process.env.SLACK_WEBHOOK_URL;
  if (!url) return { skipped: true };

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `📰 Briefly — ${dateStr}`, emoji: true },
    },
    { type: 'divider' },
    ...stories.map(story => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${signalEmoji[story.type] || '🟢'} *${story.title}*\n${story.summary}\n_${story.angle || ''}_${story.url ? `\n<${story.url}|Read more →>` : ''}`,
      },
    })),
    { type: 'divider' },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: 'Delivered by <https://briefly-ai-1.onrender.com|Briefly> · AI industry intelligence' }],
    },
  ];

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[slack] Webhook failed: ${res.status} — ${err}`);
      return { success: false, error: err };
    }

    console.log('[slack] Briefing posted to Slack');
    return { success: true };
  } catch (err) {
    console.error('[slack] Failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendBriefingToSlack };

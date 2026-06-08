/**
 * Email delivery — sends HTML briefing emails via the Polsia email infrastructure.
 * Falls back to inbox notification if email is blocked by platform config (missing custom domain).
 */

// Email proxy URL and API key are set by the Polsia platform provisioner
const EMAIL_API_URL = process.env.POLSIA_EMAIL_PROXY_URL || 'https://polsia.com/api/proxy/email/send';
const EMAIL_API_KEY = process.env.POLSIA_API_KEY || '';
const INBOX_API_URL = process.env.POLSIA_API_BASE_URL
  ? `${process.env.POLSIA_API_BASE_URL}/api/inbox/message`
  : null;
const INBOX_API_KEY = process.env.POLSIA_API_KEY || '';
const OWNER_EMAIL = process.env.POLSIA_OWNER_EMAIL || 'colecarriger53@gmail.com';

/**
 * Send the briefing HTML email to a specific address.
 * Falls back to Polsia inbox notification if email is blocked by platform config.
 * @param {string} to - recipient email
 * @param {string} subject
 * @param {string} html
 */
async function sendBriefingEmail(to, subject, html) {
  const recipient = to || OWNER_EMAIL;
  const emailResult = await sendViaEmailProxy(recipient, subject, html);
  if (emailResult.success) return emailResult;
  return await sendViaInbox(recipient, subject, html);
}

async function sendViaEmailProxy(to, subject, body) {
  try {
    const res = await fetch(EMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMAIL_API_KEY}`,
        'x-polsia-company-id': '184140',
      },
      body: JSON.stringify({ to, subject, body }),
    });

    if (!res.ok) {
      const err = await res.text();
      // Custom domain error means email blocked — fall back to inbox
      if (res.status === 403 && err.includes('custom_domain')) {
        console.warn('[email] Custom domain not configured — falling back to inbox');
        return { success: false, reason: 'custom_domain_required' };
      }
      console.error(`[email] Send failed: ${res.status} — ${err}`);
      throw new Error(`Email send failed: ${res.status}`);
    }

    const data = await res.json();
    console.log(`[email] Sent to ${to}, id: ${data.id || data.messageId || 'unknown'}`);
    return { success: true, id: data.id || data.messageId };
  } catch (err) {
    console.error(`[email] Failed: ${err.message}`);
    return { success: false, reason: err.message };
  }
}

async function sendViaInbox(to, subject, body) {
  if (!INBOX_API_URL) {
    console.warn('[inbox] POLSIA_API_BASE_URL not set — skipping inbox fallback');
    return { success: false, reason: 'inbox_not_configured' };
  }
  // Strip HTML for plain text inbox message
  const text = body.replace(/<[^>]+>/g, ' ').replace(/\n+/g, '\n').trim().slice(0, 2000);
  try {
    const res = await fetch(INBOX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INBOX_API_KEY}`,
        'x-polsia-company-id': '184140',
      },
      body: JSON.stringify({
        to,
        subject,
        message: `[Briefly Daily Briefing]\n\n${text}\n\nView in app: https://briefly-ai-4.polsia.app`,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[inbox] Failed: ${res.status} — ${err}`);
      throw new Error(`Inbox send failed: ${res.status}`);
    }

    const data = await res.json();
    console.log(`[inbox] Sent briefing to owner via inbox, id: ${data.id || 'unknown'}`);
    return { success: true, via: 'inbox', id: data.id };
  } catch (err) {
    console.error(`[inbox] Failed: ${err.message}`);
    return { success: false, reason: err.message };
  }
}

/**
 * Build the HTML briefing email from synthesized stories.
 * @param {Array} stories - Array of { title, type, summary, angle, url }
 */
function buildBriefingHtml(stories, dateStr) {
  const signalColors = {
    alert: '#DC2626',
    signal: '#D97706',
    news: '#1B6B3A',
    low: '#7A9BA6',
  };

  const signalLabels = {
    alert: '🔴 ALERT',
    signal: '🟡 SIGNAL',
    news: '🟢 NEWS',
    low: '⚪ LOW',
  };

  const storyRows = stories.map(story => `
    <tr>
      <td style="padding: 20px 0; border-bottom: 1px solid #E8E4DA;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-bottom: 8px;">
              <span style="display:inline-block;background:${signalColors[story.type] || '#1B6B3A'}20;color:${signalColors[story.type] || '#1B6B3A'};font-size:11px;font-weight:700;letter-spacing:0.05em;padding:3px 8px;border-radius:4px;">${signalLabels[story.type] || 'NEWS'}</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 8px;">
              <h2 style="font-family:'Sora',-apple-system,sans-serif;font-size:18px;font-weight:700;color:#14303A;margin:0;line-height:1.3;">${escapeHtml(story.title)}</h2>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:6px;font-size:14px;color:#3D6070;line-height:1.5;">${escapeHtml(story.summary)}</td>
          </tr>
          <tr>
            <td>
              <span style="font-size:13px;color:#7A9BA6;font-style:italic;">${escapeHtml(story.angle || '')}</span>
              ${story.url ? ` <a href="${escapeHtml(story.url)}" style="color:#1B6B3A;font-size:13px;margin-left:12px;text-decoration:none;">Read more →</a>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Briefly Daily Briefing</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF5;font-family:'Figtree',-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAF5;">
    <!-- Header -->
    <tr>
      <td style="background:#14303A;padding:32px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <h1 style="font-family:'Sora',-apple-system,sans-serif;font-size:28px;font-weight:800;color:#fff;margin:0;letter-spacing:-0.03em;">Briefly</h1>
            </td>
            <td style="text-align:right;">
              <span style="font-family:'Sora',-apple-system,sans-serif;font-size:13px;color:rgba(255,255,255,0.5);">${dateStr}</span>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:8px;">
              <p style="font-size:14px;color:rgba(255,255,255,0.6);margin:0;">Your daily AI briefing — top ${stories.length} stories from the tech &amp; AI world.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Stories -->
    <tr>
      <td style="padding:24px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;background:#fff;border-radius:12px;padding:32px;">
          ${storyRows}
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:24px 40px 40px;text-align:center;">
        <p style="font-size:12px;color:#7A9BA6;">You received this because you're a Briefly subscriber. No longer want these? <a href="{{{unsubscribeUrl}}}" style="color:#7A9BA6;">Unsubscribe</a>.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a weekly digest HTML email from an array of briefing summaries.
 * @param {Array} weekStories - flat array of story objects from the week
 * @param {string} weekLabel - e.g. "Week of June 2 – June 8, 2026"
 */
function buildWeeklyDigestHtml(weekStories, weekLabel) {
  const topStories = weekStories.slice(0, 8);
  const rows = topStories.map(story => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #E8E4DA;">
        <p style="font-family:'Sora',-apple-system,sans-serif;font-size:16px;font-weight:700;color:#14303A;margin:0 0 6px;">${escapeHtml(story.title)}</p>
        <p style="font-size:13px;color:#3D6070;margin:0 0 4px;line-height:1.5;">${escapeHtml(story.summary)}</p>
        <span style="font-size:12px;color:#7A9BA6;font-style:italic;">${escapeHtml(story.angle || '')}</span>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Briefly — Weekly Digest</title></head>
<body style="margin:0;padding:0;background:#FAFAF5;font-family:'Figtree',-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAF5;">
    <tr>
      <td style="background:#14303A;padding:32px 40px;">
        <h1 style="font-family:'Sora',-apple-system,sans-serif;font-size:28px;font-weight:800;color:#fff;margin:0;">Briefly</h1>
        <p style="font-size:14px;color:rgba(255,255,255,0.5);margin:8px 0 0;">Weekly Big Picture — ${weekLabel}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;background:#fff;border-radius:12px;padding:32px;">
          <tr><td style="padding-bottom:16px;">
            <h2 style="font-family:'Sora',-apple-system,sans-serif;font-size:18px;font-weight:700;color:#14303A;margin:0;">The week's most important stories</h2>
          </td></tr>
          ${rows}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 40px 40px;text-align:center;">
        <p style="font-size:12px;color:#7A9BA6;">Weekly digest from Briefly. <a href="{{{unsubscribeUrl}}}" style="color:#7A9BA6;">Unsubscribe</a>.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { sendBriefingEmail, buildBriefingHtml, buildWeeklyDigestHtml };
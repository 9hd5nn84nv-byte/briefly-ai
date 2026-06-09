/**
 * Email delivery — sends HTML briefing emails via Resend (https://resend.com).
 */

// Resend — transactional email provider
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
// "From" address. On Resend's free tier without a verified domain you can only
// use onboarding@resend.dev and only send to your own verified address.
// Once you verify a domain, set BRIEFLY_FROM_EMAIL=Briefly <briefing@yourdomain.com>
const FROM_EMAIL = process.env.BRIEFLY_FROM_EMAIL || 'Briefly <onboarding@resend.dev>';
const OWNER_EMAIL = process.env.BRIEFLY_OWNER_EMAIL || 'colecarriger53@gmail.com';

/**
 * Send the briefing HTML email to a specific address via Resend.
 * @param {string} to - recipient email
 * @param {string} subject
 * @param {string} html
 */
async function sendBriefingEmail(to, subject, html) {
  const recipient = to || OWNER_EMAIL;

  if (!RESEND_API_KEY) {
    console.error('[email] RESEND_API_KEY not set — cannot send. Add it in your environment.');
    return { success: false, reason: 'resend_not_configured' };
  }

  return await sendViaResend(recipient, subject, html);
}

/**
 * Send via the Resend HTTP API. No SDK needed — it's a single POST.
 */
async function sendViaResend(to, subject, html) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[resend] Send failed: ${res.status} — ${err}`);
      return { success: false, reason: `resend_${res.status}` };
    }

    const data = await res.json();
    console.log(`[resend] Sent to ${to}, id: ${data.id || 'unknown'}`);
    return { success: true, via: 'resend', id: data.id };
  } catch (err) {
    console.error(`[resend] Failed: ${err.message}`);
    return { success: false, reason: err.message };
  }
}

/**
 * Build the HTML briefing email from synthesized stories.
 * @param {Array}  stories - [{ title, type, summary, angle, action, url }]
 * @param {string} dateStr
 * @param {Object} extras  - optional { radar: [...], funding: [...] }
 */
function buildBriefingHtml(stories, dateStr, extras = {}) {
  const { radar = [], funding = [] } = extras;

  const signalColors = { alert: '#DC2626', signal: '#D97706', news: '#1B6B3A', low: '#7A9BA6' };
  const signalLabels = { alert: '🔴 ALERT', signal: '🟡 SIGNAL', news: '🟢 NEWS', low: '⚪ LOW' };

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
            <td style="padding-bottom:${story.action ? '8px' : '0'};">
              <span style="font-size:13px;color:#7A9BA6;font-style:italic;">${escapeHtml(story.angle || '')}</span>
              ${story.url ? ` <a href="${escapeHtml(story.url)}" style="color:#1B6B3A;font-size:13px;margin-left:12px;text-decoration:none;">Read more →</a>` : ''}
            </td>
          </tr>
          ${story.action ? `
          <tr>
            <td>
              <table cellpadding="0" cellspacing="0" border="0" style="background:#F2F7F3;border-radius:6px;border-left:3px solid #1B6B3A;">
                <tr><td style="padding:8px 12px;font-size:13px;color:#1B6B3A;font-weight:600;">→ ${escapeHtml(story.action)}</td></tr>
              </table>
            </td>
          </tr>` : ''}
        </table>
      </td>
    </tr>
  `).join('');

  const radarBlock = radar.length ? `
    <tr>
      <td style="padding:0 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;background:#fff;border-radius:12px;padding:24px 32px;">
          <tr><td style="padding-bottom:12px;">
            <span style="font-family:'Sora',-apple-system,sans-serif;font-size:12px;font-weight:700;color:#14303A;letter-spacing:0.06em;">📡 COMPETITOR RADAR</span>
          </td></tr>
          ${radar.map(r => `
          <tr><td style="padding:7px 0;border-top:1px solid #F0EDE4;">
            <span style="font-size:14px;font-weight:700;color:#14303A;">${escapeHtml(r.name)}</span>
            <span style="font-size:14px;color:${r.active ? '#3D6070' : '#A6B2B8'};"> — ${escapeHtml(r.status)}</span>
            ${r.url ? ` <a href="${escapeHtml(r.url)}" style="color:#1B6B3A;font-size:12px;text-decoration:none;">→</a>` : ''}
          </td></tr>`).join('')}
        </table>
      </td>
    </tr>` : '';

  const fundingBlock = funding.length ? `
    <tr>
      <td style="padding:16px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;background:#fff;border-radius:12px;padding:24px 32px;">
          <tr><td style="padding-bottom:12px;">
            <span style="font-family:'Sora',-apple-system,sans-serif;font-size:12px;font-weight:700;color:#14303A;letter-spacing:0.06em;">💰 FUNDING &amp; NEW ENTRANTS</span>
          </td></tr>
          ${funding.map(f => `
          <tr><td style="padding:9px 0;border-top:1px solid #F0EDE4;">
            <span style="font-size:14px;font-weight:700;color:#14303A;">${escapeHtml(f.company)}${f.amount ? ` · <span style="color:#1B6B3A;">${escapeHtml(f.amount)}</span>` : ''}</span><br>
            <span style="font-size:13px;color:#3D6070;line-height:1.5;">${escapeHtml(f.summary)}</span>
            ${f.url ? ` <a href="${escapeHtml(f.url)}" style="color:#1B6B3A;font-size:12px;text-decoration:none;">Read →</a>` : ''}
          </td></tr>`).join('')}
        </table>
      </td>
    </tr>` : '';

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
              <p style="font-size:14px;color:rgba(255,255,255,0.6);margin:0;">Your daily intelligence briefing — ${stories.length} stories that matter to you.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Spacer -->
    <tr><td style="height:24px;"></td></tr>

    ${radarBlock}

    <!-- Stories -->
    <tr>
      <td style="padding:16px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;background:#fff;border-radius:12px;padding:32px;">
          ${storyRows}
        </table>
      </td>
    </tr>

    ${fundingBlock}

    <!-- Footer -->
    <tr>
      <td style="padding:24px 40px 40px;text-align:center;">
        <p style="font-size:12px;color:#7A9BA6;">You received this because you're a Briefly subscriber. No longer want these? <a href="mailto:${OWNER_EMAIL}?subject=Unsubscribe%20from%20Briefly" style="color:#7A9BA6;">Unsubscribe</a>.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build a compact real-time ALERT email for a single breaking story.
 * @param {Object} article    - { title, url, description, sourceName }
 * @param {string} matchLabel - what triggered it, e.g. 'Anthropic' or 'AI agents'
 */
function buildAlertHtml(article, matchLabel) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Briefly Alert</title></head>
<body style="margin:0;padding:0;background:#FAFAF5;font-family:'Figtree',-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAF5;">
    <tr>
      <td style="background:#DC2626;padding:20px 40px;">
        <span style="font-family:'Sora',-apple-system,sans-serif;font-size:13px;font-weight:700;color:#fff;letter-spacing:0.06em;">🔴 BRIEFLY ALERT · ${escapeHtml(matchLabel)}</span>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#fff;border-radius:12px;padding:28px;">
          <tr><td style="padding-bottom:8px;">
            <h2 style="font-family:'Sora',-apple-system,sans-serif;font-size:20px;font-weight:700;color:#14303A;margin:0;line-height:1.3;">${escapeHtml(article.title)}</h2>
          </td></tr>
          <tr><td style="padding-bottom:12px;font-size:14px;color:#3D6070;line-height:1.5;">${escapeHtml((article.description || '').slice(0, 300))}</td></tr>
          <tr><td>
            <span style="font-size:12px;color:#7A9BA6;">via ${escapeHtml(article.sourceName || 'source')}</span>
            ${article.url ? ` &nbsp;·&nbsp; <a href="${escapeHtml(article.url)}" style="color:#1B6B3A;font-size:13px;text-decoration:none;">Read the full story →</a>` : ''}
          </td></tr>
        </table>
        <p style="max-width:640px;font-size:12px;color:#7A9BA6;margin:16px auto 0;">You're getting this because <strong>${escapeHtml(matchLabel)}</strong> is on your Briefly watchlist. <a href="mailto:${OWNER_EMAIL}?subject=Unsubscribe%20from%20Briefly" style="color:#7A9BA6;">Unsubscribe</a>.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
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
        <p style="font-size:12px;color:#7A9BA6;">Weekly digest from Briefly. <a href="mailto:${OWNER_EMAIL}?subject=Unsubscribe%20from%20Briefly" style="color:#7A9BA6;">Unsubscribe</a>.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { sendBriefingEmail, buildBriefingHtml, buildAlertHtml, buildWeeklyDigestHtml };
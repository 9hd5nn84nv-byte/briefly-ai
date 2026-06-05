/**
 * Briefing pipeline — scrapes sources, synthesizes with AI, delivers email.
 * Manual trigger: GET /api/briefing/run
 * Status: GET /api/briefing/status
 */
const express = require('express');
const router = express.Router();
const { scrapeAll } = require('../services/scraper');
const { synthesizeBriefing } = require('../services/synthesize');
const { sendBriefingEmail, buildBriefingHtml } = require('../services/email');

const SUBSCRIBER_EMAIL = process.env.BRIEFING_RECIPIENT || 'colecarriger53@gmail.com';

// In-memory run tracker (MVP — no DB)
let lastRunAt = null;
let lastRunStatus = 'idle'; // idle | running | success | error
let lastRunError = null;
let lastRunStories = null;

async function runBriefingPipeline() {
  if (lastRunStatus === 'running') {
    return { status: 'already_running', message: 'A briefing is already in progress' };
  }

  lastRunStatus = 'running';
  lastRunError = null;
  lastRunStories = null;
  lastRunAt = new Date().toISOString();

  try {
    console.log('[briefing] Starting pipeline...');

    // Step 1: Scrape
    console.log('[briefing] Scraping sources...');
    const articles = await scrapeAll();
    if (articles.length === 0) {
      throw new Error('No articles scraped — check source URLs');
    }
    console.log(`[briefing] Scraped ${articles.length} articles`);

    // Step 2: Synthesize
    console.log('[briefing] Synthesizing briefing...');
    const stories = await synthesizeBriefing(articles);
    lastRunStories = stories;
    console.log(`[briefing] Generated ${stories.length} briefing stories`);

    // Step 3: Build HTML
    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    const subject = `Briefly — ${stories.filter(s => s.type === 'alert').length > 0 ? '🔴 ' : ''}${dateStr}`;
    const html = buildBriefingHtml(stories, dateStr);

    // Step 4: Send email
    console.log(`[briefing] Sending to ${SUBSCRIBER_EMAIL}...`);
    await sendBriefingEmail(SUBSCRIBER_EMAIL, subject, html);

    lastRunStatus = 'success';
    console.log('[briefing] Pipeline complete!');
    return { status: 'success', stories: stories.length, articles: articles.length };
  } catch (err) {
    lastRunStatus = 'error';
    lastRunError = err.message;
    console.error(`[briefing] Pipeline error: ${err.message}`);
    throw err;
  }
}

// Manual trigger (supports ?force to bypass in-progress lock)
router.get('/run', async (req, res) => {
  // Reset running state if stuck (e.g. previous container crashed mid-run)
  if (lastRunStatus === 'running') {
    if (req.query.force === '1') {
      lastRunStatus = 'idle';
    } else {
      return res.json({ ok: false, status: 'already_running', message: 'A briefing is already in progress. Add ?force=1 to override.' });
    }
  }
  try {
    const result = await runBriefingPipeline();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Debug: test a single source
router.get('/debug', async (_req, res) => {
  const { scrapeSource } = require('../services/scraper');
  const source = { url: 'https://news.ycombinator.com/rss', name: 'Hacker News', priority: 1 };
  const articles = await scrapeSource(source);
  res.json({ count: articles.length, first3: articles.slice(0, 3) });
});

// Debug: test scrapeAll directly
router.get('/debug-all', async (_req, res) => {
  const { scrapeAll } = require('../services/scraper');
  const articles = await scrapeAll();
  res.json({ count: articles.length, first3: articles.slice(0, 3) });
});

// Status check
router.get('/status', (_req, res) => {
  res.json({
    lastRunAt,
    lastRunStatus,
    lastRunError,
    storyCount: lastRunStories ? lastRunStories.length : null,
  });
});

module.exports = { router, runBriefingPipeline };
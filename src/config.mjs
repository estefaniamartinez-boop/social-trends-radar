import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const topics = JSON.parse(
  readFileSync(join(__dirname, '..', 'config', 'topics.json'), 'utf8')
).topics;

// ---- Tunable run settings (override via env / GitHub Actions) --------------
export const TOP_N = Number(process.env.TOP_N || 4);            // posts kept per topic per channel
export const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, ''); // live Pages base, for reading prior days
// Optional, FREE, and never required. If both are set the search uses Google's
// Programmable Search JSON API (100 queries/day free) for reliability; otherwise
// it falls back to keyless DuckDuckGo. No payment, no Apify.
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
export const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || '';

/*
 * CHANNELS — each is a public platform we search with a free web query:
 *   "<topic.query> site:<domain>"  → real post URLs → we pull each post's
 *   og:image / og:title for the card. No API keys, no scraping service.
 *
 * `match` keeps only real post/permalink URLs (drops profile/tag/help pages).
 */
export const channels = {
  linkedin: { label: 'LinkedIn', domain: 'linkedin.com', match: /linkedin\.com\/(posts|pulse)\//i, postType: 'post', limit: 4 },
  instagram: { label: 'Instagram', domain: 'instagram.com', match: /instagram\.com\/(p|reel)\//i, postType: 'image', limit: 4 },
  facebook: { label: 'Facebook', domain: 'facebook.com', match: /facebook\.com\/(watch|[^/]+\/(posts|videos))\//i, postType: 'post', limit: 3 },
  youtube: { label: 'YouTube', domain: 'youtube.com', match: /(youtube\.com\/watch|youtu\.be\/)/i, postType: 'video', limit: 3 },
};

export const channelKeys = Object.keys(channels);

import { MAX_AGE_DAYS, TOP_N } from './config.mjs';

/**
 * Dedupe by URL, drop posts older than the freshness window (posts with no
 * date are kept — better to show than silently discard), rank by engagement,
 * and keep the top N. Adds a `rank` and a plain-English `insight` string.
 */
export function rank(posts) {
  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
  const seen = new Set();

  const top = posts
    .filter((p) => {
      if (!p.url || seen.has(p.url)) return false;
      seen.add(p.url);
      if (p.publishedAt) {
        const ts = Date.parse(p.publishedAt);
        if (!Number.isNaN(ts) && ts < cutoff) return false;
      }
      return true;
    })
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, TOP_N);

  return top.map((p, i) => ({ ...p, rank: i + 1, insight: buildInsight(p, i) }));
}

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function buildInsight(p, i) {
  const m = p.metrics;
  const bits = [];
  if (m.views) bits.push(`${fmt(m.views)} views`);
  if (m.likes) bits.push(`${fmt(m.likes)} likes`);
  if (m.comments) bits.push(`${fmt(m.comments)} comments`);
  if (m.shares) bits.push(`${fmt(m.shares)} shares`);
  const lead = i === 0 ? 'Top performer' : `#${i + 1} performer`;
  const type = { video: 'video format', carousel: 'carousel format', image: 'single image', text: 'text-only post' }[p.postType] || p.postType;
  return `${lead} — ${type}. ${bits.join(' · ') || 'engagement data limited'}.`;
}

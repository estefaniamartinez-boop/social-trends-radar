import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { channels, GOOGLE_API_KEY, GOOGLE_CSE_ID } from './config.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const RAW_DIR = join(process.cwd(), 'output', 'raw');

/** fetch with a hard timeout so a slow/hanging page can't stall the run. */
async function tfetch(url, opts = {}, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

/** Free web search: Google Programmable Search if keys are set, else keyless DuckDuckGo lite. */
async function searchUrls(query, limit) {
  // Google Programmable Search (free 100/day) — only if configured.
  if (GOOGLE_API_KEY && GOOGLE_CSE_ID) {
    try {
      const u = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&num=10&q=${encodeURIComponent(query)}`;
      const r = await tfetch(u, {}, 15000);
      if (r.ok) {
        const j = await r.json();
        return (j.items || []).map((it) => ({
          url: it.link,
          title: it.title || null,
          snippet: it.snippet || null,
          image: it.pagemap?.cse_image?.[0]?.src || it.pagemap?.metatags?.[0]?.['og:image'] || null,
        }));
      }
    } catch { /* fall through to DDG */ }
  }
  // Keyless DuckDuckGo lite — results wrapped as //duckduckgo.com/l/?uddg=<encoded>.
  // Retry with backoff since DDG throttles rapid requests.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await tfetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': UA } }, 15000);
      if (r.ok) {
        const html = await r.text();
        const out = []; const seen = new Set();
        const re = /uddg=([^&"']+)/g; let m;
        while ((m = re.exec(html)) && out.length < limit * 4) {
          let u; try { u = decodeURIComponent(m[1]); } catch { continue; }
          if (!seen.has(u)) { seen.add(u); out.push({ url: u, title: null, snippet: null, image: null }); }
        }
        if (out.length) return out;
      }
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 2500 * (attempt + 1))); // 2.5s, 5s backoff
  }
  return [];
}

/** Pull og:image / og:title / og:description from a post URL (best-effort). */
async function ogMeta(url) {
  try {
    const r = await tfetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' }, 12000);
    if (!r.ok) return {};
    const h = await r.text();
    const pick = (p) => {
      const m = h.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)["']`, 'i'))
        || h.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${p}["']`, 'i'));
      return m ? m[1].replace(/&amp;/g, '&').trim() : null;
    };
    return { image: pick('og:image'), title: pick('og:title'), desc: pick('og:description'), site: pick('og:site_name') };
  } catch { return {}; }
}

/**
 * Search one platform for one topic, return normalized post objects.
 * Never throws — returns [] on failure so the run continues.
 */
export async function collect(channelKey, topic) {
  const ch = channels[channelKey];
  const query = `${topic.query} site:${ch.domain}`;
  let results = [];
  try { results = await searchUrls(query, ch.limit); } catch { results = []; }

  const seen = new Set();
  const picked = results
    .map((r) => ({ ...r, url: (r.url || '').split('#')[0].split('?')[0].replace(/\/$/, '') }))
    .filter((r) => r.url && ch.match.test(r.url) && !seen.has(r.url) && seen.add(r.url))
    .slice(0, ch.limit);

  const posts = [];
  for (let i = 0; i < picked.length; i++) {
    const r = picked[i];
    const og = r.image && r.title ? { image: r.image, title: r.title, desc: r.snippet } : await ogMeta(r.url);
    posts.push({
      url: r.url,
      channel: channelKey,
      channelLabel: ch.label,
      topicId: topic.id,
      topicLabel: topic.label,
      author: og.site || ch.label,
      text: og.title || r.title || og.desc || r.snippet || topic.label,
      thumbnailUrl: og.image || r.image || null,
      postType: ch.postType,
      foundVia: query,
      publishedAt: null,
      metrics: {},
      engagement: 0,
      searchRank: i + 1,
    });
  }

  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(join(RAW_DIR, `${channelKey}__${topic.id}.json`), JSON.stringify(picked, null, 2));
  console.log(`  → ${ch.label} / ${topic.label}: ${posts.length} posts  [${query}]`);
  return posts;
}

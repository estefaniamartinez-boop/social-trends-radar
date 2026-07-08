import { join } from 'node:path';
import { APIFY_TOKEN, SITE_URL, topics, channelKeys } from './config.mjs';
import { collect } from './collect.mjs';
import { rank } from './rank.mjs';
import { buildDashboard } from './dashboard.mjs';

const PUBLIC_DIR = join(process.cwd(), 'public');
const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

// Pull prior days' archived JSON from the live Pages site so the rebuilt
// dashboard keeps every past day browsable (Research Day selector).
// gh-pages keeps data/<date>.json forever (keep_files:true); this reads them
// back so index.html re-renders the full archive each run. Best-effort.
async function fetchArchive(currentDate) {
  if (!SITE_URL) return [];
  const out = [];
  try {
    const r = await fetch(`${SITE_URL}/data/days.json`);
    if (!r.ok) return [];
    const days = await r.json();
    const prior = [...new Set(days)].filter((d) => d && d !== currentDate).sort().reverse().slice(0, 29); // up to 30 days total incl today
    for (const d of prior) {
      try {
        const jr = await fetch(`${SITE_URL}/data/${d}.json`);
        if (jr.ok) { const j = await jr.json(); out.push({ date: d, posts: j.posts || [] }); }
      } catch { /* skip a missing/broken day */ }
    }
    console.log(`Archive: pulled ${out.length} prior day(s) from ${SITE_URL}`);
  } catch (e) {
    console.log(`Archive: none pulled (${e.message})`);
  }
  return out;
}

async function main() {
  if (!APIFY_TOKEN) {
    console.error('APIFY_TOKEN is not set. Add it as a GitHub Actions secret (or export it locally).');
    process.exit(1);
  }

  console.log(`Social Trend Radar — run ${date}`);
  const finalPosts = [];

  for (const topic of topics) {
    console.log(`\n■ Topic: ${topic.label}`);
    for (const ch of channelKeys) {
      const raw = await collect(ch, topic);
      finalPosts.push(...rank(raw)); // top N per topic per channel
    }
  }

  console.log(`\nCollected ${finalPosts.length} posts today. Fetching archive ...`);
  const archive = await fetchArchive(date);
  const daysData = [{ date, posts: finalPosts }, ...archive].sort((a, b) => b.date.localeCompare(a.date));

  console.log(`Building dashboard (${daysData.length} day(s)) ...`);
  buildDashboard(daysData, topics, date, PUBLIC_DIR);

  console.log(`\n✓ Done. ${finalPosts.length} posts today, ${daysData.length} day(s) archived. Dashboard at public/index.html`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

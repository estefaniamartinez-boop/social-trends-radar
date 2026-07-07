import { join } from 'node:path';
import { APIFY_TOKEN, topics, channelKeys } from './config.mjs';
import { collect } from './collect.mjs';
import { rank } from './rank.mjs';
import { buildDashboard } from './dashboard.mjs';

const PUBLIC_DIR = join(process.cwd(), 'public');
const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

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

  console.log('Building dashboard ...');
  buildDashboard(finalPosts, topics, date, PUBLIC_DIR);

  console.log(`\n✓ Done. ${finalPosts.length} posts. Dashboard at public/index.html`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

import { ApifyClient } from 'apify-client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APIFY_TOKEN, ACTOR_TIMEOUT_SECS, channels } from './config.mjs';

const client = new ApifyClient({ token: APIFY_TOKEN });
const RAW_DIR = join(process.cwd(), 'output', 'raw');

/**
 * Run one channel's Apify actor for one topic and return normalized posts.
 * Saves the raw actor output to output/raw/<channel>__<topic>.json for debugging
 * field mappings. Never throws — returns [] on failure so the run continues.
 */
export async function collect(channelKey, topic) {
  const ch = channels[channelKey];
  const input = ch.buildInput(topic);
  // What surfaced these posts — the exact term we searched, shown on each card.
  const foundVia = (channelKey === 'instagram' || channelKey === 'facebook')
    ? '#' + (topic.hashtags[0] || topic.id)
    : (topic.keywords[0] || topic.label);
  try {
    console.log(`  → ${ch.label} / ${topic.label}: running ${ch.actorId} ...`);
    const run = await client.actor(ch.actorId).call(input, { waitSecs: ACTOR_TIMEOUT_SECS });
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    mkdirSync(RAW_DIR, { recursive: true });
    writeFileSync(join(RAW_DIR, `${channelKey}__${topic.id}.json`), JSON.stringify(items, null, 2));

    const posts = items
      .map((it) => {
        try { return ch.normalize(it); } catch { return null; }
      })
      .filter(Boolean)
      .map((p) => ({
        ...p,
        channel: channelKey,
        channelLabel: ch.label,
        topicId: topic.id,
        topicLabel: topic.label,
        foundVia,
        engagement: ch.score(p.metrics),
      }));

    console.log(`    ✓ ${items.length} raw → ${posts.length} usable`);
    return posts;
  } catch (err) {
    console.error(`    ✗ ${ch.label} / ${topic.label} failed: ${err.message}`);
    return [];
  }
}

import { TOP_N } from './config.mjs';

/**
 * Search results have no engagement metrics, so we rank by search position
 * (the search engine's own relevance order). Dedupe by URL, keep the top N.
 */
export function rank(posts) {
  const seen = new Set();
  return posts
    .filter((p) => p.url && !seen.has(p.url) && seen.add(p.url))
    .sort((a, b) => (a.searchRank || 99) - (b.searchRank || 99))
    .slice(0, TOP_N);
}

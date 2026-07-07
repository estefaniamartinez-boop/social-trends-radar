import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const topics = JSON.parse(
  readFileSync(join(__dirname, '..', 'config', 'topics.json'), 'utf8')
).topics;

// ---- Tunable run settings (override via env / GitHub Actions) --------------
export const TOP_N = Number(process.env.TOP_N || 5);          // top posts kept per topic per channel
export const MAX_AGE_DAYS = Number(process.env.MAX_AGE_DAYS || 30); // freshness window
export const APIFY_TOKEN = process.env.APIFY_TOKEN;
export const ACTOR_TIMEOUT_SECS = Number(process.env.ACTOR_TIMEOUT_SECS || 300);

// ---- Small defensive helpers (actor outputs are inconsistent) --------------
const num = (v) => (typeof v === 'number' ? v : parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10) || 0);
const pick = (obj, keys) => { for (const k of keys) { const v = obj?.[k]; if (v != null && v !== '') return v; } return undefined; };
const asImg = (v) => (Array.isArray(v) ? (v[0]?.url ?? v[0]?.src ?? v[0]) : (v?.url ?? v?.src ?? v));

/*
 * CHANNELS — the only fragile part of the whole system.
 *
 * Each channel = an Apify actor + how to build its input + how to read its output.
 * Actor slugs change over time. If a channel stops returning data:
 *   1. open https://apify.com/store, find a current actor for that platform,
 *   2. put its slug in the matching ACTOR_* GitHub secret (or edit the default below),
 *   3. run once and check output/raw/<channel>.json to confirm field names,
 *   4. adjust the `normalize` field lists if needed. No other code changes.
 *
 * `score` decides ranking WITHIN a channel (metrics aren't comparable across channels).
 */
export const channels = {
  linkedin: {
    label: 'LinkedIn',
    // Verified 2026-07-06: keyword search, no login/cookies required.
    actorId: process.env.ACTOR_LINKEDIN || 'apimaestro/linkedin-posts-search-scraper-no-cookies',
    buildInput: (t) => ({
      keyword: t.keywords[0],       // this actor searches ONE term per run
      sort_type: 'relevance',
      total_posts: 40,
      date_filter: 'past-month',
    }),
    normalize: (it) => {
      const url = pick(it, ['url', 'postUrl', 'link', 'shareUrl']);
      if (!url) return null;
      const thumb = asImg(pick(it, ['image', 'imageUrl', 'thumbnailUrl', 'images', 'media']));
      const hasVideo = !!pick(it, ['videoUrl', 'video']);
      const imgCount = Array.isArray(it.images) ? it.images.length : 0;
      return {
        url,
        author: pick(it, ['authorName', 'author', 'actorName', 'fullName', 'authorFullName']) || '',
        text: pick(it, ['text', 'postText', 'content', 'description']) || '',
        postType: hasVideo ? 'video' : imgCount > 1 ? 'carousel' : thumb ? 'image' : 'text',
        thumbnailUrl: thumb || null,
        metrics: {
          likes: num(pick(it, ['numLikes', 'likes', 'reactionsCount', 'likesCount', 'totalReactionCount'])),
          comments: num(pick(it, ['numComments', 'comments', 'commentsCount'])),
          shares: num(pick(it, ['numShares', 'shares', 'repostsCount', 'sharesCount'])),
          views: num(pick(it, ['numViews', 'views'])),
        },
        publishedAt: pick(it, ['postedAtISO', 'publishedAt', 'date', 'postedAt', 'time']) || null,
      };
    },
    score: (m) => m.likes + 2 * m.comments + 3 * m.shares,
  },

  instagram: {
    label: 'Instagram',
    actorId: process.env.ACTOR_INSTAGRAM || 'apify/instagram-scraper',
    // Verified 2026-07-06: directUrls to tag pages is the most reliable way to
    // pull recent posts per hashtag (URLs take priority over `search`).
    buildInput: (t) => ({
      directUrls: t.hashtags.map((h) => `https://www.instagram.com/explore/tags/${h}/`),
      resultsType: 'posts',
      resultsLimit: 20,
      onlyPostsNewerThan: '1 month',
    }),
    normalize: (it) => {
      const url = pick(it, ['url', 'postUrl', 'permalink']);
      if (!url) return null;
      const isVideo = it.type === 'Video' || !!pick(it, ['videoUrl', 'videoViewCount']);
      const sidecar = Array.isArray(it.images) && it.images.length > 1;
      return {
        url,
        author: pick(it, ['ownerUsername', 'ownerFullName', 'username']) || '',
        text: pick(it, ['caption', 'text']) || '',
        postType: isVideo ? 'video' : sidecar ? 'carousel' : 'image',
        thumbnailUrl: asImg(pick(it, ['displayUrl', 'thumbnailUrl', 'imageUrl', 'images'])) || null,
        metrics: {
          likes: num(pick(it, ['likesCount', 'likes'])),
          comments: num(pick(it, ['commentsCount', 'comments'])),
          shares: 0,
          views: num(pick(it, ['videoViewCount', 'videoPlayCount', 'views'])),
        },
        publishedAt: pick(it, ['timestamp', 'takenAtISO', 'publishedAt']) || null,
      };
    },
    score: (m) => m.likes + 2 * m.comments + 0.05 * m.views,
  },

  facebook: {
    label: 'Facebook',
    // Verified 2026-07-06: official hashtag scraper. Keywords with spaces return
    // nothing, so we feed the single-word hashtags (best Facebook keyword option).
    actorId: process.env.ACTOR_FACEBOOK || 'apify/facebook-hashtag-scraper',
    buildInput: (t) => ({
      keywordList: t.hashtags,
      resultsLimit: 40,
    }),
    normalize: (it) => {
      const url = pick(it, ['url', 'postUrl', 'topLevelUrl', 'link']);
      if (!url) return null;
      const hasVideo = !!pick(it, ['videoUrl', 'video']);
      return {
        url,
        author: pick(it, ['pageName', 'author', 'user', 'from']) || '',
        text: pick(it, ['text', 'message', 'postText']) || '',
        postType: hasVideo ? 'video' : pick(it, ['image', 'thumbnailUrl']) ? 'image' : 'text',
        thumbnailUrl: asImg(pick(it, ['thumbnailUrl', 'image', 'images', 'media'])) || null,
        metrics: {
          likes: num(pick(it, ['likes', 'likesCount', 'reactionsCount', 'reactions'])),
          comments: num(pick(it, ['comments', 'commentsCount'])),
          shares: num(pick(it, ['shares', 'sharesCount'])),
          views: num(pick(it, ['viewsCount', 'views'])),
        },
        publishedAt: pick(it, ['time', 'date', 'publishedAt', 'timestamp']) || null,
      };
    },
    score: (m) => m.likes + 2 * m.comments + 3 * m.shares,
  },

  youtube: {
    label: 'YouTube',
    // Verified 2026-07-06: keyword search via searchQueries array.
    actorId: process.env.ACTOR_YOUTUBE || 'streamers/youtube-scraper',
    buildInput: (t) => ({
      searchQueries: t.keywords,
      maxResults: 40,
      maxResultsShorts: 0,
      maxResultStreams: 0,
      sortingOrder: 'relevance',
      dateFilter: 'month',
    }),
    normalize: (it) => {
      const url = pick(it, ['url', 'videoUrl', 'link']);
      if (!url) return null;
      return {
        url,
        author: pick(it, ['channelName', 'channelUsername', 'author']) || '',
        text: pick(it, ['title', 'text']) || '',
        postType: 'video',
        thumbnailUrl: asImg(pick(it, ['thumbnailUrl', 'thumbnail', 'thumbnails'])) || null,
        metrics: {
          likes: num(pick(it, ['likes', 'likesCount'])),
          comments: num(pick(it, ['commentsCount', 'comments'])),
          shares: 0,
          views: num(pick(it, ['viewCount', 'views'])),
        },
        publishedAt: pick(it, ['date', 'publishedAt', 'uploadDate']) || null,
      };
    },
    score: (m) => m.views + 5 * m.likes + 10 * m.comments,
  },
};

export const channelKeys = Object.keys(channels);

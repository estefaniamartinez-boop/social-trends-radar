# Forceget · Social Trend Radar

Automatically searches **LinkedIn, Instagram, Facebook, and YouTube** every day for the
top-performing posts across Forceget's 5 tracked topics, then builds a **visual dashboard**
of cards (asset + copy + post type + engagement + why it worked) so the content team can
replicate what's working.

Runs entirely on **GitHub Actions** (free daily cron) → publishes to **GitHub Pages**.
No servers, no manual steps once set up.

---

## ⚠️ Read this first — what "trending" means here

**Impressions are private.** Nobody can see impressions on posts they don't own — not through
any API or scraper. So this tool ranks posts by **public engagement**, the same proxy every
social-listening tool uses:

| Channel   | Ranked by |
|-----------|-----------|
| LinkedIn  | reactions + comments + reposts |
| Instagram | likes + comments + Reel views |
| Facebook  | reactions + comments + shares |
| YouTube   | views + likes + comments |

That's the honest, real-world signal for "what's performing."

---

## The 5 topics (edit anytime in `config/topics.json`)

1. DTC Fulfillment
2. Instant Quotation Tool
3. Amazon 1P Revenue Recovery (vendor reimbursements / revenue recovery)
4. Amazon FBA Shipping & Fulfillment
5. Supply Chain Insights

Change the `keywords` / `hashtags` in `config/topics.json` and the next run picks them up —
no code changes needed.

---

## One-time setup (~15 minutes)

### 1. Get an Apify token
- Sign up at [apify.com](https://apify.com) (you already use it for ads scraping).
- **Settings → Integrations → copy your API token.**
- Apify cost at daily cadence is roughly **$5–25/month** depending on volume. The $5 free
  monthly credit covers light use.

### 2. Create the GitHub repo
- Create a new repo (private is fine) and upload this whole folder.

### 3. Add the token as a secret
- Repo → **Settings → Secrets and variables → Actions → New repository secret**
- Name: `APIFY_TOKEN` — Value: your token. Save.
- (Optional) add `ACTOR_LINKEDIN`, `ACTOR_INSTAGRAM`, `ACTOR_FACEBOOK`, `ACTOR_YOUTUBE`
  only if you later swap to a different Apify actor — otherwise leave them out.

### 4. Turn on GitHub Pages
- Repo → **Settings → Pages → Source: "Deploy from a branch" → Branch: `gh-pages` / root.**
- (The `gh-pages` branch is created automatically after the first run.)

### 5. Run it once
- Repo → **Actions → "Daily Social Trend Radar" → Run workflow.**
- After it finishes, your dashboard is live at
  `https://<your-username>.github.io/<repo-name>/`
- After that it runs itself **every day at 06:00 UTC** (change the `cron` line in
  `.github/workflows/daily.yml` to your preferred time).

---

## Tuning

| What | Where |
|------|-------|
| Topics / keywords / hashtags | `config/topics.json` |
| How many posts per topic per channel | `TOP_N` in the workflow (default 5) |
| Freshness window (ignore posts older than N days) | `MAX_AGE_DAYS` (default 30) |
| Daily run time | `cron:` in `.github/workflows/daily.yml` |
| Ranking weights per channel | `score:` functions in `src/config.mjs` |
| Card look (colors, layout) | `src/cards.mjs` (Forceget purple by default) |

---

## If a channel stops returning data

Actor slugs on the Apify store occasionally get renamed or deprecated. When that happens:

1. Open [apify.com/store](https://apify.com/store) and find a current actor for that platform.
2. Add its slug as the matching `ACTOR_*` secret (e.g. `ACTOR_LINKEDIN`).
3. Run once, then open `output/raw/<channel>__<topic>.json` (saved every run) to confirm the
   field names, and adjust the `normalize` field lists in `src/config.mjs` if they differ.

Everything else — scheduling, ranking, cards, dashboard — keeps working untouched.

### Verified default actors (checked 2026-07-06)

| Channel   | Apify actor slug | Searches by |
|-----------|------------------|-------------|
| LinkedIn  | `apimaestro/linkedin-posts-search-scraper-no-cookies` | keyword (no login) |
| Instagram | `apify/instagram-scraper` | hashtags |
| Facebook  | `apify/facebook-hashtag-scraper` | hashtags |
| YouTube   | `streamers/youtube-scraper` | keywords |

> **Note on Facebook:** Facebook's own keyword search is unreliable and rejects multi-word
> terms, so this uses the official **hashtag** scraper (single-word `hashtags` from
> `topics.json`). If you want richer Facebook coverage, swap in a Page-based actor
> (`apify/facebook-posts-scraper`) via the `ACTOR_FACEBOOK` secret and add Page URLs.
>
> **Note on LinkedIn:** that actor searches **one keyword per run**, so it uses the *first*
> keyword in each topic. Put your strongest term first in `config/topics.json`.

---

## Run locally (optional, to test before pushing)

```bash
npm install
npx playwright install chromium
# PowerShell:
$env:APIFY_TOKEN="your_token"; npm start
# then open public/index.html in a browser
```

---

## What runs where

- **Scheduling + data collection + card rendering + dashboard build** → GitHub Actions (free).
- **Data source** → Apify actors (keyword/hashtag search) + saved raw output for debugging.
- **Hosting the dashboard** → GitHub Pages (`gh-pages` branch, history preserved).
- **Claude** → only used to build/maintain this. Nothing Claude-side runs on the daily schedule.

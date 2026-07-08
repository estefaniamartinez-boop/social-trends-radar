import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/* Forceget house-board style + multi-day archive (Research Day selector). */
const NAVY = '#0D1726', PURPLE = '#5850EB', RED = '#FA5959', YELLOW = '#FFC118', TEAL = '#0E9C9C', BODY = '#F7F8FC';
const CHANNEL = {
  linkedin: { c: '#0A66C2', label: 'LinkedIn' },
  instagram: { c: '#C13584', label: 'Instagram' },
  facebook: { c: '#1877F2', label: 'Facebook' },
  youtube: { c: '#FF0000', label: 'YouTube' },
};

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const truncate = (s = '', n = 240) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

function daysAgo(publishedAt, runDate) {
  if (!publishedAt) return '';
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return '';
  const d = Math.floor((Date.parse(runDate + 'T12:00:00Z') - t) / 86_400_000);
  if (d <= 0) return 'today';
  if (d === 1) return '1 day ago';
  if (d < 30) return `${d} days ago`;
  const m = Math.floor(d / 30);
  return m === 1 ? '~1 month ago' : `~${m} months ago`;
}

function card(p, runDate) {
  const ch = CHANNEL[p.channel] || { c: PURPLE, label: p.channelLabel || p.channel };
  const type = (p.postType || 'post').toUpperCase();
  const visual = p.thumbnailUrl
    ? `<div class="tr-visual"><img src="${esc(p.thumbnailUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer"
         onerror="this.parentNode.classList.add('tile');this.parentNode.dataset.type='${esc(type)}';this.remove();">
         <span class="tr-typebadge">${esc(type)}</span></div>`
    : `<div class="tr-visual tile" data-type="${esc(type)}"><span class="tr-typebadge">${esc(type)}</span></div>`;
  const ago = daysAgo(p.publishedAt, runDate);
  const date = p.publishedAt ? esc(String(p.publishedAt).slice(0, 10)) : 'date n/a';
  const found = p.foundVia ? `<span class="tr-found">found via: ${esc(p.foundVia)}</span>` : '';
  return `<article class="tr-card" data-topic="${esc(p.topicId)}" data-ch="${esc(p.channel)}" style="--tc:${esc(p.topicColor || PURPLE)}">
    ${visual}
    <div class="tr-body">
      <div class="tr-row"><span class="tr-eyebrow">${esc(p.topicLabel)}</span><span class="tr-chip" style="background:${ch.c}">${esc(ch.label)}</span></div>
      <div class="tr-acct">${esc(p.author || 'unknown')}</div>
      <p class="tr-snip"><span class="tr-star">★</span> ${esc(truncate(p.text))}</p>
      <div class="tr-foot">${found}<span class="tr-date">posted ${date}${ago ? ' · ' + esc(ago) : ''}</span></div>
      <a class="tr-open" href="${esc(p.url)}" target="_blank" rel="noopener">Open post →</a>
    </div>
  </article>`;
}

function dayBlock({ date, posts }, topics, isLatest) {
  const byTopic = topics.map((t) => ({
    t,
    posts: (posts || []).filter((p) => p.topicId === t.id).sort((a, b) => (b.engagement || 0) - (a.engagement || 0)),
  }));
  const sections = byTopic.map(({ t, posts }) => `
    <section class="tr-topic" data-topic="${esc(t.id)}">
      <h2 style="--tc:${esc(t.color || PURPLE)}">${esc(t.label)} <span>${posts.length}</span></h2>
      <div class="tr-grid">
        ${posts.length ? posts.map((p) => card({ ...p, topicColor: t.color }, date)).join('')
          : `<div class="tr-gap">No public post surfaced for this topic on this day.</div>`}
      </div>
    </section>`).join('');
  return `<div class="tr-day" data-date="${esc(date)}"${isLatest ? '' : ' hidden'}>
    <div class="tr-daylabel">Research day: <strong>${esc(date)}</strong> · ${posts.length} posts</div>
    ${sections}
  </div>`;
}

/**
 * daysData: array of { date, posts }, newest first (index 0 = today's run).
 * Writes data/<date>.json (today), data/days.json (all known dates), index.html (all days + Research Day selector).
 */
export function buildDashboard(daysData, topics, date, publicDir) {
  mkdirSync(join(publicDir, 'data'), { recursive: true });
  const today = daysData[0];
  writeFileSync(join(publicDir, 'data', `${date}.json`), JSON.stringify({ date, posts: today.posts }, null, 2));

  const allDates = [...new Set(daysData.map((d) => d.date))].sort().reverse();
  writeFileSync(join(publicDir, 'data', 'days.json'), JSON.stringify(allDates, null, 2));

  const tcolor = Object.fromEntries(topics.map((t) => [t.id, t.color || PURPLE]));
  daysData.forEach((d) => (d.posts || []).forEach((p) => (p.topicColor = tcolor[p.topicId])));

  const totalToday = today.posts.length;
  const freshest = [...(today.posts || [])].filter((p) => p.publishedAt).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0];

  const dayOptions = ['<option value="__latest">Latest (' + esc(date) + ')</option>', '<option value="__all">All days</option>']
    .concat(allDates.map((d) => `<option value="${esc(d)}"${d === date ? '' : ''}>${esc(d)}</option>`)).join('');

  const groups = ['Core', 'Launches & Web'];
  const pills = groups.map((g) => {
    const items = topics.filter((t) => (t.group || 'Core') === g);
    return `<span class="tr-pgroup">${esc(g)}</span>` + items.map((t) =>
      `<button class="tr-pill" data-topic="${esc(t.id)}"><i style="background:${esc(t.color || PURPLE)}"></i>${esc(t.label)}</button>`).join('');
  }).join('<span class="tr-pdiv"></span>');

  const chanPills = ['all', 'linkedin', 'instagram', 'facebook', 'youtube'].map((c) =>
    `<button class="tr-cpill${c === 'all' ? ' on' : ''}" data-ch="${c}">${c === 'all' ? 'All channels' : (CHANNEL[c]?.label || c)}</button>`).join('');

  const dayBlocks = daysData.map((d, i) => dayBlock(d, topics, i === 0)).join('');

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Forceget · Trend Radar</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root{--navy:${NAVY};--purple:${PURPLE};--red:${RED};--yellow:${YELLOW};--teal:${TEAL}}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'DM Sans',system-ui,sans-serif;background:${BODY};color:#12203a;-webkit-font-smoothing:antialiased}
  h1,h2,.tr-eyebrow,.tr-pgroup{font-family:'Plus Jakarta Sans',system-ui,sans-serif}
  .tr-hero{background:radial-gradient(120% 140% at 100% 0%,#1b2a44 0%,${NAVY} 55%);color:#fff;padding:44px 40px 32px}
  .tr-hero h1{font-size:clamp(28px,4vw,46px);font-weight:800;line-height:1.05;max-width:16ch}
  .tr-hero h1 em{color:${RED};font-style:normal}
  .tr-hero p{opacity:.82;margin-top:12px;font-size:15px;max-width:60ch}
  .tr-meta{margin-top:16px;font-size:13px;opacity:.7}
  .tr-banner{background:#eef0fb;border-bottom:1px solid #e0e3f5;padding:10px 40px;font-size:13px;color:#3a2a5a}
  .tr-controls{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid #e7e9f3;padding:12px 40px;box-shadow:0 2px 10px rgba(13,23,38,.05)}
  .tr-dayrow{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
  .tr-dayrow label{font:700 12px 'Plus Jakarta Sans',sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#6b7590}
  #tr-daysel{font:600 13px 'DM Sans',sans-serif;padding:7px 12px;border:1px solid #dfe3ee;border-radius:10px;background:#fff;color:${NAVY};cursor:pointer}
  .tr-pills{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .tr-pgroup{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8a93ab;font-weight:700;margin:0 4px}
  .tr-pdiv{width:1px;height:20px;background:#e0e3f0;margin:0 6px}
  .tr-pill,.tr-cpill{border:1px solid #dfe3ee;background:#fff;border-radius:999px;padding:7px 13px;font:600 13px 'DM Sans',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:7px;color:#33415c}
  .tr-pill i{width:9px;height:9px;border-radius:50%;display:inline-block}
  .tr-pill.on{background:${PURPLE};color:#fff;border-color:${PURPLE}}
  .tr-cpill.on{background:${NAVY};color:#fff;border-color:${NAVY}}
  .tr-chanrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
  main{max-width:1360px;margin:0 auto;padding:12px 40px 72px}
  .tr-daylabel{font:700 13px 'Plus Jakarta Sans',sans-serif;color:${PURPLE};margin:22px 0 4px}
  .tr-topic{margin-top:26px}
  .tr-topic h2{font-size:18px;color:var(--tc);border-bottom:2px solid #e9ebf5;padding-bottom:8px;margin-bottom:16px;display:flex;align-items:center;gap:10px}
  .tr-topic h2 span{font-size:12px;background:var(--tc);color:#fff;border-radius:999px;padding:2px 9px}
  .tr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
  .tr-card{background:#fff;border:1px solid #eceef6;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 3px 14px rgba(13,23,38,.06);transition:transform .15s,box-shadow .15s}
  .tr-card:hover{transform:translateY(-3px);box-shadow:0 10px 26px rgba(13,23,38,.11)}
  .tr-visual{position:relative;aspect-ratio:16/10;background:#eef0f6;overflow:hidden}
  .tr-visual img{width:100%;height:100%;object-fit:cover;display:block}
  .tr-visual.tile{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,${NAVY} 0%,#26365a 100%)}
  .tr-visual.tile .tr-typebadge{position:static;font-size:20px;font-weight:800;color:#fff;background:none}
  .tr-typebadge{position:absolute;top:10px;left:10px;background:rgba(13,23,38,.78);color:#fff;font-size:10px;font-weight:700;letter-spacing:.05em;padding:4px 9px;border-radius:6px}
  .tr-body{padding:15px 16px 16px;display:flex;flex-direction:column;gap:9px;flex:1}
  .tr-row{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .tr-eyebrow{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--tc)}
  .tr-chip{font-size:10px;font-weight:700;color:#fff;padding:3px 9px;border-radius:999px}
  .tr-acct{font-weight:700;font-size:14px;color:#16233d}
  .tr-snip{font-size:13.5px;line-height:1.5;color:#39445c;flex:1}
  .tr-star{color:${YELLOW}}
  .tr-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:11px;color:#8a93ab}
  .tr-found{background:#f0ecfb;color:${PURPLE};font-weight:700;padding:3px 8px;border-radius:6px}
  .tr-open{margin-top:4px;color:${PURPLE};font-weight:700;font-size:13px;text-decoration:none}
  .tr-open:hover{text-decoration:underline}
  .tr-gap{grid-column:1/-1;border:1px dashed #cfd5e6;border-radius:12px;padding:16px;color:#98a1b6;font-style:italic;font-size:14px}
  .tr-card.hide,.tr-topic.hide{display:none}
  footer{text-align:center;padding:34px;color:#8a93ab;font-size:12px;line-height:1.6}
  @media (max-width:600px){.tr-hero,.tr-controls,.tr-banner,main{padding-left:20px;padding-right:20px}}
</style></head><body>
<header class="tr-hero">
  <h1>What others are <em>posting</em> about our topics</h1>
  <p>A daily radar of real Instagram, Facebook, LinkedIn &amp; YouTube posts across Forceget's 9 tracked topics — ranked by public engagement, archived every day so you can look back.</p>
  <div class="tr-meta">${totalToday} posts today · ${topics.length} topics · ${allDates.length} day(s) archived · latest ${esc(date)}</div>
</header>
${freshest ? `<div class="tr-banner">Most recent post: ${esc(String(freshest.publishedAt).slice(0,10))} · ${esc(freshest.author || freshest.channelLabel || '')} · auto-refreshes daily</div>` : ''}
<div class="tr-controls">
  <div class="tr-dayrow">
    <label for="tr-daysel">Research day</label>
    <select id="tr-daysel">${dayOptions}</select>
  </div>
  <div class="tr-pills"><button class="tr-pill on" data-topic="all"><i style="background:#8a93ab"></i>All topics</button>${pills}</div>
  <div class="tr-chanrow">${chanPills}</div>
</div>
<main>${dayBlocks}</main>
<footer>Ranked by public engagement (likes · comments · shares · views) — impressions are private and never shown.<br>Auto-generated daily via Apify · archived per day · Forceget · Supply Chain Logistics</footer>
<script>
  var day='__latest', topic='all', chan='all';
  var LATEST=${JSON.stringify(date)};
  function apply(){
    document.querySelectorAll('.tr-day').forEach(function(dv){
      var show = day==='__all' || (day==='__latest'? dv.dataset.date===LATEST : dv.dataset.date===day);
      dv.hidden = !show;
      if(show){
        dv.querySelectorAll('.tr-card').forEach(function(c){
          var ok=(topic==='all'||c.dataset.topic===topic)&&(chan==='all'||c.dataset.ch===chan);
          c.classList.toggle('hide',!ok);
        });
        dv.querySelectorAll('.tr-topic').forEach(function(s){
          s.classList.toggle('hide', topic!=='all' && s.dataset.topic!==topic);
        });
      }
    });
  }
  document.getElementById('tr-daysel').addEventListener('change',function(e){day=e.target.value;apply();window.scrollTo({top:0,behavior:'smooth'});});
  document.querySelectorAll('.tr-pill').forEach(function(b){b.onclick=function(){
    document.querySelectorAll('.tr-pill').forEach(function(x){x.classList.remove('on')});b.classList.add('on');topic=b.dataset.topic;apply();};});
  document.querySelectorAll('.tr-cpill').forEach(function(b){b.onclick=function(){
    document.querySelectorAll('.tr-cpill').forEach(function(x){x.classList.remove('on')});b.classList.add('on');chan=b.dataset.ch;apply();};});
  apply();
</script></body></html>`;

  writeFileSync(join(publicDir, 'index.html'), html);
}

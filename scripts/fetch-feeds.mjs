/**
 * Fetch the configured feeds and write the Radar inbox snapshot.
 *
 *   node scripts/fetch-feeds.mjs                    → public/feed.json
 *   node scripts/fetch-feeds.mjs --fixtures <dir>   → read <dir>/<feed id>.xml instead of the network
 *   node scripts/fetch-feeds.mjs --out <file> --config <file> --now <ISO date>
 *
 * Runs daily in GitHub Actions (.github/workflows/feeds.yml); also works on any
 * machine with Node 20+. Zero dependencies. A failing feed never breaks the run:
 * its error is recorded in the snapshot's health list and its previous items are
 * kept. If every feed fails (e.g. no network), nothing is written and the exit
 * code is 1, so a broken network can't wipe out the inbox.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { dedupe, mergeWithPrevious, normalizeItems, parseFeed } from './lib/feeds.mjs';

const root = join(import.meta.dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const configPath = resolve(arg('config', join(root, 'feeds.config.json')));
const outPath = resolve(arg('out', join(root, 'public', 'feed.json')));
const fixtures = arg('fixtures', null);
const now = arg('now', null) ? Date.parse(arg('now')) : Date.now();
const config = JSON.parse(readFileSync(configPath, 'utf8'));

// Fixtures are synthetic test data. They must never land in the real snapshot.
if (fixtures && !process.argv.includes('--out')) {
  console.error('--fixtures requires an explicit --out path (fixture items must never be written to public/feed.json).');
  process.exit(2);
}

const UA = 'KitsuneContentStudio/0.2 (+feed reader; https://github.com/michaelbgreenblatt-beep/Kitsune-Publishing)';

async function fetchText(url) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' },
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (/HTTP 4\d\d/.test(err.message)) break; // client errors won't fix themselves
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

async function readFeed(feed) {
  if (fixtures) {
    const p = join(resolve(fixtures), `${feed.id}.xml`);
    if (!existsSync(p)) throw new Error('no fixture');
    return readFileSync(p, 'utf8');
  }
  return fetchText(feed.url);
}

/** Run tasks with a small concurrency cap — polite to the sources. */
async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); }
  }));
  return results;
}

const feeds = (config.feeds || []).filter((f) => f && f.id && f.url && f.track && !f.disabled);
const checkedAt = new Date(now).toISOString();

const runs = await pool(feeds, 4, async (feed) => {
  try {
    const raw = parseFeed(await readFeed(feed));
    const items = normalizeItems(raw, feed, config, now);
    return { feed, items, health: { id: feed.id, label: feed.label, track: feed.track, url: feed.url, ok: true, items: items.length, parsed: raw.length, checkedAt } };
  } catch (err) {
    const error = err.name === 'TimeoutError' ? 'timed out' : String(err.message || err).slice(0, 160);
    return { feed, items: [], health: { id: feed.id, label: feed.label, track: feed.track, url: feed.url, ok: false, items: 0, error, checkedAt } };
  }
});

const okFeedIds = new Set(runs.filter((r) => r.health.ok).map((r) => r.feed.id));
for (const r of runs) {
  const h = r.health;
  console.log(`${h.ok ? 'ok  ' : 'FAIL'} ${h.id.padEnd(20)} ${h.ok ? `${h.items}/${h.parsed} kept` : h.error}`);
}

if (!okFeedIds.size) {
  console.error(`\nNo feed could be read (${feeds.length} tried) — leaving ${outPath} untouched.`);
  process.exit(1);
}

let previous = null;
try { previous = JSON.parse(readFileSync(outPath, 'utf8')); } catch { /* first run */ }

const items = mergeWithPrevious(dedupe(runs.flatMap((r) => r.items)), previous, {
  okFeedIds, now, windowDays: config.windowDays ?? 30, maxItems: config.maxItems ?? 300,
});

const snapshot = {
  generatedAt: checkedAt,
  windowDays: config.windowDays ?? 30,
  feeds: runs.map((r) => r.health),
  items,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 1)}\n`);
console.log(`\n${okFeedIds.size}/${feeds.length} feeds ok · ${items.length} items → ${outPath}`);

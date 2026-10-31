/* Feed library guarantees. Run: npm test (node:test, no dependencies). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  canonicalLink, cleanText, dedupe, guessAudience, hashId, mergeWithPrevious, normalizeItems, parseFeed, scoreItem,
} from '../scripts/lib/feeds.mjs';

const root = join(import.meta.dirname, '..');
const fx = (name) => readFileSync(join(root, 'test', 'fixtures', name), 'utf8');
const config = JSON.parse(readFileSync(join(root, 'feeds.config.json'), 'utf8'));
const NOW = Date.parse('2026-10-31T12:00:00Z');
const feed = (id) => config.feeds.find((f) => f.id === id);

test('parses RSS 2.0 with CDATA, entity-escaped HTML, and aggregator <source>', () => {
  const items = parseFeed(fx('artificial-lawyer.xml'));
  assert.equal(items.length, 2);
  assert.equal(items[0].title, '[TEST] Legal AI startup raises Series B for contract review');
  assert.match(items[0].summary, /^The company says law firms & in-house teams use it for contract review\.$/);
  assert.equal(items[1].title, '[TEST] Bar ethics opinion on AI ‘hallucinations’ in briefs');
  const gn = parseFeed(fx('gn-ai-rules.xml'));
  assert.equal(gn[0].origin, 'Example Gazette');
  assert.doesNotMatch(gn[0].summary, /<|&lt;|&nbsp;/);
  // Normalized: the publisher moves out of the headline and summary into its own field.
  const [norm] = normalizeItems(gn, feed('gn-ai-rules'), config, NOW);
  assert.equal(norm.title, '[TEST] State finalizes rulemaking on automated hiring tools');
  assert.equal(norm.summary, 'Regulators adopt a final rule');
  assert.equal(norm.origin, 'Example Gazette');
});

test('parses Atom (rel=alternate link, published date) and RSS 1.0 / RDF (dc:date)', () => {
  const atom = parseFeed(fx('simonwillison.xml'));
  assert.equal(atom[0].link, 'https://blog.example.org/2026/Oct/30/agents/#atom-everything');
  assert.equal(atom[0].published, '2026-10-30T20:00:00.000Z');
  const rdf = parseFeed(fx('fr-ai.xml'));
  assert.equal(rdf.length, 1);
  assert.equal(rdf[0].published, '2026-10-26T04:00:00.000Z');
});

test('rejects a non-feed page (e.g. a bot-check HTML page) instead of returning junk', () => {
  assert.throws(() => parseFeed(fx('openai.xml')), /Not an RSS or Atom feed/);
});

test('canonical links ignore tracking params, www, fragments, and trailing slashes', () => {
  assert.equal(
    canonicalLink('https://www.news.example.com/articles/hiring-rule/?utm_campaign=x#top'),
    canonicalLink('https://news.example.com/articles/hiring-rule?utm_source=feed&utm_medium=rss'),
  );
  assert.equal(hashId('a'), hashId('a'));
  assert.notEqual(hashId('a'), hashId('b'));
});

test('scoring is explainable: it returns the terms that matched, and short acronyms are case-sensitive', () => {
  const r = scoreItem({ title: 'FTC settles with startup', summary: '', published: new Date(NOW).toISOString() }, feed('gn-ai-enforcement'), config, NOW);
  assert.deepEqual(r.matched.sort(), ['FTC', 'startup']);
  const none = scoreItem({ title: 'The second best section of the guide', summary: '', published: null }, { track: 'regulatory' }, { keywords: { regulatory: [['SEC', 3]] } }, NOW);
  assert.deepEqual(none.matched, []);
});

test('filter:true feeds drop items with no keyword match; old items fall outside the window', () => {
  const kept = normalizeItems(parseFeed(fx('simonwillison.xml')), feed('simonwillison'), config, NOW);
  assert.deepEqual(kept.map((i) => i.title), ['[TEST] Notes on enterprise agents adoption']);
  const rules = normalizeItems(parseFeed(fx('gn-ai-rules.xml')), feed('gn-ai-rules'), config, NOW);
  assert.ok(!rules.some((i) => /chef/i.test(i.title)));
});

test('the same story from two feeds collapses to one item that records where else it appeared', () => {
  const a = normalizeItems(parseFeed(fx('gn-ai-rules.xml')), feed('gn-ai-rules'), config, NOW);
  const b = normalizeItems(parseFeed(fx('gn-ai-enforcement.xml')), feed('gn-ai-enforcement'), config, NOW);
  const merged = dedupe([...a, ...b]);
  const hiring = merged.filter((i) => /hiring tools/.test(i.title));
  assert.equal(hiring.length, 1);
  assert.equal(hiring[0].alsoIn.length, 1);
});

test('merge keeps first-seen dates and items stable across runs, and flags items from failing feeds as stale', () => {
  const run1 = normalizeItems(parseFeed(fx('artificial-lawyer.xml')), feed('artificial-lawyer'), config, NOW);
  const snap1 = { items: mergeWithPrevious(run1, null, { okFeedIds: new Set(['artificial-lawyer']), now: NOW }) };
  const later = NOW + 2 * 864e5;
  // Feed fails on the next run: its items must survive (marked stale) with the same ids and first-seen dates.
  const snap2 = mergeWithPrevious([], snap1, { okFeedIds: new Set(), now: later });
  assert.equal(snap2.length, snap1.items.length);
  for (const it of snap2) {
    const before = snap1.items.find((x) => x.id === it.id);
    assert.equal(it.firstSeen, before.firstSeen);
    assert.equal(it.stale, true);
  }
  // Past the window they age out.
  assert.equal(mergeWithPrevious([], snap1, { okFeedIds: new Set(), now: NOW + 60 * 864e5 }).length, 0);
});

test('audience guess is a default from the text, falling back to the track', () => {
  assert.equal(guessAudience({ title: 'Guide for in-house general counsel', summary: '' }, 'frontier_model'), 'gc');
  assert.equal(guessAudience({ title: 'Seed-stage founders and the new rule', summary: '' }, 'regulatory'), 'founders');
  assert.equal(guessAudience({ title: 'A new model', summary: '' }, 'frontier_model'), 'founders');
});

test('cleanText strips scripts and tags and decodes numeric entities', () => {
  assert.equal(cleanText('<p>A &#x2014; B<script>x()</script></p>'), 'A — B');
});

test('fetch-feeds CLI: writes a snapshot from fixtures, and refuses to overwrite when every feed fails', () => {
  const out = join(root, 'test', '.tmp-feed.json');
  const run = (extra) => execFileSync(process.execPath, [join(root, 'scripts', 'fetch-feeds.mjs'), '--out', out, '--now', '2026-10-31T12:00:00Z', ...extra], { encoding: 'utf8' });
  try {
    run(['--fixtures', join(root, 'test', 'fixtures')]);
    const snap = JSON.parse(readFileSync(out, 'utf8'));
    assert.ok(snap.items.length > 0);
    assert.ok(snap.items.every((i) => i.title.startsWith('[TEST]') && /example\.(com|org|gov)/.test(i.link)));
    assert.ok(snap.feeds.some((f) => f.id === 'openai' && !f.ok && /Not an RSS/.test(f.error)));
    const before = readFileSync(out, 'utf8');
    assert.throws(() => run(['--fixtures', join(root, 'test', 'no-such-dir')]));
    assert.equal(readFileSync(out, 'utf8'), before, 'all-fail run must leave the snapshot untouched');
  } finally {
    rmSync(out, { force: true });
  }
});

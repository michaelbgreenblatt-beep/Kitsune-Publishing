/**
 * Feed library — pure functions, no I/O, no dependencies.
 *
 * Turns raw RSS 2.0 / RSS 1.0 (RDF) / Atom XML into normalized items, scores
 * each one for relevance to the firm's clients, dedupes across feeds, and
 * merges with the previous snapshot so items keep stable ids and first-seen
 * dates across daily runs.
 *
 * Every item keeps its real source link and the feed it came from. Nothing is
 * summarized or rewritten: the "why" shown in the app is the list of keywords
 * that matched, so relevance is explainable rather than asserted.
 */

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', middot: '·', copy: '©', reg: '®', trade: '™',
};

export function decodeEntities(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? m;
  });
}

const unwrapCdata = (s) => String(s ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

/** Strip markup to plain text: CDATA → tags → entities → whitespace. */
export function cleanText(s) {
  let t = unwrapCdata(s);
  // Entity-escaped HTML (common in RSS descriptions) becomes real tags first.
  if (/&lt;\/?[a-z]/i.test(t)) t = decodeEntities(t);
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    // Block tags separate words; inline tags (<strong>, <a>…) must not add spaces.
    .replace(/<\/?(p|br|div|li|ul|ol|h[1-6]|tr|td|th|blockquote|section|article|figure|figcaption|hr)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(t).replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
}

export function truncate(s, n) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–—-]+$/, '')}…`;
}

/** FNV-1a 32-bit → base36. Stable ids for triage state across refreshes. */
export function hashId(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `fi_${(h >>> 0).toString(36)}`;
}

// ---------------------------------------------------------------------------
// XML extraction (deliberately small: feeds are shallow and regular)
// ---------------------------------------------------------------------------

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Inner XML of the first <tag ...>…</tag> (namespaced names allowed). */
function tagText(xml, tag) {
  const m = xml.match(new RegExp(`<${escRe(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escRe(tag)}>`, 'i'));
  return m ? m[1] : '';
}

function tagAttr(xml, tag, attr) {
  const m = xml.match(new RegExp(`<${escRe(tag)}\\s[^>]*\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? decodeEntities(m[2] ?? m[3] ?? '') : '';
}

function blocks(xml, tag) {
  return xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, 'gi')) || [];
}

/** Atom: prefer rel="alternate" (or no rel), else the first href. */
function atomLink(entry) {
  const links = entry.match(/<link\b[^>]*>/gi) || [];
  let fallback = '';
  for (const l of links) {
    const m = l.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const href = m && (m[1] ?? m[2]);
    if (!href) continue;
    const rel = (l.match(/\brel\s*=\s*["']([^"']*)["']/i) || [])[1];
    if (!rel || rel === 'alternate') return decodeEntities(href);
    if (!fallback) fallback = decodeEntities(href);
  }
  return fallback;
}

export function toISODate(s) {
  const raw = cleanText(s);
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Parse a feed document into raw items. Throws if it isn't a feed. */
export function parseFeed(xml) {
  const doc = String(xml ?? '');
  const isAtom = /<feed[\s>]/i.test(doc) && /<entry[\s>]/i.test(doc);
  const isRss = /<(rss|rdf:RDF)[\s>]/i.test(doc) || /<channel[\s>]/i.test(doc);
  if (!isAtom && !isRss) {
    if (/<feed[\s>]/i.test(doc)) return []; // valid Atom feed with no entries
    throw new Error('Not an RSS or Atom feed');
  }
  if (isAtom) {
    return blocks(doc, 'entry').map((e) => ({
      title: cleanText(tagText(e, 'title')),
      link: atomLink(e),
      guid: cleanText(tagText(e, 'id')),
      published: toISODate(tagText(e, 'published') || tagText(e, 'updated')),
      summary: cleanText(tagText(e, 'summary') || tagText(e, 'content')),
      origin: '',
    }));
  }
  return blocks(doc, 'item').map((it) => ({
    title: cleanText(tagText(it, 'title')),
    link: cleanText(tagText(it, 'link')) || tagAttr(it, 'link', 'href') || cleanText(tagText(it, 'guid')),
    guid: cleanText(tagText(it, 'guid')),
    published: toISODate(tagText(it, 'pubDate') || tagText(it, 'dc:date') || tagText(it, 'published') || tagText(it, 'updated')),
    summary: cleanText(tagText(it, 'description') || tagText(it, 'content:encoded')),
    // Google News and some aggregators name the original publisher here.
    origin: cleanText(tagText(it, 'source')),
  }));
}

// ---------------------------------------------------------------------------
// Normalization, scoring, dedupe
// ---------------------------------------------------------------------------

/** Canonical form of a link for dedupe: no tracking params, no fragment. */
export function canonicalLink(link) {
  try {
    const u = new URL(link);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|mc_|fbclid|gclid|ref$|ref_src$|source$)/i.test(k)) u.searchParams.delete(k);
    }
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    const s = u.toString();
    return s.endsWith('/') && u.pathname !== '/' ? s.slice(0, -1) : s;
  } catch {
    return String(link || '').trim();
  }
}

/** Aggregator headlines often end in " - Publisher"; strip it for comparison. */
export function titleKey(title, origin) {
  let t = String(title || '');
  if (origin && t.endsWith(` - ${origin}`)) t = t.slice(0, -(origin.length + 3));
  return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const termRe = new Map();
function matchesTerm(text, term) {
  let re = termRe.get(term);
  if (!re) {
    // Word-boundary match; terms written in caps (SEC, FTC, GC) are case-sensitive
    // so "sec" in "second" or "gc" in "gcc" don't count.
    const caseSensitive = term.length <= 5 && term === term.toUpperCase() && /[A-Z]/.test(term);
    re = new RegExp(`(^|[^A-Za-z0-9])${escRe(term)}($|[^A-Za-z0-9])`, caseSensitive ? '' : 'i');
    termRe.set(term, re);
  }
  return re.test(text);
}

/**
 * Relevance = matched keywords (title counts double) + a small recency bonus.
 * Returns the matched terms so the app can show *why* an item surfaced.
 */
export function scoreItem(item, feed, config, now = Date.now()) {
  const kw = config.keywords || {};
  const lists = [...(kw[feed.track] || []), ...(kw.client || [])];
  const matched = [];
  let score = 0;
  for (const entry of lists) {
    const [term, weight = 1] = Array.isArray(entry) ? entry : [entry, 1];
    const inTitle = matchesTerm(item.title, term);
    const inSummary = !inTitle && matchesTerm(item.summary, term);
    if (inTitle || inSummary) {
      if (!matched.includes(term)) matched.push(term);
      score += weight * (inTitle ? 2 : 1);
    }
  }
  const ageDays = item.published ? (now - Date.parse(item.published)) / 864e5 : 7;
  const recency = Math.max(0, 3 - Math.max(0, ageDays) / 3); // 3 → 0 over ~9 days
  return { score: Math.round((score + recency) * 10) / 10, matched, keywordScore: score };
}

const AUDIENCE_TERMS = {
  gc: ['general counsel', 'GC', 'in-house', 'legal ops', 'legal operations', 'law firm', 'law firms', 'enterprise', 'board', 'compliance', 'procurement', 'vendor'],
  founders: ['startup', 'startups', 'founder', 'founders', 'venture', 'seed', 'Series A', 'fundraising', 'funding', 'developer', 'developers', 'API'],
};
const TRACK_AUDIENCE = { regulatory: 'both', legal_ai: 'gc', frontier_model: 'founders', ai_trend: 'both' };

/** Best guess at who the item is for — a default the founder can change. */
export function guessAudience(item, track) {
  const text = `${item.title} ${item.summary}`;
  const gc = AUDIENCE_TERMS.gc.some((t) => matchesTerm(text, t));
  const fo = AUDIENCE_TERMS.founders.some((t) => matchesTerm(text, t));
  if (gc && fo) return 'both';
  if (gc) return 'gc';
  if (fo) return 'founders';
  return TRACK_AUDIENCE[track] || 'both';
}

/**
 * Normalize one feed's raw items: drop junk, cap count, score, filter.
 * `feed.filter: true` drops items with no keyword match (for broad sources).
 */
export function normalizeItems(rawItems, feed, config, now = Date.now()) {
  const maxAgeMs = (config.windowDays ?? 30) * 864e5;
  const out = [];
  const sorted = [...rawItems].sort((a, b) => (b.published || '').localeCompare(a.published || ''));
  for (const r of sorted) {
    if (!r.title || !/^https?:\/\//i.test(r.link || '')) continue;
    if (r.published && now - Date.parse(r.published) > maxAgeMs) continue;
    if (r.published && Date.parse(r.published) - now > 2 * 864e5) r.published = null; // future-dated noise
    const { score, matched, keywordScore } = scoreItem(r, feed, config, now);
    if (feed.filter && keywordScore === 0) continue;
    const link = canonicalLink(r.link);
    const origin = r.origin && r.origin !== feed.label ? r.origin : '';
    // Aggregators append " - Publisher" to headlines; the publisher is shown separately.
    const title = origin && r.title.endsWith(` - ${origin}`) ? r.title.slice(0, -(origin.length + 3)) : r.title;
    const summary = origin && (r.summary || '').endsWith(origin) ? r.summary.slice(0, -origin.length).trim() : r.summary || '';
    out.push({
      id: hashId(link),
      title: truncate(title, 220),
      link: r.link,
      canonical: link,
      source: feed.label,
      origin,
      feedId: feed.id,
      track: feed.track,
      published: r.published,
      summary: truncate(summary, 320),
      matched,
      score,
      audience: guessAudience(r, feed.track),
    });
    if (out.length >= (feed.max ?? config.maxPerFeed ?? 25)) break;
  }
  return out;
}

/** Collapse the same story across feeds (same link, or same headline). */
export function dedupe(items) {
  const byKey = new Map();
  const result = [];
  for (const it of [...items].sort((a, b) => b.score - a.score)) {
    const keys = [it.canonical, `t:${titleKey(it.title, it.origin)}`];
    const hit = keys.map((k) => byKey.get(k)).find(Boolean);
    if (hit) {
      if (it.source !== hit.source && !hit.alsoIn.includes(it.source)) hit.alsoIn.push(it.source);
      for (const m of it.matched) if (!hit.matched.includes(m)) hit.matched.push(m);
      continue;
    }
    const kept = { ...it, alsoIn: it.alsoIn ? [...it.alsoIn] : [] };
    for (const k of keys) byKey.set(k, kept);
    result.push(kept);
  }
  return result;
}

/**
 * Merge this run's items with the previous snapshot:
 *  - keep first-seen dates (so "new" means new to you, not re-published)
 *  - carry forward items from feeds that failed this run, within the window
 *  - drop anything older than the window
 */
export function mergeWithPrevious(current, previous, { okFeedIds, now = Date.now(), windowDays = 30, maxItems = 300 } = {}) {
  const prev = new Map((previous?.items || []).map((i) => [i.id, i]));
  const nowISO = new Date(now).toISOString();
  const cutoff = now - windowDays * 864e5;
  const seen = new Set();
  const merged = [];
  for (const it of current) {
    const old = prev.get(it.id);
    merged.push({ ...it, firstSeen: old?.firstSeen || nowISO });
    seen.add(it.id);
  }
  for (const old of prev.values()) {
    if (seen.has(old.id)) continue;
    // A healthy feed that no longer lists an item has rotated it out; keep it
    // anyway until it ages past the window, so triage never loses its target.
    const t = Date.parse(old.published || old.firstSeen || 0);
    if (!Number.isFinite(t) || t < cutoff) continue;
    merged.push({ ...old, stale: okFeedIds ? !okFeedIds.has(old.feedId) : false });
  }
  return dedupe(merged)
    .sort((a, b) => (b.published || b.firstSeen || '').localeCompare(a.published || a.firstSeen || ''))
    .slice(0, maxItems);
}

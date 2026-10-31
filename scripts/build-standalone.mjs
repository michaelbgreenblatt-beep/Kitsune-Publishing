/**
 * Build a single-file, zero-server standalone of Kitsune Content Studio.
 *
 *   node scripts/build-standalone.mjs   → dist/content-studio-standalone.html
 *
 * Inlines styles.css and app.js into one CSP-safe HTML document — no external
 * requests, no dynamic imports. Content Studio is self-contained; its state
 * persists in the browser's localStorage, so the single file is the whole app.
 * Theme tokens are duplicated as [data-theme] overrides so a host toggle beats
 * the OS preference either way.
 *
 * If public/feed.json exists, it's embedded as the Radar inbox's built-in
 * snapshot (window.__KITSUNE_FEED__), since a hosted single file can't fetch it.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = join(import.meta.dirname, '..');
const out = join(root, 'dist', 'content-studio-standalone.html');

const css = readFileSync(join(root, 'public', 'styles.css'), 'utf8');
const appJs = readFileSync(join(root, 'public', 'app.js'), 'utf8');
const html = readFileSync(join(root, 'public', 'index.html'), 'utf8');
const feedPath = join(root, 'public', 'feed.json');
const feed = existsSync(feedPath) ? JSON.parse(readFileSync(feedPath, 'utf8')) : null;
// Safe inside <script>: no "</script>" or "<!--" can survive escaping "<".
const feedJs = feed ? `window.__KITSUNE_FEED__ = ${JSON.stringify(feed).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')};` : '';

const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? 'Kitsune Content Studio';
const inlineStyle = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
const body = html.match(/<body>([\s\S]*?)<script/)?.[1];
if (!body) throw new Error('Could not extract <body> from index.html');

const lightTokens = css.match(/^:root \{([\s\S]*?)\n\}/m)?.[1];
const darkTokens = css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\n {2}\}/m)?.[1];
if (!lightTokens || !darkTokens) throw new Error('Could not extract theme token blocks from styles.css');
const themeCss = `\n:root[data-theme="light"] {${lightTokens}\n}\n:root[data-theme="dark"] {${darkTokens}\n}\n`;

const doc = `<title>${title}</title>
<style>
${css}
${themeCss}
${inlineStyle}
</style>
${body}
${feedJs ? `<script>\n${feedJs}\n</script>` : ''}
<script type="module">
${appJs}
</script>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, doc);
console.log(`Wrote dist/content-studio-standalone.html (${Math.round(doc.length / 1024)}kb${feed ? `, feed snapshot ${feed.generatedAt} · ${feed.items.length} items` : ', no feed snapshot'})`);

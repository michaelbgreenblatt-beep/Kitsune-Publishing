# Kitsune Content Studio

A real, browser-persistent tool for planning, review-gating, publishing, and
tracking Kitsune Law's marketing content across platforms. It is **not** part of
the Mnemos product — it's the firm's client-acquisition tool, and it lives in its
own repository (moved out of the Mnemos repo, vault DEC-013).

It's a real tool the founder actually uses, not a demo: it starts empty and
persists what you create to the browser's `localStorage`, surviving reloads and
updates. No fake samples, no invented reviewers.

## Run it

```bash
npm start          # serves public/ at http://localhost:4871
npm run feeds      # refresh the Radar inbox from the live feeds (needs internet)
npm test           # feed parser / scoring / merge tests (no dependencies)
```

Or just open `public/index.html` in a browser — there's no backend and no build
step for development. State lives in your browser.

## Build a standalone

```bash
npm run build      # → dist/content-studio-standalone.html
```

The build inlines the styles and app into one CSP-safe HTML file with no external
requests, suitable for hosting as a private Claude Artifact or any static host.
`localStorage` state survives a republish, so your work carries over.

## What's inside

- **Pipeline** — draft evergreen **guides** (SEO / client acquisition) or
  **commentary** (timely takes on AI-law developments). A review gate holds
  publication until a named reviewer of record signs off.
- **Radar** — developments to comment on across four tracks: Law & regulation,
  Legal AI & the market, Frontier models & capabilities, and AI trends & adoption.
  An **Incoming** inbox fills daily from real news feeds; triage each item —
  *Watch* it, *Draft commentary* straight from it (source cited at the top of the
  draft), or *Dismiss* it. Below it, the watchlist and a curated reading list.
- **Strategy** — the multi-platform playbook: what goes where (firm site /
  Substack / LinkedIn / X / other) by content type and audience.
- **Calendar** — the publishing cadence at a glance; pieces plot on their publish
  date or target date, with cadence tiles.
- **Library** — only what you actually publish, with the live links.

## The Radar feed

`scripts/fetch-feeds.mjs` reads the feeds in **`feeds.config.json`** (Federal
Register, Google News topic searches, Artificial Lawyer, LawSites, OpenAI,
DeepMind, Import AI, Hugging Face, One Useful Thing, Stratechery, Simon Willison),
parses RSS/Atom, keeps the last 30 days, scores each item by the keywords it
matches, collapses the same story across feeds, and writes **`public/feed.json`**.

- **Daily, automatically** — `.github/workflows/feeds.yml` runs every morning,
  commits the refreshed snapshot, and attaches a freshly built standalone (with
  that day's snapshot embedded) to the run. Trigger it by hand from the Actions
  tab → *Refresh Radar feeds* → *Run workflow*.
- **Self-updating hosted copy (optional)** — enable GitHub Pages (Settings →
  Pages → Source: *GitHub Actions*) and add the repository variable
  `DEPLOY_PAGES=true`. The app is then published on every refresh and reads the
  live feed. Your work stays in your browser either way.
- **Where the app gets the feed** — the newest of: the live `feed.json` next to
  the page (dev server, Pages), the snapshot embedded at build time (standalone
  or artifact), or a file loaded in **Settings → Radar feed**.
- **Edit the sources** — add, remove, or retarget feeds in `feeds.config.json`.
  `filter: true` drops items with no keyword match (for broad sources). Each run
  records per-feed health, shown under *Source health* in the inbox, so a dead
  URL is visible instead of silent.
- **Failure-safe** — a failing feed keeps its earlier items (marked "from an
  earlier refresh"); if *no* feed can be read, the snapshot is left untouched.

Relevance is explainable, not asserted: each item shows the keywords that
surfaced it. Nothing is summarized or rewritten — the headline, excerpt and link
are the source's own.

## Ground rules

This tool must never present invented published work, invented people, or invented
specific legal developments as real. Scaffolds and category watchlists are clearly
templates you fill. Inbox items come only from real feeds and keep their source
links; the synthetic feeds in `test/fixtures/` are `[TEST]`-labelled, point at
`example.com`, and the fetcher refuses to write them to `public/feed.json`. The review gate's reviewer of record is whoever you name in
Settings — never a placeholder.

## Layout

```
public/
  index.html     app shell + nav + indigo accent override
  app.js         the whole SPA (routing, store, localStorage, views, Radar inbox)
  styles.css     the ink-and-paper design system
  feed.json      Radar snapshot — written by the daily job, not by hand
scripts/
  serve.mjs              zero-dep static dev server
  fetch-feeds.mjs        fetch → parse → score → dedupe → merge → public/feed.json
  lib/feeds.mjs          the pure feed functions (tested)
  build-standalone.mjs   inlines everything (plus the feed snapshot) into dist/
feeds.config.json        which feeds, which tracks, which keywords
test/                    node:test suite + synthetic [TEST] fixtures
.github/workflows/feeds.yml   the daily refresh
```

## Backups

`localStorage` is per-browser and per-device (no sync). Use **Settings → Export
backup / Import backup** to back up your work or move it between machines (a
Pages-hosted copy and the artifact are different browsers' worth of storage, too).
Your inbox triage decisions are part of the backup.

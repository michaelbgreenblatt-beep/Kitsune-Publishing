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
  Log a real development (with its source) and spin up a track-tuned commentary.
  Includes a curated "where to watch" reading list of real outlets.
- **Strategy** — the multi-platform playbook: what goes where (firm site /
  Substack / LinkedIn / X / other) by content type and audience.
- **Calendar** — the publishing cadence at a glance; pieces plot on their publish
  date or target date, with cadence tiles.
- **Library** — only what you actually publish, with the live links.

## Ground rules

This tool must never present invented published work, invented people, or invented
specific legal developments as real. Scaffolds and category watchlists are clearly
templates you fill. The review gate's reviewer of record is whoever you name in
Settings — never a placeholder.

## Layout

```
public/
  index.html     app shell + nav + indigo accent override
  app.js         the whole SPA (routing, store, localStorage, views)
  styles.css     the ink-and-paper design system
scripts/
  serve.mjs      zero-dep static dev server
  build-standalone.mjs   inlines everything into dist/content-studio-standalone.html
```

## Backups

`localStorage` is per-browser and per-device (no sync). Use the JSON export/import
in **Settings** to back up your work or move it between machines.

# Primetime cards: handoff

For the next model working on the CHML 5D Fantasy site (repo `michaelbgreenblatt-beep/chml-history`, live at https://chml-history.netlify.app, the Primetime tab at https://chml-history.netlify.app/fived.html#/primetime). Written 26 September 2026 by the previous session, which did not deliver what MG asked for. Everything MG said is quoted verbatim so nothing is lost in the retelling.

## 1. What MG asked for, in his words

24 September 2026 (the original feature):

> a starter who clears a threshold on a primetime night "unlocks an NFT style animation of the player in question that dances on your screen and is then stored in a glass case with his performance stats from the primetime game under the manager page where his achievements live"

> "each primetime game should get its own special feature in some way because thats when the most eyeballs will be trained on 5D at one time"

25 September 2026:

> "The primetime cards should be way cooler and more awe inducing than they are. They should be designed with the inspiration from premium topps trading cards with unique premium features like shimmering that display an action photo of the player from the exact game they earned a primetime card in"

26 September 2026, after opening the first cards on his iPhone:

> "These cards are awful"

> "These are references. Don't be making cheap anime versions. The real player two"

> "You didn't listen to me on the cards whatsoever. I'll have another model try"

Read that as: the card must look like a real premium trading card, built around a real photograph of the real player from the game he earned it in, with a genuine holographic shimmer. Not illustrated art, not a headshot under a rainbow tint, not a CSS approximation that reads as cheap.

## 2. The two references MG sent

Both are in `docs/` in the repo, next to this file.

1. `docs/cards-reference-topps-jordan-love.png`: Topps "Pressure Cookers" refractor of Jordan Love. A full rainbow holographic ground, radial speed lines exploding out from behind the player, the real action photo cut out from its background, the team logo large at the top left, the set name running vertically down the right edge, the player's name at the bottom left in two lines, the Topps mark at the right.
2. `docs/cards-reference-prizm-jayden-daniels.png`: Panini Prizm "Lazer" of Jayden Daniels, graded in a PSA slab. An orange lazer foil pattern over the whole card, the real photo cut out, a team-name band and a white name plate along the bottom, the team logo at the bottom right, a rookie badge at the top right, a thin dark inner frame.

What the two share: a real cut-out photograph, a foil pattern that covers the whole card and catches light, big confident typography, the team's identity, and nothing decorative that is not a real card element.

## 3. What exists now, and where

Front end (all plain browser scripts, React UMD, no build step apart from Tailwind):

- `chml-history/fived-cards.js`: the whole feature. `Card({ card, live })` renders one card; `Unlock()` shows a fresh card once per browser (the "dance"); `PrimetimeCase({ owner })` is the glass case on a manager's page; `PrimetimeRoom()` is the Primetime tab (tonight's game, who has whom, the cards). Also the tilt (pointer on desk, `deviceorientation` on phones, iOS asks permission on the first tap), the team colour table `NFL` and `nflLogo()`, and card trading (offer, accept, decline, cancel), which needs sign-in.
- `chml-history/fived.html`: the card stylesheet is the `.pt-*` block inside the page's `<style>`. Everything visual is there. `style.css` is Tailwind output for utility classes; rebuild it with `npm run css` from `chml-history/` whenever a script's class names change.
- `chml-history/fived-pages.js`: the manager page mounts `PrimetimeCase`. `chml-history/fived-app.js`: the `primetime` route and the `Unlock` overlay.

Server (Netlify functions, ES modules):

- `chml-history/netlify/functions/primetime-cards.mjs`: scheduled `*/5 23,0-6 * * *` UTC. Reads ESPN's scoreboard, works out the primetime slot, sends the twenty-minute warning, and after the game reads ESPN's game summary and cuts a card for every CHML starter who cleared a threshold. Writes to the `cards` blob store, key `card:<year>:<week>:<rosterId>:<playerId>`, then pushes the owner's phone.
- `chml-history/netlify/functions/cards.mjs`: `GET /api/cards` (all, `?rosterId=`, `?week=`), `GET /api/cards/offers`, and the trade endpoints. On GET it now also fetches a missing action shot for one game per request (`backfillPhotos`).
- `chml-history/netlify/lib/primetime.mjs`: `slotOf`, `unlock` (the thresholds and tiers), `statLine`, `athletesIn`, `lineFor`, `cardKey`, `headshot(espnId)`, `SUMMARY`, and `actionShot(summary, name)`, which looks through the summary's `videos` for a clip whose headline or description names the player and returns its poster image.
- `chml-history/netlify/lib/owner-push.mjs`: `pushOwner` for the phone alerts. `netlify/lib/account-token.mjs`: sign-in tokens (do not touch).

A card record looks like this:

```json
{ "key": "card:2026:3:10:4426502", "year": 2026, "week": 3, "rosterId": 10, "manager": "ddisa10", "team": "Nigba-Jack",
  "playerId": "4426502", "player": "Drake London", "position": "WR", "nflTeam": "ATL",
  "headshot": "https://a.espncdn.com/i/headshots/nfl/players/full/4426502.png",
  "photo": null, "photoCaption": null, "photoTriedAt": null, "serial": 1,
  "game": "ATL @ GB", "gameId": "401872948", "slot": "Thursday night", "kickoff": "2026-09-25T00:15Z",
  "tier": "bronze", "night": false, "met": ["194 yards from scrimmage"], "stats": "9 rec, 194 yds",
  "points": 41.4, "at": "2026-09-25T04:00:00Z", "traded": [] }
```

Tiers: bronze, silver, gold, from how many thresholds the line cleared (see `unlock`). `night` marks the card of the night. `serial` is the order the season's cards were cut. `playerId` is ESPN's athlete id, so `headshot` is ESPN's transparent PNG cut-out of the head and shoulders.

Images available today, all public and hot-linkable:

- ESPN headshots: `https://a.espncdn.com/i/headshots/nfl/players/full/<espnId>.png` (transparent background).
- ESPN team logos: `https://a.espncdn.com/i/teamlogos/nfl/500/<abbr>.png` (lower-case abbreviation, Washington is `wsh`).
- ESPN game summary: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=<gameId>`. Its `videos` array carries highlight clips with `headline`, `description`, `thumbnail` and `posterImages`. These are broadcast frames, 16:9, not cut-outs, and a clip naming the player is not guaranteed for every card.

## 4. What the previous session built, and why it fell short

Two rounds. The first shipped on the morning of 26 September and looked broken on MG's iPhone: the back of the card bled through the front, mirrored, and no photograph drew at all. Causes, confirmed in a real WebKit: a CSS `filter` on the card flattened the 3D flip stage so `backface-visibility` did nothing, and the art was a background image behind a custom property that the iPhone never painted.

The second round (commits `ee1972a` and `4035f20` on branch `live-work`) fixed both, moved the art to `<img>` elements, and restyled the card: brushed-metal frame in the tier's colour, a burst in the team's colours, a rainbow that turns with the tilt, radial speed lines, the team crest at the top left, PRIMETIME down the right edge, a two-line name, a serial, a foil band and glare that follow the pointer or the phone's tilt, a prism on gold and the card of the night, and a cross-fade flip to a back with the stat line. It renders correctly on WebKit now. It is still not what MG asked for:

- The photo is a headshot, because ESPN's clips had not been matched for the live cards. Even when a clip is matched, its poster is a full broadcast frame, not the player cut out from the background as on both references.
- The shimmer is CSS gradients and blend modes. It reads as tinted, not as foil.
- The overall composition is a website card, not a trading card. The references are what the bar looks like.

## 5. Constraints that will bite you

- **Test in WebKit before deploying.** This workspace has no WebKit and cannot reach the live site or ESPN (the environment's network policy denies `*.netlify.app`, `site.api.espn.com` and `a.espncdn.com`). GitHub's runners and Netlify's functions reach all of them. Push the branch to `refs/heads/card-check/run` and `.github/workflows/card-check.yml` shoots the cards in WebKit (iPhone 14) and Chromium against `chml-tests/fixtures/cards.json`, fetching ESPN's real headshots and the real action shot in the runner; the shots and a `report.json` land on branch `card-check/<run id>` in about four minutes. Locally, `OFFLINE_ART=1 REACT_UMD_DIR=<dir with react umd copies> PLAYWRIGHT_MODULE=<playwright index.mjs> SITE=http://localhost:8765 node chml-tools/card-check.mjs <out>` works in Chromium against `python3 -m http.server 8765` run inside `chml-history/`.
- **The render audit.** `npm run -s audit` from the repo root renders every route and refuses inline colour literals in `style` props (custom properties such as `--nfl: '#A71930'` are allowed, and `var(...)` values), off-palette Tailwind colour classes (`bg-[#hex]`, `text-rose-400`), type under 10px in arbitrary classes, and `<img>` without `alt`. Put colour in the stylesheet or in custom properties.
- **Tests.** `node --test chml-tests/*.test.cjs` from the repo root, 121 tests. The primetime ones are in `chml-tests/fived.test.cjs` (search "primetime" and "card"). The harness renders pages in a sandbox with no network.
- **Deploy.** Commit on `live-work`, push `HEAD:live-work HEAD:site` (check `git ls-remote origin site` is the commit you expect first: MG's laptop must never be overwritten and neither must the site branch), then dispatch `deploy.yml` on ref `site` (GitHub Actions; the deploy is dispatch-only and has a guard). The permalink and deploy id are in the job log. A watchdog Routine in MG's Claude account checks every three hours that the live deploy is the protected one; if you deploy, tell MG the new deploy id so the watchdog prompt can be updated, or update it if you have the tool.
- **Security.** Card trading is gated on the account token; keep it that way. Never store or echo the commissioner passcode or any token.
- **Do not use the site's illustrated player art** (`chml-history/animations/illustrated-v4`, `celebrations-v5`) on the cards. MG: "Don't be making cheap anime versions."

## 6. A route that would actually meet the brief

The gap is the photograph and the foil, and neither is a CSS problem.

1. **Generate the card art once, server side, per card.** When a card is cut (or on the first GET after the game), take the best ESPN still for that player from the game (`actionShot`; fall back to the headshot), cut the player out of the background (a background-removal service or model; `rembg`-class models run fine in a GitHub Action, and the Adobe MCP tools available to some sessions include `image_remove_background`), and compose the card at 2x (roughly 750 x 1050) with a real foil texture: a pre-rendered holographic pattern image, radial speed lines, the team logo, the vertical set name, the name plate, the tier frame, the serial. Store the PNG or WebP under `chml-history/cards/<key>.webp` by committing from an Action, or in the `cards` blob store served through a function. The front end then shows an image, which every phone draws identically.
2. **Put the shimmer on top of that image in the browser**, keyed to the pointer or the phone's tilt: a light band and a glare are enough once the underlying art is real foil. A small WebGL or canvas shader (the "holo card" technique, a normal map or a sine pattern lit by the pointer angle) beats blend modes on phones and is a few kilobytes.
3. **Keep the data model, the trading, the unlock, and the case** as they are. They work.
4. **Verify in WebKit** with the card check before pushing to `site`, then run the live check (`refs/heads/live-check/run`; results on `live-check/<run id>`, including `webkit-iphone-scenario-primetime.png`).

Acceptance, in MG's terms: open the Primetime tab on an iPhone and see cards that look like the two references, with the real player from the real game, shimmering as the phone tips, and nothing broken.

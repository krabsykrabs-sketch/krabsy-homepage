# Krabsy — status dashboard

Living overview of every game and the project. Master session updates this
at the end of each session. (Last update: 2026-11-21.)

## Games

| Game | Type | Source | Served at | Status |
|------|------|--------|-----------|--------|
| Verb Slash | single-file canvas | `games/verb-slash/` (+ inlined wrapper) | `/de/spiele/verb-slash/` | **live** |
| Crab Slash | single-file canvas | `games/crab-slash/` (+ inlined wrapper) | — (wrappers kept, noindex) | **OFFLINE since 2026-11-21, parked** — play-test: core rule broken (other verbs' correct forms count as wrong); redesign notes in `games/crab-slash/CLAUDE.md` |
| Verb Snake | single-file canvas | `homepage/krabsy-verb-snake.html` (iframed) | `/de/spiele/verb-snake/` | **LIVE** (v3) — engine-refactored 2026-06-12: 148-verb pool, dotted no-terminology tracker. 2026-11-16: DE/ES UI, New Best badge fix |
| Air Control | single-file canvas | `homepage/krabsy-air-control.html` | `/de/spiele/air-control/` | **live** (beta) — 2026-11-16: DE/ES UI, legend no longer uses grammar terms. 2026-11-21 (**deployed**, live file verified): no ①②③ answer tell (planes all white, word only; panel shows go → ___ → ___), phone-legible labels/bubbles/hints, safer spawn lanes on phones, level-complete screen auto-continues after 8 s, same-word forms (run/ran/run) take the earlier slot. Still to check on a real phone |
| Verb Platformer | 3D (Three.js) | `games/verb-platformer/` | — (wrappers kept, noindex) | **OFFLINE since 2026-11-12, to be continued** — owner 2026-11-21: mechanics and feel are good, it lacks real levels → next is level design (editor in the game folder). Plan, bug list and how to bring it back in `games/verb-platformer/CLAUDE.md` |
| Verb Flow | single-file canvas | `homepage/krabsy-verb-flow.html` (iframed) | `/de/spiele/verb-flow/` | **RELEASED 2026-06-12** (beta) — engine-refactored same day: 154-verb pool. 2026-11-16: thumbnail added, first-run interactive tutorial (+ "How to play" replay), fixed always-visible PERFECT badge / Restart button. DE/ES UI |
| Tower Defense | 3D (Three.js) | `games/tower-defense/` | — | **in development** — owner chose it 2026-11-21 as the next Verb-Kitchen-quality game; brief in its `CLAUDE.md`; own session opens in `games/tower-defense/` |
| Verb Dungeon | 3D dungeon crawler (PoC is primitives only; KayKit models planned) | `games/verb-dungeon/` | — | **GO (owner 2026-11-21): build the full game** — PoC built 2026-06; new brief in its `CLAUDE.md` (fixed room camera, KayKit models, short levels, touch, DE/ES); own session opens in `games/verb-dungeon/` |
| Verb Climb | 2D tower-climb platformer | `games/verb-climb/` | — | **PARKED (owner 2026-11-21, 2D)** — PoC built, many playtest iterations (Trackmania-style levels/medals) |
| Verb Valley | 3D farming life-sim (Stardew-like) | `games/verb-valley/` | — | **GO (owner 2026-11-21): build the full game** — PoC built 2026-06 (3 playtest rounds, KayKit rebuild); new brief in its `CLAUDE.md` (spread grammar through the day, touch, DE/ES; `assets/` must be restored first); own session opens in `games/verb-valley/` |
| Verb Runway | 2D paper-doll dress-up (DTI-like) | `games/verb-runway/` | — | **PARKED (owner 2026-11-21, 2D)** — PoC built; art contact sheet never judged |
| Sim Tower / Krabsy Block | 3D city-block sim (KayKit) | `games/sim-tower/` (+ `archive-tower-version/`) | — | **PARKED (2026-11-21)** — cozy tycoon: you own a city block, build shops and homes, residents walk around; quiz bolted on. Merged from the old `sim-tower` branch 2026-11-21; last worked on 2026-07/08; concept in `krabsy-block-concept.md`. Models (16 MB) are gitignored in `games/sim-tower/assets/` |
| Verb Kitchen | 3D Overcooked-like (KayKit Restaurant Bits) | `games/verb-kitchen/` | `/de/spiele/verb-kitchen/` (build at `/games/verb-kitchen/`) | **RELEASED** — ⚠ source is AHEAD of the live build since the 2026-11-21 merge: Levels 4–7 (co-op, soup, sundae), DE/ES UI (`src/i18n.js`), spaced repetition + Verb Cookbook (Jun 16–Jul 2) were never released → play-test + release next. — in the catalogue since 2026-06-16 (`games.json` status `beta`); confirmed released by the user 2026-11-12 after the first organic classroom use (Uruguay, Plan Ceibal/Schoology, 2026-11-12: ~10–12 concurrent sessions, 7–12 min each) |

**Arcade-game language (2026-11-16):** Verb Flow, Verb Snake and Air Control
show their UI in DE/ES (`?lang=` → `krabsy_lang` → DE fallback, same as the
drills); the verbs and go → went → gone notation stay English.

**Repo cleanup 2026-11-21:** the `sim-tower` branch (diverged 2026-06-16) was
merged into `main`. It brought Verb Kitchen L4–7/i18n, the World Designer level
editor (`tools/world-designer/`, see its README) and Sim Tower. All helper
worktrees were removed; from now on there is one checkout on `main` (see
`CLAUDE.md` → Session model).

**Game direction (owner, 2026-11-21):** more 3D games in the Verb Kitchen
style (self-paced question moment, grammar drives progress, fixed camera,
short levels with stars). Order: Verb Kitchen L4–7 release → Tower Defense
→ Verb Dungeon and Verb Valley (full builds, one chat each) → Verb
Platformer level design. The 2D PoCs and Krabsy Block are parked.
New ideas the owner liked, not started, no folder yet:
- **Verb Delivery:** drive a van around a small town from above and
  deliver parcels; the petrol station is the "sink" (refuel = questions).
  Kenney city/car kits.
- **Verb Forge:** a workshop on the Verb Kitchen engine (smelt, hammer,
  hand weapons to adventurers). Fastest to build, least new.
- **Preposition room** (owner has not commented): furnish a room from
  English instructions ("Put the lamp ON the table"); needs new
  place-preposition content.

**Play-test 2026-11-21** (`docs/playtest-2026-11-21.md`):
- Crab Slash → **hidden 2026-11-21**.
- Drag Match and Falling Forms → small layout fix (start button below the
  fold, ✕ leaves the site).
- Verb Slash → fix the colour tell and slow start.
- Air Control → small fixes — **done and deployed 2026-11-21**.
- Verb Flow → keep.
- Owner decisions pending.

## Landing pages /de/ and /es/ (games-first, 2026-11-21)

Rebuilt like a game portal: one headline line, a big featured game, then
the full game grid with filter chips (Alle / 3D / Arcade; topic chips
appear on their own once a second topic has a live game), then "Üben ohne
Spiel", a teacher strip, and one merged SEO text block at the bottom.
Header has a "Für Lehrkräfte" / "Para docentes" link. Mockup + two
reviews (Fable 5.2) in `_incoming/landing-mockup-2026-11-21/` (not served).
**Deployed 2026-11-21** (live /de/ and /es/ checked by screenshot; IndexNow sent for both landing pages, games hubs, topic hubs and Sprint, HTTP 200).

- Driven by `games.json` fields: `kind` (3d/arcade), `devices`
  (phone_ok/large_screen), `featured` (one game), `new_until` (NEU badge
  expires by date), `thumb_small` (640×360 JPG), `hero` (1200×675 JPG).
  Small images live in `homepage/thumbnails/sm/` and `thumbnails/hero/`
  (page images ~0.36 MB instead of ~9 MB).
- Tiles + featured block are static HTML from
  `tools/render_static_games.py`; `lib/krabsy-landing.js` only filters,
  expires NEU and fills the progress row (krabsy-stats).
- **Coming-soon entries** `verb-towers` and `verb-dungeon` are in
  `games.json` (status `coming_soon`, dev screenshots as thumbnails). They
  show as "Bald" tiles on the landing pages, games hubs and topic hubs; the
  footer and the in-game chip bar skip them (`krabsy-nav.js` fixed, import
  bumped to `?v=2026-11-21`). On release: replace the screenshot with real
  art, set status, add wrappers/sitemap/JSON-LD as usual; to feature it,
  move `featured` + add a `hero` image.
- To check: device badges for Verb Flow (Handy ✓) and Air Control (Großer
  Bildschirm) were never tested on a real phone.

## Classroom feature (concept, 2026-11-21)

Owner agreed on four phases plus a "smart mix" of questions; full concept in
`docs/classroom-concept.md`. Next: **phase 1** — every game records answers
(`recordAttempt`) and the question engine gets `getSmartSet()` (practice
words / new words / spaced repeats). Open owner decisions listed at the end
of the concept (EU hosting, phase-2 without email, retention, legal review).

## Speed drills (irregular-verbs / prepositions topic tools)

`type-race`, `fill-the-gap`, `drag-match`, `falling-forms-chain` — live,
served from `homepage/games/*.html`. (`falling-forms-tower.html` present
but not referenced — verify before removing.)

**Chain order (owner decision 2026-11-21, see root `CLAUDE.md`):** 3rd
form only right after the 2nd, with the 2nd filled in. Done in the
question engine `homepage/lib/krabsy-questions.js` (`getQuizSet`
`chainOrder`, default on; tested on all 344 verb questions) and in
Tower Defense and Verb Dungeon, and for the drills in `krabsy-data.js`
`getQuestions` (opt-in `chainOrder`), used by **Sprint DE + ES**: 20
questions = 10 pairs, 2nd form shown in its slot; import bumped to
`krabsy-data.js?v=2026-11-21`. Checked by script in headless Edge (both
languages, full run). Free practice already asks both forms in order;
flashcards and Air Control ask no single form. **Deployed 2026-11-21**: Sprint live loads `krabsy-data.js?v=2026-11-21`; IndexNow sent for both Sprint URLs.

## Content catalogue

- `content/irregular-verbs.json` — 172 verbs (canonical; +17 on 2026-11-12). Page-only content (translations, mistakes, notes) in `content/irregular-verbs-pages.json`
- `content/prepositions.json` — 99 items (canonical)
- Served copies live in `homepage/data/`; sync on edit.

- **2026-06-12: 310 programmatic verb pages + A-Z indexes LIVE** (DE/ES,
  generated by tools/generate_verb_pages.py from content/irregular-verbs.json).
  Sitemap 50 -> 362 URLs; all pinged via IndexNow. Rerun the generator
  whenever the verb catalogue changes, then deploy + re-ping.

- **2026-06-12: Question engine SHIPPED (committed, not yet deployed).**
  homepage/lib/krabsy-questions.js = game-facing question source (chain +
  quiz shapes, ?topic= support, typed-input validation). Verb Flow and
  Verb Snake refactored onto it (154/148-verb pools vs old inline lists,
  graceful fallback for file:// and unsupported topics). Presentation
  mandate recorded in CLAUDE.md + all five game briefs: positional
  notation (go -> ___ -> ___), never grammar terminology. Snake tracker
  + coaching converted to dotted blanks.

## SEO / growth (2026-11-12)

- **SEO overhaul LIVE (pushed + deployed 2026-11-12; IndexNow: all 402 sitemap URLs, HTTP 200)** — see WORK_LOG
  2026-11-12. Baseline: Google 83 indexed / 286 crawled-not-indexed, ~0
  Google impressions; Bing 30k impr/quarter; Copilot ~120 citations/day.
- **Server redirects LIVE (2026-11-12, verified with curl + browser):** Traefik
  dynamic file `krabsy-redirects.yaml` (http/www → 301) and the custom nginx
  config (`docs/nginx-krabsy.conf`; rollback: `docs/nginx-krabsy.previous.conf`).
  Note: Coolify shows "configuration changed, please restart the proxy" from an
  earlier, unrelated change — restart only at a quiet moment.
- **GSC:** sitemap resubmitted, validation started 2026-11-12. Privacy/country (2026-11-17):
  ip-api.com OFF; country now comes from the browser time zone (`api/tz.py`,
  `country_source: "timezone"`, the zone itself is not stored). MaxMind is optional
  (`api/DEPLOY.md` §5b), not configured.
  Google Fonts already self-hosted.
- **Google-only noindex experiment** on tier-3 verb pages — evaluate mid/late
  Dec 2026 with fresh GSC coverage + performance exports.
- **Backlinks/outreach:** Deutscher Bildungsserver — submitted 2026-11-16, **LIVE** same day
  (https://www.bildungsserver.de/onlineressource.html?onlineressourcen_id=67514 — 3 followed links to krabsy.com)
  First effect (export 2026-11-21): ~8 German visitors via bildungsserver.de on Nov 17–19
  (one 9 min / 9 pages through the drills), then quiet. Timezone country works (since 11-17).
  Domain history: krabsy.com was a German land-hermit-crab shop (`/1/…` WordPress URLs,
  2016–17, later Shopify) — old `/1/` URLs 404; ignore them in GSC/Bing 404 reports.
  (URL https://krabsy.com/de/, Sek I, Zusatzinfo /de/lehrkraefte/); manual review,
  takes weeks. Further portals: `docs/outreach-list.md` (in progress).
- **Teachers are the channel**: first organic class (UY, Ceibal Schoology,
  Verb Kitchen). Next: teacher page links in footer/nav, education-portal
  backlinks (Deutscher Bildungsserver, teacher directories, ES equivalents).
- Open bugs for game sessions — written into each game's `CLAUDE.md`
  (2026-11-12): Verb Platformer (offline; texture 404, touch crash, no phone
  controls, CDN libs), Verb Slash (FIXED 2026-11-16: single loop, fixed 120 steps/s, debug label removed), Verb
  Kitchen/Flow/Platformer sources need the `noindex, indexifembedded` meta;
  Verb/Crab Slash wrappers: don't overwrite the SEO section when re-inlining.

## Next steps / open items

### Handover 2026-11-21: start here (new master chat in `krabsy-homepage`)

1. ~~Deploy pending~~ **Done 2026-11-21:** Crab Slash hidden + Impressum DDG/MStV are live; IndexNow sent (15 URLs).
2. **Verb Kitchen release:** the source (L4–7, DE/ES, spaced repetition)
   is ahead of the live build. Play-test done
   (`docs/playtest-verb-kitchen-2026-11-21.md`): **release after small
   fixes.** All 7 levels play on tablet touch in DE and ES, with 0
   errors. Blockers are packaging:
   - B1: the wrapper doesn't pass `?lang=`.
   - B2: the source `index.html` lacks noindex and self-hosted fonts.
   - B3: 35 KayKit models are missing from the build's `assets/`.
   - B4: the L7 recipe text contradicts the game.
   - B5: deploy the new code under `src-2/` (no cache headers).
   Then update the wrapper/info texts ("drei Restaurants", "auf Englisch").
   Owner decisions: open L4–7 from the start? Ship L7 or fix it?
3. **Small game fixes from the play-test** (`docs/playtest-2026-11-21.md`),
   not started, owner OK pending:
   - Drill page layout (Drag Match, Falling Forms): game above the intro,
     iframe sized to the viewport, remove the ✕ (`history.back()`), a
     phone fallback link; Falling Forms shows the correct answer after a
     mistake.
   - Verb Slash: randomise ball colours (`fruit-correct` tell), faster
     first balloon, tap counts, show the answer after a mistake, DE/ES UI.
     Also in `games/verb-slash/CLAUDE.md`.
   - Air Control: ✅ done 2026-11-21 (①②③ tell dropped, phone label
     size), deployed and verified live — open: a check on a real phone.
4. **Tower Defense:** the owner runs its own chat in
   `games/tower-defense/` (Fable 5.2); the brief is in its `CLAUDE.md`.
   Also ready for their own chats (briefs in each `CLAUDE.md`):
   `games/verb-dungeon/`, `games/verb-valley/`, and level design in
   `games/verb-platformer/`.
5. **Outreach:** Lehrerfreund and Aula PT texts are ready in
   `docs/outreach-list.md` ("Offen"). Eduthek declined (Moodle courses
   only); owner decision open.
6. **Mid/late December:** compare GSC/Bing exports with
   `docs/seo-baseline-2026-11-12/`; evaluate the tier-3 Google-noindex
   experiment; check backlinks (Bildungsserver) in both tools.


- **Folder restructure**: done, merged to `main`, pushed, and **deployed
  live** (Coolify static Base directory = `/homepage`). Verified serving:
  games.json, hub, verb-platformer, air-control, type-race.
- **Shared assets**: `/assets/` established with raw masters (KayKit,
  Kenney, zips). The 3D platformer's *wired* `kaykit-platformer` still
  lives in its source folder — consolidating it into `/assets/` (+ repoint
  + WebGL test) is a verb-platformer-session task.
- **Verb Dungeon**: PoC built 2026-06 (one asset-free level, Three.js
  primitives, goofy skeletons, grammar-as-keys). Owner said GO on
  2026-11-21; the full-build brief is in `games/verb-dungeon/CLAUDE.md`
  (short hand-built levels with models from the shared library;
  roguelite room assembly is "later, not now"). **Game base built
  2026-11-21** (KayKit models, fixed camera, 3 levels, verb doors, chests,
  hearts, stars, DE/ES/EN; old PoC in `poc/`). Checked by script only; no
  touch controls yet. Not ready for review: details and next steps in its
  `CLAUDE.md`.

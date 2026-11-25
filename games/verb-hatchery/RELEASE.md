# Verb Hatchery — release notes

## Stage 1: tester release by direct link (2026-11-25, owner decision)

"Let's release on a direct link first, without showing it on the homepage,
so we can send it to testers."

**Tester links** (after deploy):
- German: https://krabsy.com/de/spiele/verb-hatchery/
- Spanish: https://krabsy.com/es/juegos/verb-hatchery/
- (the bare game, no site header / analytics: https://krabsy.com/games/verb-hatchery/?lang=de)

What is in place:
- Build copied to `homepage/games/verb-hatchery/` = `index.html`, `src/`,
  `vendor/`, `fonts/`, `assets/` from `games/verb-hatchery/` (NOT `tools/`,
  `_shots/`, `*.md`, `assets/animals/` (unused, licence unclear),
  `assets/CREDITS.md`). 14 MB on disk; the first load is about 6 MB, creature
  models (8 MB in total) load only when a creature is first shown.
- Two lean wrapper pages, `homepage/de/spiele/verb-hatchery/index.html` and
  `homepage/es/juegos/verb-hatchery/index.html`: `noindex, nofollow`, no
  canonical / hreflang / JSON-LD / info section; they load the site header
  (`initGamePage('verb_hatchery')`), the language switch and
  `krabsy-analytics.js` (game events arrive on the dashboard as
  `game = verb-hatchery`).
- NOT listed anywhere: no `games.json` entry, no sitemap URL
  (`tools/generate_sitemap.py` skips `noindex` pages), no hub link,
  no IndexNow.
- Checked on a local copy of the site (homepage/ served, 2026-11-25): both
  pages load the game in the iframe, `source: engine`, DE / ES texts, the
  guidance starts, game events reach the parent page.

**Updating the testers' build:** after changes in `games/verb-hatchery/`,
copy again:

```
rsync -a --delete --exclude 'animals/' --exclude '*Zone.Identifier' --exclude 'CREDITS.md' \
  games/verb-hatchery/{index.html,src,vendor,fonts,assets} homepage/games/verb-hatchery/
```

then commit, push, and the owner clicks Deploy in Coolify. Note: the game's
modules have no `?v=` query; testers may need a hard reload (Ctrl+Shift+R)
after an update.

## Stage 2: public release (later, after tester feedback)

1. `homepage/data/games.json`: add a `verb-hatchery` entry (status `beta`,
   tagline DE/ES, thumbnails `homepage/thumbnails/sm|hero/verb-hatchery.jpg`
   (to be made), `devices: phone_ok`? (touch works; phone landscape not
   tested) and run `tools/render_static_games.py`.
2. Wrapper pages: rebuild from Verb Dungeon's (canonical, hreflang, og
   tags, JSON-LD WebPage/VideoGame/Breadcrumb/FAQPage, info section via
   `tools/game_info_content.py` + `tools/render_game_info.py`), drop
   `noindex`.
3. Games hubs: JSON-LD `hasPart` lines + one intro sentence (DE / ES).
4. `tools/generate_sitemap.py`, push, deploy, IndexNow for the two URLs.

Open before the public release: a real Chromebook / tablet check, the
music by ear, a native Spanish check of the invented monster names.

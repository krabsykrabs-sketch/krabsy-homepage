# Krabsy Quiz Room — release checklist (for the master session)

Status 2026-11-22: **released (pushed) on the owner's word, without a play-test.**
Steps 2–3 done in the repo; step 1 (API deploy) and the site deploy are the owner's
clicks in Coolify; then the live checks below. The play-test stays open.

## 0. Before releasing: owner decisions

- [x] Name: DE "Quiz-Raum", ES "Sala de quiz" (EN "Quiz Room"); owner 2026-11-22.
      Use these on the wrapper pages, `games.json` and the teacher pages.
- [x] Children's answers go into each child's own learning stats and, if the child
      joined a class, to that class (`recordAttempt()` on the child's device):
      confirmed by the owner 2026-11-22.
- [x] QR code on the teacher screen: owner said yes (2026-11-22). Vendored
      `qrcode-generator` 1.4.4 (Kazuhiko Arase, MIT) as `vendor/qrcode/qrcode.js`;
      the teacher's code box shows the join link as a QR code (checked: decodes to
      the link). If the link changes to a short path (step 2), the QR follows.
- [ ] Play-test (owner chose to release first, 2026-11-22; still to do): one teacher + a few real devices (ideally a class). Watch: answer card
      never stuck, frame rate on a cheap Chromebook with ~25 children (the room lowers
      its quality by itself when slow), noise level of the confetti button.

## 1. Deploy the API first (Coolify app with base directory `/api`)

- `api/quiz_room.py` is included by `api/main.py` and copied by `api/Dockerfile`.
- Single uvicorn process (as today) — rooms live in memory. Restarting the API ends all
  open rooms (children see "connection lost", then "room closed"); deploy outside
  lesson times.
- Check after the deploy: `wss://api.krabsy.com/api/quiz/ws` connects through
  Traefik (WebSockets are on by default in Coolify's Traefik). Quick check from a
  browser console on krabsy.com:
  `new WebSocket('wss://api.krabsy.com/api/quiz/ws').onopen = () => console.log('ok')`.
- Origins allowed: `https://(www.)krabsy.com` (env `QUIZ_ORIGIN_RE` to change).
- Load test against the live server is possible (`tools/load-test.mjs 30 6 wss://…`),
  but it opens a real room: do it once, outside lesson times.

## 2. Copy the game into the site

- Copy `games/quiz-show/{index.html,teacher.html,src,vendor,assets,fonts}` to
  `homepage/games/quiz-room/` (about 6 MB; assets are CC0 KayKit + licences).
- The pages load `/lib/krabsy-questions.js`, `/lib/krabsy-stats.js`,
  `/lib/krabsy-game-events.js` from the site (absolute paths) — nothing to change.
- `src/net.js` picks `wss://api.krabsy.com/api/quiz/ws` automatically on krabsy.com.
- The teacher page shows the join link as `…/games/quiz-room/index.html?code=XXXXXX`.
  Better for children to type: a short path, e.g. `krabsy.com/quiz` (DE) /
  `krabsy.com/quiz` (ES too) that redirects or serves the child page; then change
  the link text in `src/teacher.js` (`enterRoom`, `joinUrl`).

## 3. Pages, catalogue, SEO

- Wrapper/landing pages DE + ES (teacher-facing: what it is, "Raum öffnen" button to
  the teacher page; a "Code eingeben" entry for children).
- `homepage/data/games.json` entry `quiz-room` (or keep it off the kids' games grid
  and feature it on the teacher pages `/de/lehrkraefte/`, `/es/docentes/` instead —
  owner question in the brief).
- Teacher pages: the Quiz Room is the "for your lesson" feature.
- Privacy pages: the Quiz Room keeps first names and positions **in memory only**
  while a room is open; nothing is written to disk; the room disappears after the
  lesson. Classes (if a child joined one) work as before.
- Sitemap + IndexNow for the new wrapper pages (not for `teacher.html` /
  `index.html` of the game: both are `noindex`).

## 4. After the release

- Dashboard: game id `quiz-room` (`quiz_open`, `level_start`, `level_end` from the
  teacher page; answers from the children).
- STATUS.md and the brief's log.

## Done 2026-11-22 (release commit)

- Game copied to `homepage/games/quiz-room/` (re-copy after every change in
  `games/quiz-show/`).
- Children's short link `homepage/quiz/index.html` (krabsy.com/quiz, noindex): forwards
  to the child page with `?code=…&lang=…`. On krabsy.com the teacher screen shows
  "krabsy.com/quiz" and the QR code points there.
- Wrapper pages `/de/spiele/quiz-room/`, `/es/juegos/quiz-room/` (iframe of the child
  join screen; info section via `tools/render_game_info.py`, content in
  `tools/game_info_content.py`, `PLAYMODE` MultiPlayer). Child join screen has a
  "Lehrkraft? Quiz-Raum öffnen →" link (desktop only).
- `games.json` entry `quiz-room` (NEU until 2027-02-28; not featured), static grids,
  hub JSON-LD + intro sentence, thumbnail `thumbnails/sm/quiz-room.jpg` + hero.
- Teacher pages DE/ES: hero button + "Neu: der Quiz-Raum" section; privacy summary item.
- Privacy pages DE/ES: section "Quiz-Raum" (in memory only, closes after 2 h / 15 min).
- Class dashboard source label `quiz-room` (krabsy-class-pages.js, cache v 2026-11-22c).
- Sitemap: the two wrapper pages.
- Checked locally (site on :8000 + API on :8150): wrapper pages DE/ES, chip bar, hub
  and teacher-page links, Spanish teacher page, /quiz/ forwarding with code, join,
  a question, answer recorded in the child's stats through the site's /lib; no errors.

# Krabsy Quiz Room — release checklist (for the master session)

Status 2026-11-22: milestones 1–5 built and tested headless; **not deployed, not
played by people**. The game is two pages (teacher + child) plus a WebSocket room
server inside the existing API. Nothing here has been done yet; it's the list.

## 0. Before releasing: owner decisions

- [ ] Name (DE "Quiz-Raum" / ES "Sala de quiz" / EN "Quiz Room"?).
- [x] Children's answers go into each child's own learning stats and, if the child
      joined a class, to that class (`recordAttempt()` on the child's device):
      confirmed by the owner 2026-11-22.
- [x] QR code on the teacher screen: owner said yes (2026-11-22). Vendored
      `qrcode-generator` 1.4.4 (Kazuhiko Arase, MIT) as `vendor/qrcode/qrcode.mjs`;
      the teacher's code box shows the join link as a QR code (checked: decodes to
      the link). If the link changes to a short path (step 2), the QR follows.
- [ ] Play-test: one teacher + a few real devices (ideally a class). Watch: answer card
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

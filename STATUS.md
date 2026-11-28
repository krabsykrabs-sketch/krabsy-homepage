# Krabsy — status dashboard

## Drills renewed (2026-11-28), not pushed
Review `docs/drill-review-2026-11-28.md`. Quick wins (041a2823, d7487429, b041e489,
011fc4e2): Sprint 12 questions, shells on end screens, Flashcards rounds of 10 without
shells for self-rating, Drag Match tap on the empty slot, Verb-Diplom tab, emojis → icons.
Drill shell (0e2a5a05 … a64b7ee6): `lib/krabsy-drill.js` runs Sprint (16 pages), Free
Practice, Type Race (typed + clock; old game retired, /games/type-race.html redirects) and
Fill the Gap (all topics, 10 per round, no lives; /games/fill-the-gap.html redirects);
intro cards gone, articles below the drill. Open: Statistik → Profile; unused strings
(`tools.free_practice` filter, `drills.type_race.input_*`); "Auswahl von 1 Verben".

## Live invites (2026-11-28), not deployed

Owner spec: `docs/classroom-concept.md` "Live invites (owner decisions 2026-11-28)"; as built in "Live invites as built".
- **API** `api/invites.py` (in memory only): `POST /api/invites {tokens}` → active invites for the device's pupils (kind, class, who started it, target, pupil name); `POST /api/invites/respond {token, invite, join|decline}`; "Jetzt nicht" per pupil and session; host sees joined / declined / waiting; gone when the session ends (max 2 h quiz / 3 h lesson); rate limits.
- **Quiz Room for a class:** teacher page "Für Klasse" (device + account classes), dashboard button "Quiz-Raum mit dieser Klasse"; pupils join from the invite with their class identity (no code, no name), answers count in the class overview; code joins unchanged; teacher list "Einladung an 6b · 1 dabei · 1 jetzt nicht · 1 warten". Quiz-room modules now `?v=`-stamped (`tools/stamp_game_modules.py` handles multi-page games).
- **Tutor live lesson:** starting a lesson invites the student from any page to `/en/spanish/me/`; the live page shows "Lucas gets an invitation …" / "chose “Not now”".
- **Overlay** `lib/krabsy-invite.js`, started from `krabsy-analytics.js` (only devices with class/student keys, top window): polls ~18 s while visible, backoff, no requests without tokens; dialog with focus trap, Esc = Jetzt nicht, "Nein, jemand anderes" → "Who's playing?". Texts `ui_<lang>.json` `invites`.
- **Re-invite (owner 2026-11-28):** a pupil who left the room / lesson page gets the invite again while the session runs (after ~20 s, no flicker on reload); only "Jetzt nicht" stops it; rejoin = same player. Lists show "war dabei · offline" / "kommt gleich".
- **Privacy pages DE/ES/EN** updated (Quiz Room + live lessons): polling with the existing key, status in memory only, deleted at session end / 2 h / 3 h.
- Tests: 96 API tests pass; E2E headless DE + ES + tutor (390 px pupils): overlay on game and drill pages within 3–19 s, above the iframe, Beitreten → in the room as "Mia · 6b", Jetzt nicht/Esc → declined on the teacher list and no new overlay, answer in the class overview (source quiz-room), no overlay after the quiz, 0 polls without tokens, no console errors, no overflow.
- **Open / owner:** `krabsy-analytics.js?v=2026-11-22` not bumped on ~500 pages (1 h cache delay for returning visitors); lawyer review of the new privacy lines. **Deploy order: API first**, then the site. Try locally: `python3 tools/dev_api_server.py` → http://localhost:8010/de/lehrkraefte/klasse-erstellen/ → dashboard → "Quiz-Raum mit dieser Klasse"; pupil in another browser profile via /de/klasse/.

## Site review fixes, batch A (2026-11-27/28), not pushed

From `docs/site-review-2026-11-27.md`: T1 (ES verb table + flashcards show/search the page-language meaning), O1 (Verb Kitchen self-hosted fonts; no external request left on the site), T3 (no "concha"), L1 (10 pages: standard header skeleton; `mountHeader` also hoists a nested logo), T2 (verb-page mini-quiz `go → ___ → ___` / `go → went → ___`, grammar name as caption), N2 (`/en/404.html`; **owner: paste the `~^/en/ /en/404.html;` line from `docs/nginx-krabsy.conf` into the server config**), T7, T8, T9, T10, T14, S3, S4 ("erste Zeitformen" on the landing), S5, C12, L5, L10, T6 (`ui_en.json`). `krabsy-ui.css` / `-header.js` `?v=2026-11-27-rv` (not on the six Type Race / Drag Match / Falling Forms wrappers, edited by the drill batch). Open: quiz-room "Your colour" / "practise" (`games/quiz-show` source).

## Figure editor light + easier to find (2026-11-27), not pushed

Owner: "The character editor is too hidden" and "its style with the dark blue does not fit".
- **Editor light, like the profile** (`lib/krabsy-figure-page.css` / `.js`, pages `/de/meine-figur/`, `/es/mi-personaje/`, `/en/my-figure/`): the figure stands on a sand platform in the profile's teal-to-sand card (transparent canvas, lights as on the landing/profile figure); tabs, tiles and buttons in a white card. Tabs = icon over label in pills (open one teal like the top bar's current item). Tiles: figures on soft teal, things on soft amber; chosen = teal ring + tick; "Neu" badge; "?" = dashed tile. Colour dots on white (chosen = ink ring). Save = coral main button; on phones Save/Random/Reset are a floating white bar above the tab bar. The shell bar on top has the profile's parts (shell icon, bar, gift at its end). **This replaces "the builder is a dark game card" in the sections below.**
- **No emojis in the editor:** icons from `lib/icons/krabsy-icons.svg`, new `ki-hat`, `ki-palette`, `ki-shirt`, `ki-dice`, `ki-turn` (README table updated); "nothing" and the tick are drawn in the editor's JS/CSS. The landing's shell chip uses `ki-shell` now.
- **Landing** (`/de/`, `/es/`, `/en/spanish/`, markup by hand + `krabsy-landing.css`): a pencil badge on the figure (`#lf-pencil`, always) and a button "Figur ändern / Cambiar personaje / Change figure" (`#lf-edit`, only for a child who sees "Mein Profil"; a new visitor's main button already says "Bau deine Figur →"). From 1000 px the shell count sits at the figure's feet and the two buttons are stacked; the figure column is about 40 px taller than before, so the featured tile and the games grid start that much lower.
- **Profile:** pencil badge on the figure (`#pfPencil`), and a line over the collection "Tipp auf ein Bild und probier es an deiner Figur an." (tiles' labels end with ": anprobieren").
- `?v=`: figure-page JS/CSS `2026-11-27m`, landing CSS `2026-11-27m`, profile JS/CSS `2026-11-27s`, icon sprite `2026-11-27c` on these pages.
- Checked headless (390×844 touch, 1024×768 touch, 1366×768; DE / ES / EN; new child and a child with a saved figure, 412 shells, 5 gifts, two of them new): all four tabs, 0 console errors, no horizontal overflow, no external requests apart from blocked api.krabsy.com; arrow keys / End move the tabs, Save writes the figure, pencil and button open the editor, profile tile opens it. Not verified: real devices, Spanish wording by a native speaker.

## Optional teacher sign-in "Klasse sichern" (2026-11-27), not deployed

Owner spec: `docs/classroom-concept.md` "Decision: teacher accounts"; as built there ("Teacher sign-in as built"). Creating a class still needs no account and no email.
- **One account identity for teachers and tutors** (`api/accounts.py`): an account = an email (no password, no name); roles come from what hangs on it (`classes.account_id`, `tutors.account_id`). One sign-in: one-time link (20 min, single use, hashed), session per device (60 days after last use, hashed), shared rate limits (30 links/IP/h, 5/address/h, 60 verifies/IP/10 min), `/login` always `{"ok": true}`, the teacher email is the same for known and new addresses. `tutor_auth.py` is now a thin tutor layer on it; on start the old `tutors.email` / `tutor_sessions` / `tutor_links` migrate (signed-in tutors stay signed in; checked on a database made by the previous code).
- **API:** `/api/account/login {email, lang, claim?}` (claim = a class's secret token, attached when the link is opened), `/verify`, `/logout`, `GET /me`, `/attach {teacher_token}`, `/detach {class_id}`, `/delete`. Class endpoints also take `X-Account-Token` + `?class_id=` (owner); `/api/class/create` with a session saves the class; `/api/class/new-link` (owner only) replaces the secret link. Secret links keep working for every class (also saved ones: after "delete account" they are the way in).
- **Purge:** classes unchanged (180 days without activity). Accounts with no class and no tutor space are deleted 180 days after the last sign-in/use; deleting a tutor space also deletes an otherwise empty account; "delete account" removes email, sessions, open links and the account→class links, classes stay.
- **Pages (DE/ES; EN has no class pages):** after "Klasse erstellen" a recommended, skippable "Klasse sichern" card; dashboard: quiet "Klasse sichern" / "Zu meinem Konto hinzufügen" / "Gesichert in Ihrem Konto", `#c=<id>` for saved classes, "Neuen geheimen Link erstellen" for owners; new **Meine Klassen** `/de/lehrkraefte/meine-klassen/`, `/es/docentes/mis-clases/` (sign-in link target `#l=`, class list, classes found on this device, add an older class by its link, detach, sign out, delete account). Session in `localStorage.krabsy_account`. Teacher pages link "Meine Klassen" next to "Klasse erstellen".
- **i18n:** class page texts moved out of `krabsy-class-pages.js` into `ui_<lang>.json` `classes` (de/es/en); email texts (teacher + tutor) in `ui_<lang>.json` `mail`, copied to `api/catalog.json` by `tools/krabsy_registry.py` (re-run after editing them). `sections.json` ui `class_account`. Icons `ki-mail`, `ki-saved`.
- **Mail sender:** `mailer.py` uses `MAIL_FROM` or `Krabsy <SMTP_USER>` (= hello@krabsy.com today) for all languages. Optional now: `MAIL_FROM_DE` / `MAIL_FROM_ES` / `MAIL_FROM_EN` (e.g. `Krabsy <hallo@krabsy.com>`), only if the mailbox may send as that address (alias at Namecheap).
- **Privacy:** DE/ES/EN privacy pages (class section) + teacher pages FAQ/privacy summary updated. **Owner/lawyer:** the email provider (Namecheap Private Email, sends the sign-in links) is not named in the privacy pages (also not for tutors) — decide whether it must be listed as a processor; the 180-day account purge and 60-day sessions are stated as facts; still no lawyer review / AVV template.
- **Tests:** `api/tests/test_accounts.py` (claim on sign-in, second device, create while signed in, attach/detach/list, new secret link, delete account, no enumeration, rate limits, tutor+teacher one account, purge, migration); 90 passed. E2E headless (390×844 touch + 1366 wide, DE and ES): create anonymous class → Klasse sichern → link from the API log → Meine Klassen shows it → fresh profile signs in → attach older class by its secret link → detach → delete account → class still opens by its secret link; no overflow, no external requests; only console line = the expected 401 when the first device checks its (deleted) session.
- **Deploy order: API first** (Coolify API app; the migration runs on start), then the static site. Old cached pages keep working with the new API. Local try: `python3 tools/dev_api_server.py` → http://localhost:8010/de/lehrkraefte/klasse-erstellen/ (sign-in links are printed in that terminal).

## Profile page rebuilt as the child's corner (2026-11-27), not pushed

Owner verdict on the first profile page: "I don't like it" (a statistics dashboard for adults: 8 sections, three screens, many numbers and empty boxes, the collection hidden). `/de/profil/`, `/es/perfil/`, `/en/my-profile/` now have four parts, about 1.5 laptop screens with footer excluded, mostly pictures. **This replaces the page described under "Profile page 'Mein Profil'" further down** (number tiles, gift-goal list, "Deine Spiele" with `GAME_SAVES`, "Mehr Zahlen zu den Verben", the dark figure card are gone).
- **1 Me:** the landing pages' live figure, big (`krabsy-landing-figure.js` on `krabsy-figure-live.js`: drag to spin, tap to jump, picture first, 3D after load + idle, same blocking rules; `?fig=3d` / `?fig=off` for tests; a child without a figure sees the default one), class badge, shell count, ONE bar to the next surprise ("Noch 38 Muscheln bis zur nächsten Überraschung"), buttons "Jetzt üben · 5 Minuten" (weekly ring) and "Figur ändern" / "Bau deine Figur".
- **2 Meine Sammlung:** every owned figure and thing as a picture tile (gifts newest first, then the child's figure, the free figures, the starter things), "Neu" on unseen gifts, "?" tiles that finish the last row, "12 von 42 Figuren · 4 von 33 Sachen", one line with the next goal (the milestone of `getRewards().goals` the child is closest to, else the shells). A tile opens the figure page with that entry (`#neu=<id>`).
- **3 Meine Themen:** only practised topics: stars 0–5 (`topicNumbers` in `krabsy-profile.js`, the ladder of the tutor's `measure_stars` made from mastery: 1 answered · 2 ≥ 5 answers, half right · 3 ≥ 10 answers, 80 % right, 4 items at mastery ≥ 4 · 4 / 5 = 40 % / 80 % of the whole topic sits), up to 4 "Noch üben" chips, "Üben →"; the other topics are one link "Neues Thema ausprobieren →" (Themen page). New child: an invitation with the crab instead.
- **4 Meine Pokale:** Verb-Diplom medals earned, weeks with 3 practice sessions (`krabsy_practice_v1`); no row when there is nothing. Device note = one small line.
- **No emojis on the page:** new icons `ki-shell`, `ki-gift`, `ki-star`, `ki-star-off` in `lib/icons/krabsy-icons.svg` (use `?v=2026-11-27b`); medals are inline SVG. Still emoji, not part of this change: the header shell counter (`krabsy-shells.js`) and the gift popup (`krabsy-gifts-ui.js`).
- `?v=2026-11-27r` for `krabsy-profile.js` / `.css` on the three pages.
- Checked headless (390×844 touch, 1024×768 touch, 1366×768; DE / ES / EN; new child and a seeded child with figure, 412 shells, answers in verbs / prepositions / Simple Past / ser, Diplom bronze, class, a finished week): 0 console errors apart from blocked api.krabsy.com, no horizontal overflow, no other external requests, figure live, drag turns it, tap jumps, tile → figure page. Not verified: real devices, Spanish wording by a native speaker, whether the star ladder feels right with real practice data.

## Game clips on card hover (2026-11-27): Verb Kitchen + Verb Towers, not deployed

Owner chose real gameplay over animated thumbnails, "a bit more exciting, not everything exactly as in the game". A ~8.6 s silent loop plays over the card picture: mouse on hover (140 ms delay), keyboard on focus, phones when the card is fully in view (one at a time); nothing with reduce-motion or Save-Data; nothing downloads before a card asks.
- **Player:** `lib/krabsy-clips.js` (module) on the landing pages and games hubs of all three sections (`/de/`, `/es/`, `/en/spanish/`, `/de/spiele/`, `/es/juegos/`, `/en/spanish/games/`). It finds cards by `data-game-id` or their `/…/<id>/` link, so static and JS-built cards both work. Clip per section: `games.json` `"clip": {"<section id>": url}`.
- **Clips:** `homepage/clips/verb-kitchen-{de,es,en-spanish}.mp4` (640×360 H.264, ~390 KB each). DE/ES: take → took → taken; EN/Spanish: "Yo ___ de Inglaterra" → soy.
- **Verb Towers:** `homepage/clips/verb-towers-{de,es,en-spanish}.mp4` (~390 KB). Scene `tools/game-clips/verb-towers.cjs` (level Two Gates): the game's real wave 4 (one by one, owner 2026-11-28: no crowds), the camera walks with one skeleton, the question card (the game's phone strip, captured at 736×414) pays 31 → 40 coins = a frost tower, which goes up and freezes the column, pull back to the castle. Takes over the game loop (`gameLoop` rAF switched off, `__td.step` + `Renderer.render`, `_applyCamera` replaced); seeded `Math.random` (`seed: 3`: DE/ES forget → forgot).
- **Recorder:** `node tools/game-clips/record.cjs verb-kitchen --section de|es|en/spanish` (site on :8000, ~7 min per clip, run the three in parallel). Frame-exact: fake page clock + stepped CSS animations, captured at 2× and scaled down. Scene file `tools/game-clips/verb-kitchen.cjs`: real play through the game's QA hook (`window.__VK`) + a movie camera rig (shots, slow motion, shake); HUD, tickets, progress bars and target square hidden. `--seed N` picks the question, `--probe` finds seeds fast. **When a game changes visibly, re-record and bump `?v=` in games.json.** A new game needs its own scene file (QA hook required).
- Checked headless: hover plays and stops on all 6 pages, touch emulation plays in view and stops when scrolled away, 0 console errors. Not checked: real Safari/iOS.

## English tense topics: own pages + Themen by class year (2026-11-27), not deployed

The four gap topics en_simple_past, en_present_simple, en_present_progressive, en_present_perfect now belong to the DE/ES sections (topics.json `de`/`es` slugs + `pages` sprint/fill-the-gap).
- **URLs:** DE `/de/simple-past/`, `/de/simple-present/`, `/de/present-progressive/`, `/de/present-perfect/`; ES `/es/pasado-simple/`, `/es/presente-simple/`, `/es/presente-continuo/`, `/es/presente-perfecto/`; each with `sprint/` and `fill-the-gap/`. One level under `/<ui>/` like `/de/praepositionen/` (`/de/` is the English home, docs/vision.md; the language switch and header only understand one topic segment). German teachers search the English term ("simple past übungen"), Spanish ones mostly the Spanish one ("pasado simple inglés"); ES titles carry both.
- **Generator:** `python3 tools/build_topic_pages.py [--check]` (texts in its TOPICS/UI tables; Sprint/Fill skeletons = the DE/ES preposition drill pages), then render_static_games, render_game_info, render_topics_page, render_landing_intro, generate_sitemap (order in its docstring).
- **Draft = noindex:** `"status": "draft"` in topics.json → noindex on all 24 pages (so not in the sitemap) + a "Neues Thema: … wird noch muttersprachlich geprüft" line on the hub. **To release a topic: delete its `status` field, re-run the generator chain.** `check_catalogues.py` fails while pages and status disagree.
- **Class years:** topics.json `"years": {"de": [first, last], "es": [first, last]}` (de = Klasse; es = curso counted from 1º Primaria, 7 = 1º ESO; helpers in `krabsy_registry.py` year_range/year_label/year_group). Themen pages grouped by the first year: DE Klasse 5 (Simple Present, Present Progressive, Präpositionen 5–6, Simple Past 5–6, Unregelmäßige Verben 5–7), Klasse 6 (Present Perfect); ES 5º/6º Primaria (Present simple), 1º ESO (rest). Card shows the range.
- **Also fixed:** link builder takes `?topic=` (hubs link to `/de/lehrkraefte/?topic=…#uebungslink`); class dashboard shows item labels + topic for sentence topics ("walk → walked (Simple Past)") instead of ids; Sprint texts per topic (`ui_de/es.json` topic_overrides); landing line "… und die wichtigsten Zeitformen" (in_sentence). Footer, Jetzt üben, profile, language switch picked the topics up unchanged.
- **Egg Island:** en_* topics removed from verb-hatchery in games.json, otherwise the tester-only game would have appeared in the DE/ES grids, hubs, link builder and Jetzt üben. **Re-add them at its public release.**
- Checked headless (390×844 touch, 1024×768 touch, 1366×768): 24 pages, noindex, 0 console errors, no overflow, no external requests; Sprint DE/ES runs and records stats; language switch; link builder; Jetzt üben picked Simple Past as weak topic and suggested its games; profile labels; dashboard (API mocked).
- **Fill the Gap fixed (2026-11-27, not deployed):** records every answer (`recordAttempt(item, form, ok, 'fill-the-gap', topic, 'typed')`, same item ids as Sprint → shells, profile, star map, class queue); start texts per topic kind (verbs / prepositions / sentence gaps, DE/ES/EN); plays on phones and tablets (one-column layout < 900 px, input under the sentence + OK button on touch, keyboard stays open between sentences, á é í ó ú ñ ¿ ¡ keys for Spanish topics; wrappers no longer hide the frame < 900 px and pass `from=teacher` → "Übung von deiner Lehrkraft" on the start screen). Wrapper skeletons = the 4 hand pages (de/praepositionen, de/unregelmaessige-verben, es/preposiciones, es/verbos-irregulares `fill-the-gap/`), generated pages via build_topic_pages / build_en_spanish.
- **Open:** Kitchen/Towers menu texts for en_* (open task in their briefs). Quiz Room has no en_* topics. Landing SEO text still says "zwei Themen"; landing "Üben ohne Spiel" cards list only verbs + prepositions.

## Top bar = main menu + Themen page (2026-11-27), not deployed

Owner: "We can't put all the topics in there. Rather things like play, practice, etc." The header of every site page now shows **Spielen · Üben · Themen · Profil** (ES Jugar · Practicar · Temas · Perfil, EN Play · Practise · Topics · Profile), right side 🐚 counter (unchanged behaviour + gift dot), "Für Lehrkräfte / Docentes / For teachers" (short label < 1100 px), DE|ES switch (EN has none). Current item: `aria-current="page"` + teal pill (topic hubs, drills, verb pages count as Themen; figure page as Profil; teacher link marked on teacher pages).
- **One source:** `lib/krabsy-header.js` (ES module; labels + inline SVG icons; URLs from `data/sections.json` `games`/`practice`/new `topics` + `ui.profile`). It normalises whatever header markup a page has (logo kept, old `.k-topic-nav` chips and `.hd-teach` removed, builds `.hd-right` with teacher link + language buttons if missing). CSS: `krabsy-ui.css` "Site header". `krabsy-topic-nav.js` is now a shim that imports the header (stale HTML). Pages load `<script type="module" src="/lib/krabsy-header.js?v=2026-11-27h">`; generators updated (`generate_verb_pages.py`, `build_en_spanish.py`, `generate_worksheets.py`, `generate_lesson_plans.py`).
- **Phones (< 760 px):** the same `<nav>` is a bottom tab bar (icon + label, `env(safe-area-inset-bottom)`, body padding via `body.k-has-tabbar` / `--k-tabbar-h`); top = logo, shells, language. Hidden while a drill runs (`body.k-is-playing`), during the "Jetzt üben" questions (`.kp-quit` on screen) and while a text field has focus (`body.k-typing`). Figure page sticky buttons and the gift card sit above it; Drag Match / Falling Forms frames subtract it.
- **Game pages** (`/de/spiele/<id>/` …, iframe) don't load the header: they keep the compact 48 px game header (`krabsy-nav.js` initGamePage), no bottom bar. Tutor pages (`/en/spanish/tutors/`, `/me/`, `/report/`) and `/quiz/` untouched.
- **Themen page** `/de/themen/`, `/es/temas/`, `/en/spanish/topics/` (EN noindex; DE/ES in sitemap + language switch + hreflang). Generated: `python3 tools/render_topics_page.py` (re-run after topics.json / games.json / sections.json changes; `--check`). Card per topic: name → hub, first sentence of `description`, `card_stats`, "Üben" → Sprint page, "N Spiele" → hub `#games-section` (games.json `topics`, without `audience: "teacher"` / coming_soon). Optional `year` (number) in topics.json groups cards ("Klasse 5" …); none set, so one group "Alle Klassen". Footer Themen column has "Alle Themen →".
- New icons `ki-topics`, `ki-profile` in `lib/icons/krabsy-icons.svg`.
- `?v=2026-11-27h`: krabsy-ui.css, -footer.js, -lang-switch.js, -header.js on ~450 pages; landing.css, figure-page.css. `krabsy-shells.js` / `-gifts-ui.js` load without `?v=` (old landing shell CSS is overridden by `.k-hd > .k-shells` meanwhile).
- Checked headless (390×844, 360×740, 760, 768, 1024×768 touch, 1366×768; DE/ES/EN; landing, hubs, game page, topic hubs, drills, Themen, Üben, profile, figure, teacher pages, imprint, 404, class pages, tutor pages): 0 console errors (apart from blocked api.krabsy.com), no horizontal overflow, current item marked. Not verified: real devices (iOS safe area: pages have no `viewport-fit=cover`, so the inset is 0 and Safari keeps the bar above its own toolbar).

## Landing intro banner (2026-11-27), not deployed

`/de/`, `/es/`, `/en/spanish/`: white intro card above the featured game, always full (owner: no collapse). h1 ("Englisch-Grammatik üben – mit Spielen" / "Practica gramática inglesa – con juegos" / "Practise Spanish grammar – with games"), one line (topics from `topics.json` `in_sentence`, audience, free / no sign-up / no ads), big buttons Spielen (coral) · Üben (→ section `practice`) · Verb-Diplom (only where a topic has that page; not EN), quiet line: teachers page, class code (DE/ES), Quiz-Raum (`/quiz/?lang=<ui>`); crab mascot right (`thumbnails/sm/crab-240.webp`, hidden on phones). Class badge replaces the class-code link. No emojis: own icon sprite `lib/icons/krabsy-icons.svg` (play, practise, diploma, teacher, class, quiz; rules in `lib/icons/README.md`). Texts `ui_<lang>.json` `landing.*`; markup from `tools/render_landing_intro.py` (re-run after text/topic changes; `check_catalogues.py` checks it). `krabsy-landing.js?v=2026-11-27p`, `.css?v=2026-11-27c`. Title/meta/JSON-LD unchanged. Featured game starts at ~320–350 px on desktop (1280×800), ~520–540 px on phones.
Emojis still elsewhere (to replace later): 🐚 shells next to the landing figure, ✓ in "Handy ✓"/"Phone ✓" badges, 174+174 verb pages, the games/spiele and practice pages, and lib/ (figure-page, profile, tutor, live-tutor/-student, activities/*, practice, shells, gifts-ui, nav, footer, game-info).

## i18n foundation N1–N6 (2026-11-27), not deployed

Sections as data (`data/sections.json`, `lib/krabsy-lang.js`, `tools/krabsy_registry.py` → `lib/krabsy-registry.js` + `api/catalog.json`), one `currentLang()`, engine keeps language maps, taught language from the registry, API from one catalogue, validator `tools/check_catalogues.py`. Deploy site + API together. Details, leftovers and cache notes: `docs/i18n-scaling.md` (N1–N6 rows, release notes).

## Teacher page tabs (2026-11-27), not deployed

`/de/lehrkraefte/`, `/es/docentes/`, `/en/spanish/teachers/`: short hero with chips, then tabs (DE: Loslegen · Übungslink · Klasse & Quiz-Raum · Unterricht & Material · Datenschutz & FAQ; ES the same; EN: Get started · Practice link · Quiz Room & tutors · Privacy). `lib/krabsy-teacher-tabs.js` (hash per tab, old anchors like #uebungslink/#quiz-raum/#enlace-de-practica/#sala-de-quiz/#practice-link open the right tab and scroll; back/forward; arrow keys) + tab/compact styles in `krabsy-teachers.css?v=2026-11-27`. Without JS every panel is visible in order. Starter games keep "Öffnen", their "Link kopieren" moved to the Übungslink tab; privacy points are accordions; JSON-LD/meta unchanged. DE/ES HTML hand-written; EN from `tools/build_en_spanish.py` `build_teachers()` (was stale vs. the hand-edited page, now in sync). Phones hide the hero key art.

## Root language rule (live 2026-11-27)

`krabsy.com/` → `/es/` (Spanish/Portuguese first), `/de/` (German first, or no header = crawlers), else `/en/spanish/` (English interface; owner: friend in Spain with an English laptop landed on /de/). Config `docs/nginx-krabsy.conf`, pasted in Coolify; rollback `docs/nginx-krabsy.previous.conf`. Note: after saving the nginx field it took several minutes / a second deploy until the new rule answered.
## Duo games concept (2026-11-27)

**Release plan (owner, 2026-11-27, not done yet):** name **"Krabsy Duo"** (folder stays `games/duo-coop`). Release first on the players' side as a "2 Spieler" game (siblings, friends, parent + child; mention pair work on the teacher pages); tutors only after D2 (online, two devices). Before release: the owner plays it with a real second person. Site work then: wrapper pages DE/ES/EN with a clear 2-player label, games.json (all quiz topics, ui_langs de/es/en, 2-player marker), hub, sitemap; copy the build to `homepage/games/duo-coop/` (relative imports, no stamping yet). Known limit: only player 1's answers are recorded. Checklist: `games/duo-coop/CLAUDE.md` "Where it goes".

`docs/duo-games.md`: tutor + student (live lesson) and two students at home (one device or a room code). First: a co-op puzzle platformer (side view on the Verb Platformer engine, two roles, every switch/door/portal/monster = a question, ~3 of 4 for the student, a question every 20–30 s). Then an answer race. Phase D1 = local prototype. Open: name, tutor answers or not. Nothing built yet.

## Student side concept (2026-11-27)

`docs/student-path.md`: practice session "Jetzt üben" with a weekly goal of 3 (P1; not daily, owner 2026-11-27), vocabulary as a topic kind (P2), personal word lists from tutors/teachers (P3), gradual interface language (P4). Open owner decisions listed there.

**P1 built 2026-11-27 (not pushed):** pages `/de/ueben/`, `/es/practicar/`, `/en/spanish/practise/` (EN noindex; DE/ES in the sitemap, language switch knows them). Session = warm-up (8 due questions across the child's topics, choice chips) → one topic new or weak (homework > weakest > longest not practised; ~5 questions, a new item shows its teach line first, typed answers with á é í ó ú ñ keys and "Lieber auswählen") → 2–3 games of that topic (`?topic=`, homework adds `difficulty`/`from=teacher`). Counts for the week after step 2. Weekly ring "1 von 3 diese Woche" → "Woche geschafft ✓" on the landing pages (under "Mein Profil", full width on phones), the profile pages and the student page ("Practise now", starts with the open homework). Storage `krabsy_practice_v1` (synced). Files: `lib/krabsy-practice.js` + `.css`, `lib/krabsy-practice-week.js`. Details, decisions and checks: `docs/student-path.md` "P1 as built". Not verified: real devices, Spanish wording by a native speaker, a real tutor homework (API mocked).
## Live classroom (2026-11-26, LIVE on hidden links; verified on krabsy.com: presence, material via + Add, ▶ to a typed step, typing mirrored in 0.37 s over the internet, ghost hand, star, End → note saved, 0 errors; test space deleted. First real lesson with Nora 2026-11-27; setup: docs/live-lesson-guide.md)
2026-11-27, LIVE and verified on krabsy.com: the tutor does it on the student's screen (left click = do, typing box, right click = point; tutor answers 'by you', not in the star map), lessons keep running while the tutor navigates (red bar, 'Back to live lesson'), confirmations before ending.
2026-11-27 midday, LIVE and verified: live lessons keep their progress (relay saves to SQLite + restores after restart, student backup, re-click keeps, '↺ Start again'), quick practice always fills the requested count (all topics × modes = 10), wording 'Start with what … still gets wrong', pointing = circle only, hints never grey out needed words.
Next foundation (owner decision 2026-11-27): **one learner, many connections** — one profile/history per child across own play, classes and tutors (`docs/tutor-platform-v2.md` §4.10, WP 0.10), before the new tutor app.
2026-11-26 evening, also LIVE and verified on krabsy.com: tutor pages redesigned (start, space, profile, report; `body.kt-pro`), forgiving drag and drop (overlap / 40 px), all 14 worksheets fixed by a quality pass (checker: 108 problems → 0; give-aways, answer streaks, banks, ambiguous gaps) and quick practice follows the same rules. Free Spanish curriculum research: `docs/spanish-curriculum-sources.md` (Oak National Academy, OGL; API key requested 2026-11-26).

Zoom for face and voice, Krabsy as the shared workspace: the tutor starts a live lesson from the
space, the student's own page (`/en/spanish/me/#k=…`) switches to it, the tutor sees a mirror, points,
gives hints, adds materials on the fly and ends with a lesson note. Built 2026-11-25/26 in packages
L1–L4 plus integration and a review fix (relay `api/live.py`, player `homepage/lib/activities/`,
14 curated materials + 59 vocab words, live pages `krabsy-live*.js`); acceptance passes (two browser
contexts, API tests). **Not deployed**: needs the static site and the API deployed together.
Contract, deviations, how to use it and known limits: `docs/live-classroom.md` ("As built").

Living overview of every game and the project. Master session updates this
at the end of each session. (Last update: 2026-11-25.)

## Look: new site fonts + new crab (2026-11-26)

- **Fonts switched (owner: "let's go with Fredoka"), committed, not deployed:** site headings
  `'Fredoka Display'` = Fredoka 600 as one fixed-weight face (so the ~400 generated pages with
  `font-weight: normal` headings need no edits), text = Nunito (variable, real bold now; before,
  700–900 were faked from the 400 file). Limelight and Verdana are gone from site CSS/JS, the
  drills and `style.css`; Limelight files deleted. Games keep their own Fredoka One. Versions
  bumped to `2026-11-26f` (krabsy-ui/-nav/-class/-tutor, krabsy-fonts.css imports, generators).
- **New crab — chosen 2026-11-27 (owner):** a **hermit crab**: black body, two orange pincers,
  eyes on yellow stalks (with eyebrows), open smile, cream spiral shell with an orange spiral
  (ties into the 🐚 shells currency). Ref images in `_incoming/krabsy-crab/new/` (gitignored):
  `E1a.jpg` = the 3D reference, `E1b-logo.jpg` = flat logo (reads at 32 px; at 16 px the cream
  shell fades on white → favicon needs an outline/darker shell), `E1-turnaround.jpg` (front view
  inconsistent: shell sits like a hood). Rejected along the way: coral toy (babyish), smug purple,
  Buddy, tech crab. Gemini prompt rounds: `_incoming/krabsy-crab/GEMINI-PROMPTS*.md`.
  Site images (logo, favicon, greeting) switched to the generated 2D/3D pictures 2026-11-27.
  **TODO (owner, later — "on the list"): the 3D model.** Owner uploads to Tripo (tripo3d.ai,
  Image to 3D; multi-view if offered) the four views `_incoming/krabsy-crab/new/gen/turn3-{front,
  side,back,threequarter}.png` (else `new/E1a.jpg`), saves the GLB into `new/gen/`. Then Claude:
  Blender cleanup (split body / shell / claws / eye stalks / legs, small GLB), animated preview,
  then the crab in games (Krabsy world host, Hatchery thief crabs?). Favicon source:
  `new/gen/fav-1.png`; turnaround: `new/gen/turn-3.png`. Preview page
  `homepage/design-preview/` is local only (untracked).

## ⭐ BIG TODO: 4teachers route (owner, 2026-11-25: "I definitely need to go down this route", start in a few days)

The 4teachers English editor (liko, 4t-Eng-Red.) answered on 2026-11-25 and
**invited** us to add the Krabsy link and to upload worksheets with a Krabsy
footnote. **Not answered yet, nothing uploaded yet. Preconditions met 2026-11-27
(teacher-page tabs, i18n foundation, landing banner are live); ready whenever the owner starts.** 4teachers has 1.78 M
members; its 148 irregular-verb materials are mostly 2004–2012 Word files
without answer keys, the Grammar link list is from 2020, the "Interaktive
Materialien" section has nothing newer than 2014. A competitor
(englishonline.training) added 7 links there in Sept–Nov 2026.
Everything is prepared: `docs/outreach-4teachers-2026-11-25.md` (research,
positioning, step plan, status table). Steps:
1. Reply to liko (draft in that doc; du-form, signed "Jan Ahrens, Entwickler von Krabsy").
2. Link in Grammar → https://krabsy.com/de/unregelmaessige-verben/
3. Upload worksheets "Die drei Formen" + "Lückensätze" (PDFs in
   `homepage/de/unregelmaessige-verben/arbeitsblaetter/`, footer fixed 2026-11-25).
4. Test the class flow once, then upload the teacher guide
   `docs/4teachers/krabsy-vertretungsstunde-unregelmaessige-verben.pdf`.
5. Ask liko about 2–3 deep links; later prepositions sheets + a lesson plan.

## Tutor spaces (2026-11-25, LIVE on hidden links, verified on krabsy.com)

Owner decision 2026-11-25: live with all functions but unlinked; test with Nora
until it's good, then link it. Verified live after deploy (API + site): the full
headless scenario (anonymous play → Lucas's link, Emma on the same device,
"Who's playing?", second device restores, adult page, parents' report without
private notes, homework progress) passed on krabsy.com; DE/ES pages for normal
visitors load no sync code and make no tutor/profile requests. Test space deleted.
Nora starts at https://krabsy.com/en/spanish/tutors/.
**Lesson tools (2026-11-25, LIVE, verified on krabsy.com: plan, live worksheet, answer seen by the tutor, gift; test space deleted):** interactive worksheets (typed
answers count for ★★★★), live lesson (worksheet on the student's screen, answers
live, stars and gifts), lesson builder (plan from the star map → lesson note).
Details: `docs/tutor-platform.md` "Lesson tools as built".
**Email sign-in (2026-11-25, LIVE; mail works with `SMTP_PORT=587`, Hetzner blocks 465; owner feedback round 1 built):** tutors sign up / sign in with a
one-time email link, no passwords (`api/tutor_auth.py`, `api/mailer.py`). Before
deploying: (1) Namecheap DNS for krabsy.com: SPF must include Private Email
(`include:spf.privateemail.com`) and its DKIM record must be added, otherwise mails
from hello@krabsy.com land in spam; (2) Coolify API app env: `SMTP_HOST=mail.privateemail.com`,
`SMTP_PORT=465`, `SMTP_USER=hello@krabsy.com`, `SMTP_PASSWORD` (owner sets it).
Deploy API, then site; then test a real sign-in. Without SMTP, sign-up mails are
only logged, so don't deploy the site before the API has SMTP.


Plan `docs/tutor-platform.md` (tutors = first paying audience; kids and teachers
stay free). Phase 1 built for Nora (English interface, Spanish section):
`/en/spanish/tutors/` (what it is + create a space, secret link `#t=`),
`/en/spanish/tutors/space/` (students; `&s=<id>` = profile: level, goals, notes,
star map per topic with tutor override + note, homework as game/drill links with
progress, lesson notes, personal link), `/en/spanish/me/#k=` (the student's page:
homework from the tutor). Students are hidden classes of one (`api/tutors.py`),
so every answer from any game reaches the tutor through the class pipeline;
`recordAttempt` takes an optional 6th arg `mode` (choice/typed/hint) for the
stars. All noindex, **not linked from any page yet**. Tests: `api/tests/test_tutors.py`
(54 API tests pass); headless browser check of all three pages + a game answer
on the student's device reaching the tutor. Local preview with the API:
`python3 tools/dev_api_server.py` → http://localhost:8010/.
**Accounts round (same day):** homework = topic + goal in answers (child picks
any game; quick practice vs games on the student page), profile (figure, shells,
gifts, stats, game saves) saved to the student's key and restored on other
devices, "Who's playing?" for siblings on one device, adult flag (calm page, no
shells), read-only parents' report link `/en/spanish/report/#r=`. Details:
`docs/tutor-platform.md` "Accounts round as built".
Privacy (2026-11-25): EN/DE/ES privacy pages have a tutor-space section and a
"saved profile" bullet under Classes (class pupils' profiles are saved too);
the "your rights" placeholder now says what is true. Not read by a lawyer.
Before going public: link from the teacher pages, AVV template, lawyer
check of the privacy texts.

## Lesson plans "Unterrichtsideen" (2026-11-25, DE, not deployed)

After a look at the competitor englishonline.training (its edge: ready-made
lesson plans and a school-year structure). Plan: `docs/lesson-plans-plan.md`.
Hub `/de/lehrkraefte/unterrichtsideen/` + 3 plans, each a page and a one-page
PDF from one source (`tools/generate_lesson_plans.py`, needs segno + headless
Chrome; checks every link against `homepage/`): cover lesson on irregular verbs
(45 min, replaces `generate_teacher_guide.py`, also writes the 4teachers copy),
in/on/at (45 min), Quiz-Raum to end a lesson (10–15 min). Linked from the DE
teacher page ("Ideen für die Stunde") and both DE worksheet pages; sitemap
regenerated. ES toggle on these pages goes to `/es/docentes/`.
Next: plans 4–5 (review before a test, a homework week), then ES; owner
decisions open: winter/Christmas lesson this year? Klasse ranges only?

**Devices or paper first (2026-11-28, owner):** the first decision a teacher
takes is whether every pupil has a device. Teacher pages (DE, ES) open the
Loslegen/Empezar tab with "Hat jedes Kind ein Gerät?" — A: devices → the three
ways; B: normal classroom → worksheets + paper lesson + projector tip. Material
tab split into "Auf Papier" / "Am Gerät". Plans carry `mode` (devices|paper),
hub grouped by it; new plan 4 `vertretungsstunde-unregelmaessige-verben-ohne-geraete`
(two worksheets + partner quiz, slips for the English teacher); the device plan is
now titled "… – mit Geräten". /en/spanish/teachers/ has no paper material yet,
so no fork there.

**Worksheets, new look (2026-11-28, rolled out):** owner wants a larger, more fun
worksheet collection with better branding; must work on a B/W copier; current crab
for now (mascot may change). `tools/worksheet_kit.py` = shared look (greys only,
mascot from ONE file `MASCOT`, line icons to colour in, QR footer, crab tip, shell
self-check). `tools/generate_worksheets.py` renders all 7 sheets × DE/ES in it,
same file names. "Die drei Formen" is new: 12 picture cards, 6 middle-form rows,
word search (no other verb form readable in any direction), bonus sentences.
Lesson plans updated to the new sheet. Next: more sheet types (crossword, board
game, comic), pictures for preposition sheets.

## Teacher practice links (2026-11-25, not deployed)

Owner idea: a teacher picks topic, game, difficulty and game language and gets a
permanent link for the class (no account, nothing stored); pupils land on the
normal Krabsy with a "Practice from your teacher" banner. Built for DE, ES and the
Spanish section (CLAUDE.md "Teacher practice links"). Tested headless: the three
builders, links followed into Towers (DE/ES/EN), the games apply difficulty
(Kitchen sentences, Air Control tiers, Fill the Gap, Sprint) and language, pages
without a link unchanged (10 DE/ES pages live vs local identical).
Later: the class code in the link (answers to the class dashboard).

## Phone fixes (2026-11-25, LIVE, verified headless on krabsy.com)

- **Phone fixes (2026-11-25, owner's first phone test):** Verb Kitchen first load
  lighter (chef animations 3 → 0.3 MB, level prefetched on the menu: level 1 ready
  2.7 s after tapping instead of 7.6 s on 10 Mbit). Verb Dungeon plays sideways on
  an upright phone (`src/rotate.js`) instead of "turn your device". Game pages
  hide the site header on short landscape screens (`krabsy-game-info.css`).
  Headless-tested; not yet on a real phone.

## Spanish pilot + question format v2 (2026-11-24, LIVE)

Direction: `docs/vision.md` (curated grammar in any learning language,
universal games, teacher tools). Trigger: a Spanish teacher (Nora, 1:1
Zoom lessons with children, English-speaking pupils) wants Krabsy for
Spanish.
- **Format v2** (`content/FORMAT.md`): topic registry in `krabsy-data.js`
  (`learn` language per topic), gap-topic files with hints/teach notes per
  interface language; engine takes `lang`. Existing topics unchanged.
- **First topic `es_ser`** (`content/es-ser.json` → `homepage/data/`):
  "Yo soy …" with name, origin, describing yourself; 8 items, 38 questions,
  A1. **Draft: waiting for Nora's check** (`docs/es-ser-revision-nora.md`,
  in Spanish, with 4 open questions).
- Wired into the **Quiz Room** (topic choice + EN/DE/ES names; the editor
  fills small topics with more sentences per item) and `api/classes.py`
  TOPICS. Full quiz passes headless in English (`qa-room` 2 children,
  `qa-editor` 14/14, API 50 passed).
- **Live 2026-11-24** (site + API deployed; checked headless on krabsy.com:
  teacher page lists the ser questions in English, no errors). Nora's link: `https://krabsy.com/games/quiz-room/teacher.html?topic=es_ser&lang=en`
  (the children's join link carries `lang=en`). No public page, no
  games.json/sitemap change on purpose.
- **English section `/en/spanish/` (LIVE 2026-11-24, noindex pilot,
  checked live headless):** landing page (hand-written), `ser/sprint/` and
  `ser/fill-the-gap/` (generated by `tools/build_en_spanish.py` from the DE
  preposition drills; re-run after changing those), `/en/privacy/`
  (translation of the German page), `data/ui_en.json` (full English UI
  strings + `topic_overrides.es_ser`). Footer knows `/en/` (legal links,
  no catalogue grid). Fill the Gap: format-v2 topics, English texts,
  accents optional when typing Spanish, hint behind "?". Verb Towers plays
  es_ser; **since 2026-11-24 it's in the section** (`/en/spanish/games/verb-towers/`,
  topic texts per topic, explanations in the game's language).
- **Three more Spanish topics** (2026-11-24, drafts for Nora): `es_estar` (25 sentences),
  `es_ser_estar` (21), `es_tener` (18), each with a topic page, Sprint + Fill the Gap,
  in all three games and the Quiz Room. Games choose their texts by learning language
  now (any `es_…` topic); game pages play `?topic=` or the last topic visited
  (`krabsy_es_topic`), with a topic bar under the game. Review sheet:
  `docs/es-revision-nora-estar-ser-estar-tener.md` (`tools/es_review_sheet.py`).
  **Needs the API deploy too** (`api/classes.py` TOPICS).
- **Section rebuilt on the site's own templates** (2026-11-24, owner: "same style,
  same layout as the original pages"): landing on the /de/ skeleton (featured
  game, filterable grid, practice band, teacher strip), games hub, topic hub
  `/en/spanish/ser/`, game pages with the info section and the game chip bar,
  drills with the normal chip bar. Catalogue-driven (topics.json `es_ser`,
  games.json `en` texts + `featured_langs`). DE/ES unchanged (render diff
  empty; 10 pages live vs local: same chips, footer links, no errors). See
  CLAUDE.md "Sections".
- **Verb Kitchen plays Spanish** (2026-11-24): sentence topics at the sink (one
  plate = two sentences of one item), Sentence Cookbook, per-topic texts;
  `/en/spanish/games/verb-kitchen/`, first game card on the landing page.
- **Verb Platformer plays Spanish** (2026-11-24): one sentence per gate, sign fits
  sentences, rule after a miss, stats under the topic, level tiers cap the sentence
  difficulty; `/en/spanish/games/verb-platformer/`. The section now has 3 games
  (Kitchen, Towers, Platformer) + Quiz Room + 2 drills.
- **Game briefs** (Golf, Catapult, Hatchery) got a required "Topics and
  languages" section 2026-11-24: any topic, `lang` passed, gap display,
  topic-neutral replacements for the verb-pair mechanics.
  Not in the sitemap, games.json or nav on purpose. **To go public:**
  Nora's OK on the content, then remove noindex (landing page +
  `NOINDEX` in the generator), add sitemap URLs, IndexNow.
- Privacy page TODOs carried over from the German page: hosting provider
  ("Hetzner?") and "last updated" date are still marked TODO there.

## Games

| Game | Type | Source | Served at | Status |
|------|------|--------|-----------|--------|
| Verb Slash | single-file canvas | `games/verb-slash/` (+ inlined wrapper) | — (wrappers kept, noindex) | **OFFLINE since 2026-11-23** (owner: 2D games look weak next to the 3D ones; median 0:39, colour tell from the play test) — out of games.json, hubs, related lists, sitemap; can come back with a redesign |
| Crab Slash | single-file canvas | `games/crab-slash/` (+ inlined wrapper) | — (wrappers kept, noindex) | **OFFLINE since 2026-11-21, parked** — play-test: core rule broken (other verbs' correct forms count as wrong); redesign notes in `games/crab-slash/CLAUDE.md` |
| Verb Snake | 2D canvas (several files) | `games/verb-snake/` | `/de/spiele/verb-snake/` (build at `/games/verb-snake/`) | **LIVE, overhauled 2026-11-23** — sunny garden, toy snake, food sprites, rounds of 5 verbs with stars, coloured chain beads + top tracker, 1/2/3 badges in round 1, teaching card after a wrong eat, start demo, DE/ES/EN, game events, smart verbs + recordAttempt; ~270 KB. Old single file `homepage/krabsy-verb-snake.html` no longer used by the wrappers (kept for old direct links). Not tested on a real phone yet |
| Air Control | single-file canvas | `homepage/krabsy-air-control.html` | `/de/spiele/air-control/` | **live** (beta) — 2026-11-16: DE/ES UI, legend no longer uses grammar terms. 2026-11-21 (**deployed**, live file verified): no ①②③ answer tell (planes all white, word only; panel shows go → ___ → ___), phone-legible labels/bubbles/hints, safer spawn lanes on phones, level-complete screen auto-continues after 8 s, same-word forms (run/ran/run) take the earlier slot. Still to check on a real phone |
| Verb Platformer | 3D (Three.js) | `games/verb-platformer/` | `/de/spiele/verb-platformer/` (build at `/games/verb-platformer/`) | **LIVE 2026-11-22 (beta)** — 6 JSON levels, art passes 1–2, game shell (stars, results, pause, DE/ES/EN), chain-order questions, 7.8 MB build; in games.json/hubs/sitemap, IndexNow sent. Verified live in headless Chromium (0 errors). Not tested on real devices yet (laptop GPU, tablet/phone touch). Details in `games/verb-platformer/CLAUDE.md` |
| Verb Flow | single-file canvas | `homepage/krabsy-verb-flow.html` (iframed) | `/de/spiele/verb-flow/` | **RELEASED 2026-06-12** (beta) — engine-refactored same day: 154-verb pool. 2026-11-16: thumbnail added, first-run interactive tutorial (+ "How to play" replay), fixed always-visible PERFECT badge / Restart button. DE/ES UI |
| Verb Towers (Tower Defense) | 3D (Three.js, hex board) | `games/tower-defense/TowerDefense3D/` | `/de/spiele/verb-towers/` (build at `/games/tower-defense/`) | **RELEASED 2026-11-22** (master) — 6 levels, DE/ES, featured on the landing pages with NEU until 2027-02-28; records every forge answer + smart mix (phase 1). Build copied at e3cf757 (zoom and pan, 5 questions per wave, upgrade badge, download retries, game events). Re-copy `TowerDefense3D/` → `homepage/games/tower-defense/` after each game change |
| Verb Dungeon | 3D dungeon crawler (KayKit) | `games/verb-dungeon/` | `/de/spiele/verb-dungeon/` (build at `/games/verb-dungeon/`) | **RELEASED 2026-11-22** (owner: "it can go live") — build e65a832 (3 levels, 3 bosses, 4 heroes, touch, DE/ES/EN), 7.2 MB (first load ~3.4 MB); status ready (no Beta labels), devices phone_ok (landscape). Build updated to **baeb208**: answers recorded (stats, classes, analytics) + smart verbs, game events (level_start, room_done, player_dizzy, boss_round, level_end), book and key in any order. Not tested on a real tablet/phone |
| Verb Climb | 2D tower-climb platformer | `games/verb-climb/` | — | **PARKED (owner 2026-11-21, 2D)** — PoC built, many playtest iterations (Trackmania-style levels/medals) |
| Verb Valley | 3D farming life-sim (Stardew-like) | `games/verb-valley/` | — | **GO (owner 2026-11-21): build the full game** — PoC built 2026-06 (3 playtest rounds, KayKit rebuild); new brief in its `CLAUDE.md` (spread grammar through the day, touch, DE/ES; `assets/` must be restored first); own session opens in `games/verb-valley/` |
| Verb Runway | 2D paper-doll dress-up (DTI-like) | `games/verb-runway/` | — | **PARKED (owner 2026-11-21, 2D)** — PoC built; art contact sheet never judged |
| Sim Tower / Krabsy Block | 3D city-block sim (KayKit) | `games/sim-tower/` (+ `archive-tower-version/`) | — | **PARKED (2026-11-21)** — cozy tycoon: you own a city block, build shops and homes, residents walk around; quiz bolted on. Merged from the old `sim-tower` branch 2026-11-21; last worked on 2026-07/08; concept in `krabsy-block-concept.md`. Models (16 MB) are gitignored in `games/sim-tower/assets/` |
| Verb Golf | 3D mini golf (KayKit Platformer pack) | `games/verb-golf/` | — | **CHOSEN (owner 2026-11-22), not started** — floating-island holes, a question before every stroke (wrong = +1 penalty stroke), word gates from level 2, par = stars, 6 levels × 3 holes. Brief in its `CLAUDE.md`; own session opens in `games/verb-golf/` (dev port 8140) |
| Verb Catapult | 3D catapult physics (Angry Birds-like; KayKit Medieval Hex + Skeletons) | `games/verb-catapult/` | — | **BRIEF (owner 2026-11-22), not started** — knock down skeleton forts; 2nd form right = a stone, 3rd form right = a special stone, wrong = the stone crumbles; 2D physics (planck.js) in a side view drawn in 3D; 6 levels × 3–4 castles. Brief in its `CLAUDE.md` (dev port 8141) |
| Quiz-Raum / Sala de quiz (Quiz Room) | 3D online quiz room, every child on their own device | `games/quiz-show/` (+ server `api/quiz_room.py`) | `/de/spiele/quiz-room/`, `/es/juegos/quiz-room/` (build at `/games/quiz-room/`; teacher page `/games/quiz-room/teacher.html`; children's short link `/quiz/`) | **LIVE 2026-11-22** (API + site deployed; checked live: teacher page, room on `wss://api.krabsy.com/api/quiz/ws`, child via class page → room, answer scored; IndexNow sent). **Not play-tested by people yet** (owner: release first). games.json entry (NEU until 2027-02-28), hub tile + JSON-LD, teacher pages DE/ES (section + CTA), privacy pages (Quiz-Raum section), class dashboard source label, sitemap. Owner decisions 2026-11-22: name, answers into stats + class, QR code. 2026-11-22 later: the room grows with the group (scale 1.0 / 1.25 / 1.5 at 16 and 29 players; server + client). Still open: real-class play-test, Chromebook frame rate. Re-copy `games/quiz-show/{index.html,teacher.html,src,vendor,assets,fonts}` → `homepage/games/quiz-room/` after each game change. Brief: `games/quiz-show/CLAUDE.md` |
| Figure builder ("Meine Figur") | 3D character editor (KayKit parts + colours) | `games/figure-builder/` | — (local :8145) | **PROTOTYPE 2026-11-25** — owner idea: every child builds their own figure for the platform (no weapons). Mixes parts of 13 KayKit figures on one skeleton, recolours skin/hair/outfit; saved on the device. Platform plan (owner 2026-11-25): the figure becomes the main character in all 3D games (Verb Towers: the builder), shells 🐚 earned across all games unlock characters/accessories, later a 3D Krabsy world as an extra entrance — **`docs/figures-shells-world.md`** (owner decisions open: shell name, earning rules, free set, prices, Dungeon sword). Brief in its `CLAUDE.md` |
| Verb Hatchery | 3D third-person egg & creature collector (Roblox "Steal an Egg"-like loop; Quaternius nature, KayKit/Kenney props, 60 Quaternius creatures) | `games/verb-hatchery/` | `/de/spiele/verb-hatchery/`, `/es/juegos/verb-hatchery/` (hidden, noindex, direct link only) | **TESTER RELEASE (2026-11-25, owner: direct link for testers, not shown on the homepage)** — island with Meadow / Forest / Beach / Volcano (stars open zones), eggs → questions (rarer = harder verbs, smart mix), egg trail, thief crabs + raids on the base, 60 creatures + golden versions, Creature Book + words to practise, Hall of Fame in the barn, daily egg, levels, upgrades, first-minutes guidance, music, optional typed answers, DE/ES/EN. Not in games.json / sitemap. Public release steps in `games/verb-hatchery/RELEASE.md`. Not checked: real Chromebook/tablet, music by ear. |
| Verb Kitchen | 3D Overcooked-like (KayKit Restaurant Bits) | `games/verb-kitchen/` | `/de/spiele/verb-kitchen/` (build at `/games/verb-kitchen/`) | **RELEASED, live build = source (2026-11-23 release)**: 8 levels (Salad, Burger, Pizza, Co-op, Split Kitchen, Soup, Sundae with scoop tool, Sandwich Bar), DE/ES UI via `?lang=` (wrapper iframes pass it), Verb Cookbook, 2 answers per plate (one verb, both forms), download retry, bot-calibrated star times. Assets = exactly `games/verb-kitchen/release-assets.txt` (284 files, 8.8 MB). Owner play-tested 2026-11-23. Open: L4–L8 still `open: true` (no star gate); hint pills say "E —" on touch — in the catalogue since 2026-06-16 (`games.json` status `beta`); confirmed released by the user 2026-11-12 after the first organic classroom use (Uruguay, Plan Ceibal/Schoology, 2026-11-12: ~10–12 concurrent sessions, 7–12 min each) |

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
- **Verb Golf** was picked on 2026-11-22 from six new ideas (the others:
  Verb Arena turn-based battles, Haunted Hotel for prepositions, Building
  Site, Campsite, Train Yard). It's in the games table now.
- **Proven formats (owner 2026-11-22):** the owner prefers copying proven
  game mechanics over new inventions (gameplay only, our own name and art).
  Briefs written for an Angry Birds-like (**Verb Catapult**) and a
  Kahoot-like class quiz (**Krabsy Quiz Show**). Other proven formats
  listed: Peggle, bubble shooter, Sokoban, Cut the Rope, Battleship,
  Ludo/party board game, match-3, whack-a-mole.
- **Roblox research (2026-11-22):** top loops are collect/tycoon (Steal an
  Egg, Steal a Brainrot), Grow a Garden, fishing (Fisch, Fish It), pet care
  (Adopt Me), survival nights (99 Nights), dress-up (Dress To Impress).
  Owner picked the egg collector → **Verb Hatchery** brief. Also suggested:
  rebuild Verb Valley's core around the Grow a Garden loop (real-time
  growing, come back tomorrow).

**Play-test 2026-11-21** (`docs/playtest-2026-11-21.md`):
- Crab Slash → **hidden 2026-11-21**.
- Drag Match and Falling Forms → small layout fix (start button below the
  fold, ✕ leaves the site).
- Verb Slash → fix the colour tell and slow start.
- Air Control → small fixes — **done and deployed 2026-11-21**.
- Verb Flow → keep.
- Owner decisions pending.

## 2D games review (owner, 2026-11-23)

The 2D games look weak next to the 3D games. Decision, based on median time
on page (play-test report 2026-11-21): **Verb Snake** (2:09, longest of all)
stays and gets a full visual overhaul — brief `games/verb-snake/CLAUDE.md`,
own session. **Verb Slash** (0:39, colour tell) is offline. **Verb Flow**
(0:22, mostly before its tutorial) and **Air Control** (0:39, fixed
2026-11-21) are measured with the new dashboard until **~2026-12-07**
(median engaged time per game page, answers, % right; Flow needs its phase-1
wiring to show answers). Rule: median below ~1 min → offline or overhaul.

## Classes for teachers (phase 2, built 2026-11-22)

**Live since 2026-11-22** (API + site deployed; a round trip create → join → answers → dashboard → delete passed on krabsy.com with a test class, deleted afterwards).

Teachers create a class without an account (code for pupils + secret
dashboard link), pupils join with code + first name (same name twice: "that's me" or add the surname's initial, e.g. "Mia S."), every recorded answer
goes to the class, the dashboard shows hard words per class and per child.
Details: `docs/classroom-concept.md` → "Phase 2 as built". **Deploy: API app
first (new endpoints + SQLite in /data), then the site.** Open: legal
review of the new privacy section + AVV template; word lists; phase 3.
Answers only reach classes from games wired in phase 1 (drills, Snake, Air
Control, Verb Towers).

## Analytics (api.krabsy.com, upgraded 2026-11-22)

**Deployed 2026-11-22, live** (API + site; Verb Towers events live from build c14b871).

- **Answer counts:** every `recordAttempt()` also tells the page tracker
  (`krabsy:attempt` DOM event / postMessage from game iframes); heartbeats
  carry `answers`, `correct`, `answer_source` (running counts, no content).
- **Game events:** `/lib/krabsy-game-events.js` `gameEvent(game, name, data)`
  → tracker → `event_type: game_event` (server keeps only slug keys and
  numbers/short slugs). Spec and per-game proposals: `docs/game-analytics.md`.
  **Verb Towers sends all 8 events since c14b871** (level_start/end,
  wave_start/end, tower_built/upgraded/sold, not_enough_coins); other games follow.
- **Dashboard:** new "This week" (last 7 vs previous 7 days: visitors,
  engaged, classroom sessions, game minutes, answers, % right, top games),
  "Learning activity", "Games in detail" (per level: started / won / lost /
  left, win rate, minutes, answers, wave where players left; all other
  events per level), "From the landing page" (next page after /de/, /es/).
- **Per-IP rate limit 60 → 600 events/min:** a class behind one school IP
  sent ~100 heartbeats/min, so classroom data was silently dropped before.
- Privacy pages DE/ES updated (Stand 22.11.2026). Tracker import bumped to
  `?v=2026-11-22` on all pages and in `tools/generate_verb_pages.py`.
- Tests: `api/tests` 34 pass (7 new in `test_learning_games.py`); end-to-end
  checked in headless Chromium (Verb Towers iframe + Sprint).
- **Deploy order: API app first, then the static site** (the old API would
  store the new `game_event`s as page views).

## Game art (2026-11-22)

3D games get key art in the Verb Kitchen style (same three chibi heroes,
warm toy-like 3D), made with Gemini (`gemini-3-pro-image`, Kitchen hero
image as style reference; key in the gitignored root `.env`, billing on).
Done: Verb Towers, Verb Platformer, Verb Dungeon (its "Bald" tile).
Files: `thumbnails/hero/<id>.jpg` 1200×675 + `thumbnails/sm/<id>.jpg`
640×360; originals in `_incoming/<id>-art/`. 2D games (Snake, Flow) keep
flat title cards; Slash and Air Control are already illustrated.

## My figure + shells (figures plan part 1, steps 2–4, built 2026-11-25)

Plan + owner decisions: `docs/figures-shells-world.md`. Pushed 2026-11-25 (060dc7e … 65e43e4), deploy pending.
- **Shells** 🐚 (Muscheln / caracolas / shells): counted in `krabsy-stats.js` `recordAttempt` via `lib/krabsy-shells.js` (`localStorage krabsy_shells_v1`): +1 per right answer, +1 for a new/weak item (mastery ≤ 2), never taken away, after 200/day 1 per 3 right. Header counter (krabsy-nav / footer), hidden until the first shell.
- **Figure page** `/de/meine-figur/`, `/es/mi-personaje/`, `/en/my-figure/` (EN noindex): builder (first with locks/prices/unlock; since the same day owned things only, see "Rewards instead of a shop" below). 12 free characters (`FREE_CHARS` in `lib/krabsy-figure.js`; owner swap before launch: Wichtel Helper_A free, Superhero 200). Never move a free id into `PRICES`.
- **Builder with four tabs (owner request, built 2026-11-25, not pushed):** 1 Figur wählen (all figures, sections Menschen / Fantasy / Monster & Roboter), 2 Zubehör (hat, glasses, back: tiles with a picture of the object, "★ Original", "nichts"), 3 Haut & Haare, 4 Kleidung. Tabs are built when first opened (pictures lazy). Phones: figure + tab bar stick under the header, Save/Random/Reset stick at the bottom. Accessory pictures `homepage/assets/figures/items/<slot>-<id>.webp` (33 files, 142 KB) from `node tools/render_accessory_thumbs.cjs [--sheet out.png]`; run it again after adding an accessory. A character's own accessory (Hiker's cap) is shown once, as "★ Original", not again with a price. Characters no other hat fits show a note instead of the hat tiles.
- **Skin tones:** the two darkest (`#7d4c2e`, `#563322`, index 4 and 5) are gone (owner: black eyes disappear). `normalize()` maps a saved 4 or 5 to 3 (`#a86c45`); checked in Dungeon, Platformer, Egg Island. Don't reorder `SKIN`. Open: palette colours render darker on the figure than their swatch (`recolor()` in `krabsy-figure.js` takes `new THREE.Color(hex)`, which is linear, and writes it into an sRGB canvas); not changed, it would change every saved figure's look. Owner decision.
- `?v=`: figure page CSS/JS `2026-11-25b`; the page imports `krabsy-figure.js?v=2026-11-25b`, everything else imports it bare (1 h browser cache).
- **For games:** `loadPlayerFigure({ fallback })` in `lib/krabsy-figure.js`, rules in `docs/game-contract.md` ("The player's figure"). Assets `homepage/assets/figures/` (17 MB, one character per game). No game uses it yet; next: Verb Hatchery, then Platformer, Quiz-Raum (after the Chromebook check), Kitchen, Dungeon (sword stays a Dungeon item), Valley; Verb Towers builder figure.
- Not verified: real devices, a real in-game answer, Spanish wording by a native speaker.

## Rewards instead of a shop (owner decision 2026-11-25, built 2026-11-25, not pushed)

Owner: the shop with 42 figures and 33 accessories, locks and prices was overwhelming. Nothing is bought any more; details and the exact rules in `docs/figures-shells-world.md` ("Rewards instead of a shop"). **This replaces the locks / prices / unlock dialog described in the section above.**
- **Figure page** shows only what the child owns (12 free figures, each figure's own accessories, colours, everything won): "12 von 42 Figuren gesammelt", "0 von 33 Zubehör gesammelt", one "?" tile per grid that explains how to get more, "Neu" badges on new gifts until their tab was opened. One grid for the figures (no group headings).
- **Gifts** (a random figure or accessory not yet owned), `lib/krabsy-rewards.js`: every 150 shells collected (lifetime `earned`); milestones (50 / 200 / 500 / 1000 right answers, 10 / 50 words that sit, Verb-Diplom bronze / silver / gold, a second topic); 3 / 7 / 14 / 30 practice days (a day with ≥ 10 answers, days need not follow each other); one per new calendar week with a practice day, from the second week on; found in a 3D game (`grantGift` / `pickGift`, `docs/game-contract.md` "Gifts found in a game", max 2 per game and day; **no game uses it yet**, the child-facing texts say "bald"). Old prices = rarity (chance (cheapest ÷ price)²), 40 % figure / 60 % accessory, first gift always a figure. First run for a child who already practised: at most 5 gifts, the rest counts as given.
- **Gift card** "Neues Geschenk! 🎁" (`lib/krabsy-gifts-ui.js`, loaded by the header counter): bottom of the next site page, non-blocking, once per gift, several in one card; not on game pages (`header.k-game-nav`) or in iframes, there the counter gets a 🎁 dot.
- **Shells** are not spent: header counter, landing card and profile show the lifetime number (`earned`); `balance` and `unlock()` stay in `krabsy-shells.js` for cached pages and old builds. Everything in `krabsy_shells_v1.owned` stays owned. New key `krabsy_rewards_v1` (own key because older cached `krabsy-shells.js` copies rewrite `krabsy_shells_v1`).
- **Profile:** shells, bar to the next surprise, collected counts, "Deine Geschenke" (last gifts, next goals with bars, today's practice-day count).
- **Catalogue moved** to `lib/krabsy-figure-catalog.js` (ids, free set, rarity, names DE/ES/EN; no three.js); `krabsy-figure.js` re-exports it, so games and bare imports work as before. `FREE_CHARS` in `krabsy-me.js` is still a hand copy.
- **Answers count in `recordAttempt()`** (`krabsy-stats.js` loads `krabsy-rewards.js` on demand), so games in iframes count too.
- `?v=`: figure page JS/CSS `2026-11-25d` (imports `krabsy-figure.js?v=2026-11-25d`), profile JS/CSS `2026-11-25d`, `krabsy-landing.js?v=2026-11-25j`, `krabsy-stats.js?v=2026-11-25` (28 files). `krabsy-shells.js`, `krabsy-rewards.js`, `krabsy-gifts-ui.js`, `krabsy-figure-catalog.js` are loaded without `?v=` (1 h browser cache): the gift dot and card arrive within the hour after a deploy.
- Checked headless (390×844, 1024×768 touch, 1366×768; DE / ES / EN; 0 console errors): new child, 400 shells (gifts on load, card once, "Neu" badges), milestones and practice days by seeded stats and a faked clock, `grantGift` from the Verb Platformer iframe (card on the next page), an old save with bought things, landing arrows with a won figure.
- Open / owner: real devices; Spanish wording by a native speaker; whether the free figures' own accessories should be wearable on every figure (now only as "★ Original" on their figure, so a new child starts with 0 of 33); which game hides the first gifts.

## Profile page "Mein Profil" (was "Mein Krabsy") + new landing top (built 2026-11-25, not pushed)

Owner decisions 2026-11-25: one overview page for the child, the figure builder stays its own page; the big featured banner on the landing pages goes.
- **Profile page** `/de/profil/`, `/es/perfil/`, `/en/my-profile/` (old /mein-krabsy/ etc. forward) (EN noindex). `lib/krabsy-profile.js` + `lib/krabsy-profile.css`; everything is read from localStorage: figure (`krabsy_figure_v2`; picture first, the live 3D figure only for a child with a saved figure, after page load, not with "save data"), shells (`krabsy_shells_v1`: balance, today, total), overall accuracy + streaks and per topic of the section accuracy / "x von y sitzen schon" / words to practise with links (`krabsy_stats_v2`), Verb-Diplom (`krabsy_verb_diplom`), games (each game's own save, table `GAME_SAVES` in krabsy-profile.js), class badge (`krabsy_class`), device note. New visitors get "Bau deine Figur" / "Spiel ein Spiel". The verbs statistics page stays and is linked as "Mehr Zahlen zu den Verben →".
- **Shared:** `lib/krabsy-me.js` (profile/figure URLs, `savedChar()`, `portraitUrl()`, `classSession()`, `itemLabel(topic, id)` for readable labels: verbs = the word, prepositions = "at the bus stop", Spanish topics = the item's `label`). The landing uses it too.
- **Landing `/de/`, `/es/`, `/en/spanish/`:** the dark banner is replaced by one row: the featured game as a wide tile (`.gt.gt-wide`, from `landing_featured` in `tools/render_static_games.py`) and a profile card (`#gl-profile`, hand-written in the three pages, filled by `krabsy-landing.js`). The progress row's link goes to the profile ("Mein Fortschritt →").
- Header shell counter → profile page (`krabsy-shells.js`); language switch knows the page; sitemap has DE + ES.
- Fixed on the way: the verbs statistics pages (DE + ES) threw on a removed element (`#stats-back-link`) and stayed empty.
- `?v=`: `krabsy-shells.js` is loaded without `?v=` (by footer, nav, stats), so the counter's new link arrives when the browser cache (1 h) expires. `krabsy-lang-switch.js` was bumped only on the profile and figure pages (the new entry matters only there), not on the other ~420 pages.
- Not verified: real devices; Spanish wording by a native speaker. A game that changes its save format shows "Noch nicht gespielt" on the profile until `GAME_SAVES` is updated.

## Live 2026-11-25: profile, figure in 3 games, Egg Island, slim landing

- **"Mein Profil" (was "Mein Krabsy")** `/de/profil/`, `/es/perfil/`, `/en/my-profile/` (old /mein-krabsy/ etc. forward) (EN noindex): figure, shells, progress per topic, Verb-Diplom, game stars (`GAME_SAVES` in `lib/krabsy-profile.js`: update it when a game changes its save format), class badge. Shell counter + "Mein Fortschritt →" link here.
- **Landing:** featured game = wide white tile + profile card; tiles show picture + name only (taglines/badges visually hidden).
- **Player figure live in:** Verb Dungeon (sword = Dungeon item; coin hero shop removed, bought heroes → Barbarian / Rogue_Hooded / Cleric + wizard hat), Verb Platformer (fallback Ranger, no quiver), Egg Island (fallback Protagonist A/B). Still to do: Quiz-Raum (after class Chromebook test), Verb Kitchen (after its L4–8 + DE/ES release), Verb Towers (builder figure, new feature), Verb Valley.
- **Egg Island** = renamed Verb Hatchery (home base Hof / granja / farm); id and URLs stay `verb-hatchery` until the public release. Tester links + Spanish section (`/en/spanish/`, Nora's link builder) only.
- `tools/stamp_game_modules.py` also handles a root `./main.js` (Platformer). Platformer build: `tools/build-release.cjs` (needs a server with /lib, /data, /assets/figures).
- Checked live: files match, figure shows in Platformer + Dungeon with a saved figure, 0 errors; IndexNow sent.

## Teacher pages + teacher-only games (2026-11-23, live)

- `/de/lehrkraefte/` + `/es/docentes/` redesigned (ef2918b, Fable subagent): image hero, three ways (share link / Quiz-Raum / create class), Quiz-Raum block, drawn class-dashboard example, starting-point cards, condensed why/share/ideas/privacy, FAQ unchanged. Shared CSS `lib/krabsy-teachers.css`. Spanish body copy uses tú; two FAQ answers still usted (kept equal to JSON-LD).
- `games.json` `audience: "teacher"` (quiz-room): skipped on the landing grid/featured, in the in-game chip bar and the "Probier auch das" strip; hub + topic hubs show a "Für Lehrkräfte / Para docentes" badge. Landing join line has a second link to `/quiz/` (fee6da0).
- Verb Snake thumbnails renamed to `sm/hero/verb-snake-v2.jpg` (the old URL was browser-cached for 7 days). Old files kept for cached pages.
- Deployed and checked live 2026-11-23; IndexNow sent.

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
`docs/classroom-concept.md`. **Phase 1 in progress.** Shared pieces built
2026-11-22 (deployed): `lib/krabsy-smart.js` (the mix),
`smart: true` + `ids` + `item` field in `getQuizSet` / `getChainSet`,
`onAttempt()` listener + `readTopicItems()` in `krabsy-stats.js`; tested by
node script and in headless Chromium. **Verb Snake and Air Control wired 2026-11-22** (tested in headless Chromium:
smart queue picks the practice verbs, answers recorded right/wrong; **deployed 2026-11-22**, live files
identical to the repo, both games load without console errors). Next: the other games — recipe and
per-game table in `docs/phase1-game-wiring.md` (
Flow, Slash, Kitchen, Towers, Dungeon, Platformer = their sessions; pointer
added to the clean game CLAUDE.md files, not yet to verb-dungeon and
verb-platformer, which had uncommitted edits). **Drills on the smart mix 2026-11-22** (not
pushed yet): Sprint ×4, free practice "all" ×4, verb flashcards ×2, via
`getQuestions({ smart })` / `pickSmartItems()` in `krabsy-data.js`
(import bumped to `?v=2026-11-22` on those pages). Not yet: prepositions
flashcards, and the speed drills in `homepage/games/*.html`, which record
nothing. Open owner decisions listed at the end
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

- **2026-11-22 (SEO chat, deployed + IndexNow 13 URLs, HTTP 200):**
  - Verb hubs rebuilt for the main queries after a competitor check
    (`docs/seo-hub-pages-competition-2026-11-22.md`): full static table of all
    172 verbs under the H1, pattern section, FAQ (+JSON-LD), query titles/H1
    (also in ui_de/ui_es.json, which the hub JS re-applies). Generator:
    `tools/render_hub_verb_table.py` (rerun with the catalogue).
  - Worksheets: verb list by pattern, forms sheet, gap sentences (DE/ES PDFs with
    answer keys) + download pages `/de/unregelmaessige-verben/arbeitsblaetter/`,
    `/es/verbos-irregulares/fichas/`, linked from hubs and teacher pages.
    Generator: `tools/generate_worksheets.py` (`--no-pdf` = pages only). Open: QR
    codes, licence (CC BY-NC-SA would open OER portals), more sheets.
  - Both hubs are indexed in Google (URL inspection); the issue is ranking.
  - Snapshot of GSC coverage + Bing to 11-20: `docs/seo-snapshot-2026-11-22/`.
    Copilot citations rising (69→129/day Sep→Nov); Bing search impressions down
    ~35 % since late Oct (before the deploy; likely school-year end in LatAm).
  - Case study einmaleins.de network: `docs/seo-case-study-einmaleins-2026-11-22.md`
    (links mainly from school "useful links" pages, worksheets, one keyword per page).
  - Ad placeholders removed from all pages (owner OK, deployed later the same day).
  - Later the same day (committed, NOT yet deployed): preposition worksheets
    (`/de/praepositionen/arbeitsblaetter/`, `/es/preposiciones/fichas/`), verb sheet
    "sort by pattern", teacher blocks on 7 game pages and 7 drill pages
    (`tools/render_teacher_notes.py`, TEACHER in `tools/game_info_content.py`).
  - **School/link-list outreach research (2026-11-22):** `docs/outreach-schools-2026-11-22.md`
    — batch 1 of 10 targets + DE/ES templates; nothing sent yet.
  - **Verb-Diplom LIVE (deployed 2026-11-22; IndexNow 8 URLs, HTTP 200; live headless run OK — 2 test runs from it are in the game-event analytics):** `/de/unregelmaessige-verben/verb-diplom/`,
    `/es/verbos-irregulares/diploma/`; logic in `homepage/lib/krabsy-verb-diplom.js` + `.css`.
    Brief (with the review fixes: 15/30/45 verbs, 90 % pass mark, stops early) in
    `docs/brief-verb-diplom.md`. Linked from both hubs (drill card), teacher pages (pick
    card), verb worksheet pages; topics.json `verb-diplom`; sitemap regenerated (408 URLs).
    Checked headless: pass/fail, alternates, early stop, events, one-page A4 PDF, phone layout.
    Open: human play-test, real print in Firefox/Safari, owner OK on levels; thumbnail
    `/thumbnails/VerbDiplom.svg` is a placeholder (not in the crab illustration style).

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

- **Optional teacher sign-in "Klasse sichern" (decided 2026-11-27, not built):**
  no account for links/Quiz Room/material; classes work without an account,
  with an optional passwordless email sign-in (reuse tutor sign-in) to keep
  classes across devices and recover lost links. Decision + reasons:
  `docs/classroom-concept.md` "Decision: teacher accounts".

### Parked 2026-11-25: staged rollout for new games (owner: "not needed now")

Idea for when there is a real player base, so a weak game doesn't reach everyone at once (like einmaleins.de testing in a small country, but with one domain):
- **Steps:** unlisted (link to 2–3 known teachers/classes) → one language only (`/es/` or `/de/` = our "small country") at 20–50 % of visitors → that language fully → both languages.
- **Mechanism:** `games.json` field such as `"rollout": {"es": 0.3, "de": 0}`. A random bucket per browser, saved in localStorage, decides whether the tile shows; the game's own page always works (teachers' links). Keep the game out of the sitemap until fully released.
- **Gate per step (~1 week, dashboard game events):** median time > ~1:30, ≥ 50 % finish level 1, < 25 % quit in the first 30 s, enough answers per session, no Chromebook frame-rate or error reports.

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
5. **Outreach:** Aula PT sent 2026-11-22; Lehrerfreund dropped (no English); 4teachers sent 2026-11-22. See
   `docs/outreach-list.md`. Eduthek declined (Moodle courses only);
   friendly reply sent 2026-11-22, door left open. Idea for later (review
   in December): one CC-licensed "Irregular Verbs" pack (printable list +
   exercises) for free-education (OER) portals (Eduthek, WirLernenOnline
   OER, …), each linking to krabsy.com.
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

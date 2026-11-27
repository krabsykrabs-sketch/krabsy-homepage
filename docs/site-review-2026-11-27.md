# Site review krabsy.com — 2026-11-27

Read-only review of the live site. Nothing in the repo was changed apart from this file.

**Screenshots:** `/tmp/claude-1000/-home-janah-dev-krabsy-homepage/04e81bcf-8a57-4915-948f-cbe3e5a504f9/scratchpad/review/` (file names below are in that folder; the scratchpad can be cleared by a reboot, so copy what you want to keep).

## How it was checked

- **Crawl:** all 422 sitemap URLs plus every statically linked page (504 URLs, 98 assets): status, title, description, canonical, hreflang, robots.
- **Rendering:** 162 page types (every non-verb page in `/de/`, `/es/`, `/en/`, `/quiz/`, the Quiz-Raum views, 7 sample verb pages) in headless Chromium at 390×844 touch, 1024×768 touch and 1366×768. `krabsy_notrack` was set and `api.krabsy.com` was blocked.
- **Measured per page:** console errors, failed requests, external hosts, horizontal overflow, page height, emojis in text, computed contrast, small tap targets, fixed elements.
- **Navigation:** language switch clicked on every DE/ES page; flag menu, tab bar and header links read on 6 pages per size.

**Not checked:**
- Anything that needs the API: class dashboard with data, tutor space after sign-in, the student page `/en/spanish/me/` with a valid link, a running quiz room.
- The gift popup, and the figure jump over the header (both need a seeded child or live 3D).
- Gameplay past the start screens, and real devices.
- Contrast figures are computed from CSS colours, not measured on gradients or images.

**The site was redeployed during the review** (about 17:50; `/en/spanish/practice/` appeared). A few 504s at that moment are not reported. Findings marked "rechecked" were confirmed after the deploy.

---

## Top 10 changes with the biggest effect

1. **Spanish verb table shows German meanings** (`/es/verbos-irregulares/tabla-de-verbos/`). The "Significado" column is `entstehen, sich erheben`, `erwachen`, `sein`. The page reads `r.meaning_de` and searches it too. Fix: use the Spanish meaning field. Small.
2. **Verb Kitchen loads Google Fonts** on all three sections, while the privacy pages say "no third parties". This is the only external request on the whole site, and a known problem for German schools. Fix: use the self-hosted fonts the other games already ship. Small.
3. **Header is scrambled on 10 pages** (flashcards, overview, statistics, both topics, DE + ES). The flag menu and nav come first and the logo sits in the middle or on the right. Fix: same header skeleton as the other pages. Small to medium.
4. **Three of five verb drills don't work on phones** (Type Race, Drag Match, Falling Forms: "braucht einen breiteren Bildschirm") but are still offered in the chip bar and the verbs hub. Fix: hide them under 900 px, or make them work. Medium.
5. **Verb pages ask grammar terms as the question** on the verb pages (7 sampled, all from one generator, 344 pages): "Was ist das Simple Past von go?" / "¿Cuál es el pasado simple de go?". This breaks the presentation mandate on the pages that get the search traffic. Fix: `go → ___ → gone` notation. Small (generator).
6. **Game pages are a different site.** Dark navy body, dark info section, own header, no tab bar, no footer, while the rest is cream and light. Fix: keep the dark stage for the game, and put the info section and footer on the light style. Medium.
7. **Four primary-button styles and failing contrast.** Rust, salmon, teal and amber buttons sit next to navy pills. White on salmon is 2.3:1 and coral links on white are 2.9:1 (AA needs 4.5:1). Fix: one primary, one secondary, one darker link colour. Medium.
8. **"concha" in live Spanish example sentences** (`/es/verbos-irregulares/find/`, also in the HTML of `/withdraw/`). Fix in `content/irregular-verbs-pages.json` and regenerate. Small.
9. **Emojis are still in the UI in many places:** figure editor tabs, shell counter, 404 pages, tutor page, and every game start screen. Fix: the existing `ki-*` icons. Medium.
10. **Spanish pages are written for Spain, the real users are in Uruguay:** "1º ESO", "5.º de Primaria", "según la comunidad", and a mix of "ordenador"/"computadora" and "móvil"/"celular". Fix: ages instead of school years, one word per thing. Small to medium.

---

## Findings by area

Severity: high / medium / low. Effort: small / medium / large.

### Text

| # | Page(s) | What's wrong | Suggested change | Sev. | Effort |
|---|---|---|---|---|---|
| T1 | `/es/verbos-irregulares/tabla-de-verbos/` | Meaning column and search use German (`meaning_de`). `es-verb-table-german-meanings.jpg`. Rechecked with an es-UY browser. | Use the Spanish meaning; search it too. Fallback strings in the same script are German as well (`'Bedeutung'`). | high | small |
| T2 | All verb pages, DE + ES (sampled go, be, forsake, misunderstand, wake-up) | Mini-quiz asks "Was ist das Simple Past von go?" / "Was ist das Past Participle von go?" / "¿Cuál es el pasado simple de go?". `verb-page-quiz-grammar-terms.jpg` | Ask `go → ___ → gone` and `go → went → ___`. The FAQ below may keep the terms (teachers search them). | high | small |
| T3 | `/es/verbos-irregulares/find/` (visible), `/es/verbos-irregulares/withdraw/` (in the HTML) | "No encontramos ninguna concha en la playa." / "El caracol se esconde en su concha". `es-find-concha.jpg` | "caracolas" for the beach; another sentence for the snail (e.g. "en su caparazón"). Source: `content/irregular-verbs-pages.json`. | high | small |
| T4 | `/es/`, `/es/pasado-simple/`, `/es/presente-*/`, `/es/preposiciones/fichas/` | Spain's school system: "5.º de primaria y de la ESO", "1º ESO", "1º–3º ESO (según la comunidad y el libro de texto)". | Ages ("desde los 10 años", "11–13 años") or "primeros años de inglés". | medium | small |
| T5 | `/es/juegos/*` | Mixed regional words: "ordenador o portátil" (Air Control, Verb Kitchen) vs "computadora" (Dungeon, Kitchen, Platformer); "móvil" (landing badge, Kitchen) vs "celular"; "tablet" vs "tableta". | One set: computadora, celular, tablet. | medium | small |
| T6 | `/en/spanish/`, `/en/my-profile/`, `/en/my-figure/` | British "Practise" after today's switch to American "practice": H1 "Practise Spanish grammar – with games", buttons "Practise", "Practise now · 5 minutes", "Practise without a game". Nav and topic pages say "Practice". `en-landing-practise-vs-practice.jpg`. Rechecked after the deploy. | Replace the remaining "practise/practising". Check "colour" on `/quiz/` too. | medium | small |
| T7 | `/de/lehrkraefte/`, `/es/docentes/` | Verb Kitchen card says "Menüs auf Englisch" / "menús en inglés". The game start screen is German/Spanish and its own page says "die Texte im Spiel sind auf Deutsch". | Remove or correct the sentence. | medium | small |
| T8 | Everywhere (cards, footer, game header) | Game names with and without "!": "Verb Kitchen!", "Verb Platformer!", "Verb Snake!", "Air Control!", "Verb Flow!" vs "Verb Towers", "Verb Dungeon". The teacher pages write "Verb Kitchen" without it. | Drop the "!" from all names (`games.json`). | low | small |
| T9 | `/de/` and `/es/` meta description | "Übe unregelmäßige Verben mit Spielen …" only. The H1 and intro now promise prepositions and tenses too. ES says "a partir del 5º curso". | Rewrite both descriptions to match the H1. | medium | small |
| T10 | `/de/`, `/es/` footer line | "Mehr Grammatik-Themen folgen bald." / "Más temas de gramática próximamente." sits under a footer that already lists six topics. | Remove. | low | small |
| T11 | `/es/` | "Verbos Irregulares" (card) vs "Verbos irregulares" (heading); "5 Speed Drills" vs "2 drills"; "herramientas de estudio" vs "herramientas". Footer topics are English ("Past simple", "Present continuous") while the pages are "Pasado simple", "Presente continuo". | One spelling each; footer names = page names. | low | small |
| T12 | All drill pages (e.g. `/de/unregelmaessige-verben/sprint/`, `/karteikarten/`, `/freies-ueben/`) | SEO headline + a 4–6 line description box sit above the start button; free practice says the same thing twice (subtitle and box). On a phone the drill starts below the fold. `header-logo-misplaced-phone.jpg`, `drills-need-wider-screen-phone.jpg` | Drill first, description under it. | medium | medium |
| T13 | `/de/lehrkraefte/` FAQ | "Welche Daten werden erhoben? Keine Namen …" — two sections higher the page explains that classes store first names. | "Ohne Klasse: keine Namen. Mit Klasse: nur Vornamen und Antworten." | low | small |
| T14 | `/de/404.html`, `/es/404.html` | "Diese Seite gibt's leider nicht 🦀" — emoji in the heading, next to the mascot picture. | Remove the emoji. | low | small |

### Layout

| # | Page(s) | What's wrong | Suggested change | Sev. | Effort |
|---|---|---|---|---|---|
| L1 | `/de/unregelmaessige-verben/karteikarten/`, `/uebersicht/`, `/statistik/`, `/de/praepositionen/karteikarten/`, `/uebersicht/`; ES: `/tarjetas/`, `/resumen/`, `/estadisticas/` (both topics) — 10 pages | Header order is wrong: flag menu (and on tablet the whole nav) comes first, the logo sits at x=82 on phones and near the right edge on tablets. `header-logo-misplaced-phone.jpg` (columns 2–4), `tablet-overview-header-bug-tpose-figure.jpg` (middle row) | These pages have an older header skeleton; give them the one the Sprint page has. | high | small–medium |
| L2 | `/de/unregelmaessige-verben/type-race/`, `/drag-match/`, `/falling-forms/` + ES | On phones: "braucht einen breiteren Bildschirm … mindestens 900 px". Still in the chip bar and as big cards on the verbs hub. Type Race has no "Zum Sprint" button, the other two have. `drills-need-wider-screen-phone.jpg` | Under 900 px: hide the chips and hub cards, or show them greyed with "nur am Computer". Add the buttons to Type Race. | high | medium |
| L3 | `/de/unregelmaessige-verben/` (10,451 px), `/es/verbos-irregulares/` (10,378 px) on phones | About 12 screens: the full 172-row table comes before the drills, tools and games. `verbs-hub-phone-very-long.jpg` | Show 10 rows with "Alle 172 anzeigen", or move the table under the drill cards. | medium | medium |
| L4 | `/de/praepositionen/uebersicht/` (20,107 px), `/es/preposiciones/resumen/` (20,003 px) on phones | 24 screens of rule cards, no jump links. | Collapse categories, add a category chip bar. | medium | medium |
| L5 | Topic hubs (`/de/unregelmaessige-verben/`, `/de/simple-past/`, `/en/spanish/ser/` …) on phones | Hero picture is cropped at the top: the "to" and "by" tags are cut in half. The same preposition picture is used on tense and Spanish topics. `verb-page-quiz-grammar-terms.jpg` (left), `en-section-phone.jpg` | `object-fit: contain` or a crop that keeps the tags; one picture per topic later. | medium | small |
| L6 | `/games/quiz-room/teacher.html` on phones | Setup form is the desktop grid squeezed: topic chips in a narrow left column, "Schwierigkeit" floating to the right, chips far apart. `quiz-teacher-setup-phone.jpg` | One column under ~700 px. | medium | small |
| L7 | `/de/spiele/verb-dungeon/`, `/es/juegos/verb-dungeon/` on phones (portrait) | The start screen is rotated 90°, all text sideways. Platformer says "Dreh dein Handy quer", Egg Island says "braucht einen breiteren Bildschirm", Kitchen and Towers play in portrait. The landing marks Dungeon "Handy ✓". `verb-dungeon-rotated-phone.jpg`, `game-start-screens-phone.jpg` | One rule for all landscape games: the "turn your phone" screen. | medium | medium |
| L8 | `/de/`, `/de/profil/` (+ ES, EN) | The figure stands in a T-pose (arms straight out) in the still picture shown before the 3D figure loads. In headless it never switched. `landing-de-phone.jpg`, `laptop-overview.jpg`. Check on a real device how long it stays. | Render the still pictures in the idle pose. | low–medium | medium |
| L9 | `/de/unregelmaessige-verben/freies-ueben/`, `/de/praepositionen/freies-ueben/` + ES | No tab bar on phones (every other page has it); only a small "Fertig" link at the top. | Show the tab bar, or make "Fertig" a real button. | low | small |
| L10 | Tap targets on phones | Footer legal links 17 px high (121 pages); logo 26 px high; game-page DE/ES buttons 36×27; "← Krabsy" on `/quiz/` 29 px; verb-table checkboxes 16×16. | Min. 44 px height via padding. | medium | small |
| L11 | Drill chip bar on phones | Five chips don't fit; "Lückentext" is cut at the edge and "Falling Forms" is off-screen, with no hint that the bar scrolls. | Solved by L2; otherwise a fade at the edge. | low | small |
| L12 | Full-page behaviour | No horizontal overflow on any page at any of the three sizes; tab bar (62 px) vs body padding (60 px) is fine. | — | — | — |

### Colours and visual consistency

| # | Page(s) | What's wrong | Suggested change | Sev. | Effort |
|---|---|---|---|---|---|
| C1 | All game pages (`/de/spiele/*`, `/es/juegos/*`, `/en/spanish/games/*`) | Body is navy (`rgb(12,20,48)`; sky blue on Platformer, three other navies on the older games). The info section under the game is dark with teal and amber headings; no site footer, no tab bar. `game-page-dark-info-section.jpg` | Dark stage for the game only; info section, FAQ and footer in the cream style with the site footer. | high | medium |
| C2 | `/de/meine-figur/`, `/es/mi-personaje/`, `/en/my-figure/` | The editor is a navy panel with emoji tabs (🧑 🎩 🎨 👕, 🎲 Zufall, 🔄 Drehen, 🎁, 🐚) on a cream page; the new profile next door is light and uses icons. `figure-editor-dark-emoji-phone.jpg` | Light panel like the profile card; `ki-*` icons. | medium | medium |
| C3 | Landing pages, teacher pages | "Im Unterricht nutzen?" / "Teaching Spanish?" is a navy box. `landing-de-phone.jpg` | Light card with the amber edge. | low | small |
| C4 | Site-wide | Button styles: rust red ("Spielen", "Beitreten", "Klasse erstellen"), salmon ("Los geht's!", "Zur Startseite", "Start", "PDF herunterladen"), teal ("Jetzt üben", "Los geht's →" on Üben, "Übungslink erstellen"), amber ("Für Lehrkräfte", "Speichern", "Quiz-Raum öffnen"), navy pills ("Üben" on Themen), teal pills (verb pages). `utility-pages-phone-button-styles.jpg`, `teacher-page-phone.jpg` | One primary (rust, it has the best contrast), one secondary (outline), teal only for "practice", amber only for teachers. | medium | medium |
| C5 | 50 pages with chip bars | Active chip: white on salmon `rgb(242,147,126)` = 2.3:1. | Darker fill (the rust red) or dark text. | medium | small |
| C6 | Cards and links site-wide | Coral text `rgb(224,122,100)` on white = 2.9:1 ("Spielen →", "Alle Spiele ansehen →", e-mail links, "PDF herunterladen" white on coral). | Use the rust red for text links. | medium | small |
| C7 | Verb pages | Form colours on white: amber `rgb(184,134,11)` 3.3:1, teal `rgb(13,156,124)` 3.5:1, red `rgb(224,82,82)` 3.8:1 at table size. | Slightly darker shades; the bold header forms pass. | low | small |
| C8 | Footer, all pages | Grey `rgb(110,108,128)` on `rgb(232,233,240)` = 4.2:1 at 14 px. | One step darker. | low | small |
| C9 | Game start screens | Emojis: Kitchen 🍳 📖 🧑‍🍳, Snake 🐍 👆, Air Control ✈ ✏ 💥 🚁, Flow 🦀 👆 🔗 🚫 ✨ 🌊, Dungeon 🎁. Drills: 🔥 for the streak. `game-start-screens-phone.jpg` | Replace per game when it is touched next; drills first (one icon). | medium | medium |
| C10 | `/de/spiele/`, `/es/juegos/`, `/en/spanish/games/`, header | 🐚 in the "Meine Figur" pill and in the shell counter (STATUS already lists the counter). | `ki-shell`. | low | small |
| C11 | `/en/spanish/tutors/` | Emojis in the product mock-up (⭐ 🎮 👋 🗓) and star rating `rgb(224,161,0)` on white = 2.3:1. | Icons; darker amber for the stars. | low | small |
| C12 | Fonts | Headings are "Fredoka Display"; game pages and the teacher/figure pages still name "Fredoka One"; 68 pages have elements falling back to Arial (buttons/inputs without `font-family`). | `font: inherit` on `button, input, select` in `krabsy-ui.css`. | low | small |

### Links and navigation

| # | Page(s) | What's wrong | Suggested change | Sev. | Effort |
|---|---|---|---|---|---|
| N1 | Crawl | No broken internal links and no broken assets in 504 URLs. `/` → 302 by browser language (`/de/`, `/es/`, `/en/spanish/`) works. All 30 old `/de/drills/…`, `/de/games/…` addresses redirect (301). | — | — | — |
| N2 | `/en/…` anything missing, e.g. `/en/spanish/nope/` | The 404 page is German ("Diese Seite gibt's leider nicht", links to `/de/`), and its inline script sets `krabsy_lang` to `de`. `404-english-section-is-german.jpg` | Add `/en/404.html` and a server rule like the one `/es/` has. | medium | small |
| N3 | `/en/spanish/*` nav and tab bar | "Practice" still links to `/en/spanish/practise/`, which now forwards by meta refresh to `/practice/` (one extra blank page). Rechecked after the deploy. | Bump the `?v=` of the script that builds the nav, or its registry (`krabsy-registry.js` already has the new path). | low | small |
| N4 | Language switch DE ↔ ES | Leads to the right parallel page on all 120 DE/ES pages (topics, drills, legal, class, profile, figure, practice). Lesson ideas (DE only) go to `/es/docentes/`. On game pages a click asks before leaving the game, so it could not be followed automatically. | — | — | — |
| N5 | Flag menu on `/es/*` | The dropdown has one entry, "Inglés · seleccionado". `/de/` offers Spanish (menus in English); `/en/` offers both English sections. `es-flag-menu-single-entry.jpg` | Show it as a plain label on `/es/`, or add "Español (menús en inglés)". | low | small |
| N6 | Breadcrumbs | Only 19 of 129 non-game pages have them (Themen, verb pages, A–Z, worksheets, lesson ideas). Topic hubs, drills, tools, Diplom, statistics, profile, figure and class pages have none; drills have the chip bar but no link back to their topic hub. | "Thema › Sprint" line on drill and tool pages (one helper in `krabsy-nav.js`). | medium | small |
| N7 | `/de/spiele/verb-hatchery/`, `/es/juegos/verb-hatchery/`, `/de|es/…/crab-slash/`, `/verb-slash/` | Live but unlinked (noindex). Hatchery DE/ES has no game title in the header and no info bar; Crab Slash is a tiny letterboxed canvas on phones. `game-start-screens-phone-2.jpg` | Remove from the deploy or finish; today they only show up through old links. | low | small |
| N8 | `/de/unregelmaessige-verben/verb-diplom/`, `/es/…/diploma/` | Tool chip bar (Karteikarten · Verb-Tabelle · Freies Üben) with nothing active. | Add "Verb-Diplom" as a chip or drop the bar here. | low | small |
| N9 | Footer on `/en/` | "Legal notice (German)" appears twice (About list and bottom line); DE/ES repeat Impressum/Datenschutz the same way. | Keep the bottom line only. | low | small |
| N10 | Game pages | One back link ("Alle Spiele") and the logo; no tab bar, no shells entry on phones, no way to Themen or Profil without going home first. | Fine while playing; add the site footer under the info section (see C1). | low | small |

### SEO

| # | Page(s) | What's wrong | Suggested change | Sev. | Effort |
|---|---|---|---|---|---|
| S1 | Sitemap | 422 URLs, all 200, all self-canonical, none noindex. Every indexable page is in it. hreflang pairs are reciprocal on all 444 DE/ES pages. No duplicate titles. | — | — | — |
| S2 | noindex | As intended: all of `/en/`, the 24 draft tense pages, class pages, tutor pages, `/quiz/`, statistics, 404s. Tier-3 verb pages carry `googlebot: noindex, follow` (the running experiment). | — | — | — |
| S3 | `/de/profil/`, `/es/perfil/`, `/de/ueben/`, `/es/practicar/`, `/de/meine-figur/`, `/es/mi-personaje/` | Personal, near-empty pages are indexable and in the sitemap (title "Meine Figur — Krabsy", descriptions over 200 characters). | noindex and out of the sitemap, or accept them as low-value. | medium | small |
| S4 | Draft topics | The four tense topics are noindex, but the footer of every indexable page, the landing intro and Themen link to them, and the landing H1 promises them. | Decide: either index them now (the pages are complete and reviewed-looking) or keep the links and accept it. Indexing is the bigger win. | medium | small |
| S5 | `robots.txt` | `Disallow` for the two statistics pages, which also carry noindex. A blocked page's noindex is never read. | Remove the two Disallow lines. | low | small |
| S6 | Titles | Four lesson-idea titles are 79–93 characters; `/de/unregelmaessige-verben/` 68, `/verb-diplom/` 70. Separators vary: " — Krabsy" (most) vs " | Krabsy" (landing, Themen, teachers, verb pages). | Shorten the lesson titles to ≤ 60; one separator. | low | small |
| S7 | Descriptions | Over 180 characters: `/de/themen/` 210, `/es/temas/` 214, `/es/preposiciones/resumen/` 210, both quiz-room pages, both Dungeon pages. | Trim to ≤ 155. | low | small |
| S8 | `/de/lehrkraefte/klasse/` | hreflang `es` → `/es/docentes/clase/` is fine (200); the class pages have no canonical. They are noindex, so no effect. | — | low | — |
| S9 | `/de/404.html` | Canonical and hreflang tags on a noindex error page. | Remove them. | low | small |

### Other

| # | Page(s) | What's wrong | Suggested change | Sev. | Effort |
|---|---|---|---|---|---|
| O1 | `/de/spiele/verb-kitchen/`, `/es/juegos/verb-kitchen/`, `/en/spanish/games/verb-kitchen/` | `games/verb-kitchen/index.html` lines 7–9 load `fonts.googleapis.com` and `fonts.gstatic.com`. All three privacy pages say "Wir teilen keine Daten mit Dritten" and list no font service. No other page makes an external request. | Self-hosted `fonts/*.woff2` like Platformer and Hatchery. | high | small |
| O2 | Topic and drill pages for a German browser on `/es/` and `/en/` | Banner "Sprichst du Deutsch? … Zu Krabsy auf Deutsch →" on every page until closed. Works as designed; on phones it takes 90 px above every page. `en-section-phone.jpg` | Show it on landing pages only, or remember the choice after one visit. | low | small |
| O3 | `/de/profil/` for a new child | "12 von 42 Figuren · 4 von 33 Sachen" before the child has done anything, next to "0 Muscheln". Clear once you know the free starters count; a 10-year-old may wonder. | "12 Figuren zum Start" for a new child. | low | small |
| O4 | `/de/lehrkraefte/klasse/` without a link | "Diese Klasse gibt es nicht (mehr)" plus "Klasse erstellen" — good empty state. Seen with the API blocked, so the real states were not checked. | — | — | — |
| O5 | `/quiz/` | Follows the browser language (DE / ES / EN checked): correct. English says "Your colour" (British, see T6). | — | low | small |

---

## Quick wins (under 5 minutes each)

- `r.meaning_de` → Spanish field in the ES verb table (T1).
- Replace the two "concha" sentences (T3).
- Remove the three Google Fonts lines from Verb Kitchen (O1), then re-stamp the game.
- Remove "Menüs auf Englisch" / "menús en inglés" from the teacher pages (T7).
- "Practise" → "Practice" on `/en/spanish/`, `/en/my-profile/`, `/en/my-figure/` (T6).
- Drop the "!" from the five game names in `games.json` (T8).
- Remove "Mehr Grammatik-Themen folgen bald." / "… próximamente." (T10).
- Remove the 🦀 from the two 404 headings (T14).
- New meta descriptions for `/de/` and `/es/` (T9).
- Remove the two `Disallow` lines in `robots.txt` (S5).
- noindex on profile, practice and figure pages (S3).
- `font: inherit` for buttons and inputs (C12).
- Footer link padding to 44 px height (L10).
- Hero picture `object-fit` on topic hubs (L5).

## What's good and should stay

- **No broken links, no broken assets, no horizontal overflow** on any page at any of the three sizes; zero console errors apart from the blocked API.
- **Themen page:** class-year groups, one example sentence per topic, "Üben" + "3 Spiele". The clearest page on the site.
- **The new profile:** figure, one number, one bar, one button. Reads well at all three sizes.
- **"Jetzt üben · 5 Minuten"** with three plain steps and the weekly ring.
- **Teacher pages:** "Drei Wege", the honest "Gezeichnetes Beispiel … kein Screenshot" note, Sie-form throughout, privacy summary in plain words.
- **Lesson ideas** with a minute-by-minute plan and PDF.
- **Verb pages:** forms, translated examples, typical mistakes ("has went"), same-pattern verbs. Only the quiz wording needs changing.
- **Language handling:** root redirect by browser language, DE ↔ ES switch to the exact parallel page on every page tested, `/quiz/` in three languages.
- **Sitemap, canonical, hreflang and noindex** are consistent and match the intent.
- **Empty and error states** (class not found, expired tutor link, statistics before practice) say what happened and offer one next step.
- **Verb Towers and Verb Kitchen start screens** work in portrait on a phone and show the `go → went → gone` notation.

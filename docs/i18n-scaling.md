# Language independence: contract and status (2026-11-27)

**Owner goal (2026-11-27):** everything works, in theory, for any taught
language (subject) × any interface language. Every element of the site and
of every game is filled from a catalogue; catalogues follow rules so that a
new language is data, not code. Target scale: ~5 taught × ~10 interface
languages (other subjects possible in theory). URL scheme: `docs/vision.md`
§4 "Languages".

## The contract (applies to all new and changed code)

1. **No visible text in code.** Interface text comes from `data/ui_<lang>.json`
   (or a catalogue the game declares) by key. No `lang === 'de' ? … : …`, no
   `{de: …, es: …}` tables inside JS/Python/pages.
2. **One way to know the language.** Interface language from one helper
   (`currentLang()`, to be built, see N2); taught language/subject from the
   topic registry (`learn` / later `subject`), never from the topic id prefix.
3. **Sections are (interface × subject)**, not interface alone: `de` (English
   for German speakers), `de/spanisch`, `en/spanish`, … One registry lists
   them; nav, hubs, games, link builder, classes read it.
4. **Content texts per language are maps**: `"meaning": {"de": …, "es": …}`,
   `"hint": {…}`, `"teach": {…}` (FORMAT.md v2 style), never `meaning_de`.
   Engine and games pass the map through; they don't flatten it to fixed
   languages.
5. **Fallback chain, never empty:** requested language → `en` → any
   available → key. A missing text never crashes or shows a blank button.
6. **Catalogues are validated before release** (to be built, see N6): every
   key present in every declared language, placeholders (`{name}`) match,
   no HTML unless the key allows it, length limits for tight game UI,
   unique slugs, every topic in topics.json has a registry entry.
7. **Games declare** `ui_langs` (games.json) and get questions only through
   the engine (`quiz` shape); their own UI strings live in a per-game
   catalogue file with the same rules.
8. **No text in images.** Art and thumbnails are text-free; text is drawn
   from the catalogue on top.
9. **New pages don't inline JS or per-language copies of logic**; shared
   behaviour goes in `lib/`, per-language differences go in data.
10. **Input checking is language-aware**: Unicode NFC normalisation; accent
    handling per taught language (decided per topic, not globally).

## Status (audit 2026-11-27)

**Already prepared:** `ui_<lang>.json` with key parity (de 267, es 267,
en 270) and 42 pages on `data-i18n`; format-2 content with language maps
and `learn_lang`; topic registry with `learn`; topics.json with per-language
slugs; games.json with `ui_langs` and name/tagline maps; sitemap generator
language-agnostic; TTS map by taught language; renderer tables keyed by
language; URL scheme decided.

**Not yet:** the site is built for exactly two interface languages plus one
pilot. Main gaps, with effort and timing:

| # | Gap | Where (examples) | Effort | When |
|---|---|---|---|---|
| N1 | Section = interface language only; `en` silently means "Spanish for English speakers". Adding `de/spanisch` would leak Spanish topics into the English /de/ nav and hubs. | `lib/krabsy-nav.js:55-66`, `krabsy-footer.js:108-112`, `krabsy-topic-nav.js:24-29`, `krabsy-link-builder.js:20-24`, `krabsy-practice.js:38-42`, `tools/render_static_games.py:33-38` | M | **now** |
| N2 | Language detection copied in ~15 files, each with its own list and a `de` fallback | footer, topic-nav, shells, rewards, me, figure-page, practice, landing, verb-diplom, class-pages, i18n-attr, krabsy-data | S | **now** |
| N3 | Engine flattens language maps to en/de/es; fixed fallback `[lang,'en','de','es']` | `krabsy-questions.js:323`, `krabsy-data.js:155, 222-224` | S | **now** |
| N4 | Taught language guessed from topic id prefix `es_` | `krabsy-me.js:143`, `krabsy-practice.js:113,384`, `games/verb-platformer/src/i18n.js:300` | S | **now** |
| N5 | API duplicates topic/language lists; class language forced to de/es; dashboard misses /en/spanish/games/ | `api/classes.py:49,230`, `api/quiz_room.py:679`, `api/dashboard.py:309-310` | S | **now** |
| N6 | No catalogue validator | — | S–M | **now** |
| N7 | Inline string tables in 16 lib files | class-pages, gifts-ui, practice-week, footer, figure-page/-catalog, game-info, link-builder, shells, sync, landing, profile, verb-diplom, practice, topic-nav, activities/util | M | new code now; move the rest gradually |
| N8 | Old verb content uses `meaning_de`/`meaning_es` | `content/irregular-verbs.json`, `krabsy-data.js:445-512,590`, `render_hub_verb_table.py:39`, `generate_worksheets.py:46`, DE flashcards page | M | before the 3rd interface language |
| N9 | Language switch hard-codes de/es, 20 hand-made page pairs; DE/ES buttons in 397 pages | `lib/krabsy-lang-switch.js` | M | before the 3rd interface language |
| N10 | ~30 hand-written pages + 12 game wrappers copied per language; de/es copies already differ by 110–470 lines | `homepage/de/…`, `homepage/es/…` | L | templating before the 3rd interface language |
| N11 | hreflang assumes a de/es pair in generators | `generate_verb_pages.py`, `generate_worksheets.py:394,421`, `generate_lesson_plans.py:335` | M | when it comes |
| N12 | Per-game string tables, some de/es only | air-control, verb-flow, verb-snake, quiz-room (`questions.js:46,82`), platformer, kitchen, dungeon, hatchery | L | standard `?lang=` + `en` fallback now; translations when it comes |
| N13 | Game SEO prose per game in Python (de/es ternary) | `tools/game_info_content.py`, `render_game_info.py:351`, `render_teacher_notes.py` | L (text) | when it comes |
| N14 | Spanish pilot built by regex surgery on German pages | `tools/build_en_spanish.py` | L | replaced by templating (N10) |
| N15 | Root redirect and 404 map hand-written for de/es | `docs/nginx-krabsy.conf:78-87`, `homepage/index.html:23-28` | S–M | when it comes |
| N16 | Tutor tools hard-wired to /en/spanish/ | `krabsy-tutor.js`, `krabsy-live-tutor.js`, `krabsy-tutor-lesson.js` | M | when tutors need a 2nd section |
| N17 | Fonts latin + latin-ext only; `checkTyped` has no NFC/accent handling | `lib/fonts/`, `krabsy-questions.js:113-115,427` | S/M | NFC now; fonts when a non-Latin language comes |

**Order:** N1–N6 first (cheap, they stop the drift and unblock a second
taught language under one interface), then N7–N10 before a third interface
language. File paths and line numbers are from the audit and will drift;
re-check before editing.

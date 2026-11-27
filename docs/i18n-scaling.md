# Language independence: contract and status (2026-11-27)

**Owner goal (2026-11-27):** everything works, in theory, for any taught
language (subject) × any interface language. Every element of the site and
of every game is filled from a catalogue; catalogues follow rules so that a
new language is data, not code. Target scale: ~5 taught × ~10 interface
languages (other subjects possible in theory). URL scheme: `docs/vision.md`
§4 "Languages".

## The contract (applies to all new and changed code)

**Tools:** after editing `data/sections.json` or `data/topics.json` run
`python3 tools/krabsy_registry.py`; before a release run
`python3 tools/check_catalogues.py` (exit 1 on errors).

1. **No visible text in code.** Interface text comes from `data/ui_<lang>.json`
   (or a catalogue the game declares) by key. No `lang === 'de' ? … : …`, no
   `{de: …, es: …}` tables inside JS/Python/pages.
2. **One way to know the language.** Interface language from one helper
   (`currentLang()` in `lib/krabsy-lang.js`); taught language/subject from the
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
6. **Catalogues are validated before release** (`tools/check_catalogues.py`): every
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

## Status (audit 2026-11-27, N1–N6 done the same day)

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
| N1 | ✅ **Done 2026-11-27**: sections are data (`data/sections.json`: ui languages + their pages, subjects + taught language + accent keys, sections `de` / `es` / `en/spanish`). Topic ∈ section ⇔ same `subject` and a URL in the section's ui language. JS: `lib/krabsy-lang.js` (`currentSection`, `sectionTopics`, `sectionGames`, `gameUrl`, `topicUrl`, `uiPage`); Python: `tools/krabsy_registry.py` (also writes `lib/krabsy-registry.js`, `api/catalog.json`). Nav, footer, topic nav, link builder, practice, profile, landing, me, class pages, `render_static_games.py`, `render_game_info.py` (content keyed by section id) use it. Checked: an added `de/spanisch` section keeps /de/ topics and games unchanged. | `data/sections.json`, `lib/krabsy-lang.js`, `tools/krabsy_registry.py` | M | done |
| N2 | ✅ **Done**: one `currentLang()` in `lib/krabsy-lang.js` (path → `?lang=` → localStorage → `<html lang>` → default; `supported` narrows it), used by all lib modules (classic scripts load it with `import()`), `krabsy-data` re-exports it (`getLang` is gone). Left: `krabsy-lang-switch.js` still maps de↔es (N9); inline games keep their own `getLang` (N12). | `lib/krabsy-lang.js` | S | done |
| N3 | ✅ **Done**: `pickLang` (requested → en → default → any) in krabsy-lang.js; records keep maps (`meanings`, `hints`, `teach.lines`, `display.hints`, reference `explanations`) next to the resolved strings; flattened `meaning_en/_de/_es` removed from gap and preposition records. Verb rows build `meanings` from the source's `meaning_de/_es` until N8. | `krabsy-data.js`, `krabsy-questions.js` | S | done |
| N4 | 🟡 **Mostly done**: taught language from the registry (`topicLearnLang`, `subjectKeys`) in me, practice (accent keys from `sections.json` subjects), profile, landing, Verb Platformer. **Left (game sessions' folders):** `/^es_/` topic-text fallbacks in `games/verb-kitchen`, `games/verb-hatchery`, `games/tower-defense`, `games/duo-coop` `src/i18n.js` (switch to `topicLearnLang` + re-stamp); the `/en/spanish/games/*` wrappers' `?topic=` check `/^es_…/` (`tools/build_en_spanish.py`, N14); display fallbacks in `krabsy-tutor.js`, `krabsy-live-tutor.js` (N16). | see left | S | partial |
| N5 | ✅ **Done**: `api/catalog.py` reads `api/catalog.json` (generated from homepage/data; built-in fallback): `TOPICS`, `UI_LANGS`, `CLASS_LANGS`, `ui_lang()`, section homes / games folders. classes, quiz_room, tutors, dashboard use it; the dashboard now counts `/en/spanish/games/<id>/` and `/en/spanish/`. Tests `api/tests/test_catalog.py`. | `api/catalog.py` | S | done |
| N6 | ✅ **Done**: `python3 tools/check_catalogues.py` (`--strict` = warnings fail too): sections, generated files fresh, topics, ui_*.json key + placeholder parity (topic_overrides only where the topic is shown), HTML only in `*_html` keys, games.json maps per section, content files per FORMAT.md, content/ ↔ data copies, Quiz Room topics. Run before every release. Not yet: length limits for tight game UI, per-game catalogues (N12). | `tools/check_catalogues.py` | S–M | done |
| N7 | Inline string tables in 15 lib files (class-pages moved to ui_*.json `classes` 2026-11-27) | gifts-ui, practice-week, footer, figure-page/-catalog, game-info, link-builder, shells, sync, landing, profile, verb-diplom, practice, topic-nav, activities/util | M | new code now; move the rest gradually |
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

**N1–N6 release notes (2026-11-27, not deployed):** deploy the static site
and the API together (the API needs `api/catalog.json`). Cache: shared lib
modules and the pages importing them carry new `?v=`; the 410 DE/ES pages
still load `krabsy-footer.js` / `krabsy-topic-nav.js` with their old `?v=`
(an old cached copy keeps working with the new data, at most 1 h), and the
three teacher pages still import `krabsy-link-builder.js?v=2026-11-25`
(bump it there). Intentional visible changes: DE/ES prepositions hub links
Verb Towers with `?topic=prepositions`; game frames honour `?lang=` before
localStorage; `/en/` pages get English aria labels from i18n-attr.

**Order:** N1–N6 first (cheap, they stop the drift and unblock a second
taught language under one interface), then N7–N10 before a third interface
language. File paths and line numbers are from the audit and will drift;
re-check before editing.

# Krabsy — Irregular Verbs Hub Build Brief

A complete specification for redesigning krabsy.com as a topic-first hub. This document is structured so Claude Code can stagger the work across phases, with **Phase 2 modules safely parallelizable across multiple agents**. Read Section 1 carefully before assigning work.

---

## 0. Context & Scope

### What we're building
The new krabsy.com homepage is the **Irregular Verbs hub** — a single landing page that exposes four content categories:

1. **Arcade Games** (existing — do not modify)
2. **Speed Drills** (5 new fast, scored, repeatable challenges)
3. **Study Tools** (3 new old-school learning aids)
4. **Verb Reference** (1 new sortable/filterable table)

Plus two cross-cutting features:

5. **Statistics page** — per-verb mastery dashboard
6. **Progress widget** on the homepage

### What NOT to touch
The existing arcade games (`krabsy-verb-slashGN.html`, Crab Slash, Air Control, Verb Snake, Verb Platformer) are **out of scope**. Do not modify them, do not add stats hooks to them, do not restyle them. They link from the homepage as-is.

### Reference files
- **Current homepage screenshot:** shows the existing flat games-grid layout we're replacing. The visual *style* of that page (Mika's brand) is what new modules should match.
- **`/games/verb-slash.html` (existing):** mechanic reference only. Do NOT copy its visual style — it's legacy aesthetic.
- **`ser-estar-game.html` (reference asset):** mechanic reference for the Falling Forms drill (Section 7.5). Do NOT copy its dark visual aesthetic.

### Target audience
Children aged 10–14 learning English as a school subject. Primary market: Germany. Spanish coming later. The hub must work on **desktop and tablet in landscape**. Phones are secondary.

### Language
Build in **German first**. The Spanish version (`/es/`) drops in later via a separate `ui_es.json` file — architecture must support this without re-engineering. All UI strings come from `ui_de.json` (Section 5). No hardcoded German text in any module.

---

## 1. Build Phases & Parallelization

### Phase 1 — Foundation (sequential, single agent)
These outputs define the *contracts* every other module depends on. They must be finished and frozen before Phase 2 starts.

1. **Verb data file** — `/data/irregular-verbs.json` (Section 4)
2. **UI localization file** — `/data/ui_de.json` (Section 5)
3. **Stats module** — `/lib/krabsy-stats.js` (Section 6)
4. **Shared design tokens & utilities** — `/lib/krabsy-ui.css` (Section 3)
5. **Shared data loader** — `/lib/krabsy-data.js` (helper that fetches the JSON files and exposes them; spec inline in Section 4)

**Do not start Phase 2 until all five outputs above exist and are reviewed.** If any contract changes after Phase 2 starts, parallel work has to be redone.

### Phase 2 — Modules (parallel, up to 10 concurrent agents)
Each module below is **self-contained**: it lives in its own folder, owns its own HTML file, and only *reads* from the Phase 1 outputs. No two modules share a writable file.

| # | Module | Folder | Section |
|---|---|---|---|
| 1 | Sprint drill | `/drills/sprint/` | 7.1 |
| 2 | Type Race drill | `/drills/type-race/` | 7.2 |
| 3 | Drag Match drill | `/drills/drag-match/` | 7.3 |
| 4 | Fill the Gap drill | `/drills/fill-the-gap/` | 7.4 |
| 5 | Falling Forms drill | `/drills/falling-forms/` | 7.5 |
| 6 | Flashcards tool | `/tools/flashcards/` | 8.1 |
| 7 | Verb Table tool | `/tools/verb-table/` | 8.2 |
| 8 | Free Practice tool | `/tools/free-practice/` | 8.3 |
| 9 | Verb Reference | `/reference/` | 9 |
| 10 | Statistics page | `/stats/` | 10 |

Each agent:
- **Reads** `/data/irregular-verbs.json`, `/data/ui_de.json`, `/lib/krabsy-stats.js`, `/lib/krabsy-ui.css`, `/lib/krabsy-data.js`
- **Writes** only inside its assigned folder
- **Does not modify** anything in `/lib/`, `/data/`, other modules' folders, or the existing `/games/`

If you find you need a new UI string while building a Phase 2 module: **stop and add it to `ui_de.json` first**, then continue. Note this in your output so other agents know the file changed.

### Phase 3 — Assembly (sequential, single agent)
1. **Homepage** — `/index.html` (Section 12)
2. **Progress widget** — embedded in the homepage, reads from stats module (Section 11)

The homepage links to every Phase 2 module and to the existing arcade games. It is the last thing built because it depends on all of them existing.

### Rules for parallel agents
1. **One folder per agent.** Never touch another module's folder.
2. **Read-only on `/lib/` and `/data/`** except for the one explicit exception above (adding UI strings).
3. **Follow `krabsy-ui.css` strictly.** Use the CSS variables and utility classes defined there. Do not invent new colors or fonts. Visual consistency across parallel agents is non-negotiable.
4. **Use the stats API exactly as specified.** Do not invent new methods. Each module uses its own `source` string (specified per module below).
5. **Test in isolation.** Each module's HTML file must work when opened directly in a browser, with all dependencies loading correctly via relative paths.

---

## 2. Page Information Architecture

Top to bottom on the homepage:

1. **Header** — Krabsy logo (left), language toggle DE/ES (right). Keep current header design.
2. **Hero** — Crab mascot, headline ("Meistere Englisch — Spiel für Spiel!"), short subtitle naming the topic (irregular verbs).
3. **Progress Widget** — visible only if the user has any recorded stats; otherwise replaced by a "Get started" prompt. (Section 11.)
4. **Section: Speed Drills** — 5 cards in a responsive grid.
5. **Section: Study Tools** — 3 cards.
6. **Section: Games** — existing 5 games + "Bald verfügbar" placeholders.
7. **Section: Verb Reference** — single wide card linking to the table.
8. **Section: Statistics** — single card linking to the stats page.
9. **Footer** — minimal: copyright, language toggle echo, "Coming soon: more grammar topics".

Each section has a heading and a short one-line subheading explaining what's in it. No marketing copy bloat.

**One-topic note:** Because Irregular Verbs is currently the only topic, the page is effectively a topic hub. When topic #2 ships, the homepage becomes a topic chooser and Irregular Verbs moves to `/de/unregelmaessige-verben/`. Build the page so this migration is a simple move + path update, not a redesign.

---

## 3. Design System

### Brand (authoritative — match this, not the existing arcade games)

```css
/* In /lib/krabsy-ui.css */
:root {
  --krabsy-lavender: #babfd8;
  --krabsy-sage:     #cdd9b4;
  --krabsy-coral:    #f2937e;
  --krabsy-cream:    #fdfaf3;   /* page background */
  --krabsy-ink:      #2c2a3a;   /* primary text */
  --krabsy-ink-mute: #6e6c80;   /* secondary text */
  --krabsy-success:  #7cb89a;   /* correct answers (sage-derived) */
  --krabsy-error:    #e07b6b;   /* wrong answers (coral-derived) */

  --font-display: 'Limelight', cursive;
  --font-body:    Verdana, Geneva, sans-serif;

  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;

  --shadow-card: 0 2px 8px rgba(44, 42, 58, 0.06);
  --shadow-elev: 0 6px 20px rgba(44, 42, 58, 0.10);
}
```

### Required utility classes in `krabsy-ui.css`

- `.k-card` — white card, rounded `--radius-md`, `--shadow-card`, 24px padding
- `.k-btn-primary` — coral fill, white text, rounded pill
- `.k-btn-secondary` — sage outline, ink text, rounded pill
- `.k-btn-ghost` — transparent, ink-mute text
- `.k-input` — text input with sage border, coral focus ring
- `.k-pill-correct` — sage background, dark text
- `.k-pill-wrong` — coral background, white text
- `.k-mastery-bar` — 5-segment horizontal bar (used by stats page and progress widget)
- `.k-section` — section wrapper with consistent vertical spacing

### Performance rules (per existing project conventions)
- **Do not use** `backdrop-filter`, `drop-shadow`, `filter: blur()`, `text-shadow`, `box-shadow` on animated elements
- Animate via `transform: translate()` only (GPU compositing)
- Budget tablets are a real constraint

### Typography
- Headings: Limelight (display)
- Body text & UI: Verdana
- All grammar content (verb forms, sentences): Verdana — readability matters more than style on the content itself

---

## 4. Verb Data

### File: `/data/irregular-verbs.json`

One JSON array. Schema per entry follows the system prompt's question schema:

```json
{
  "id": "iv_fly_001",
  "topic": "irregular_verbs",
  "verb": "fly",
  "difficulty": 1,
  "type": "fill_gap",
  "prompt": "fly → ___",
  "correct_answer": "flew",
  "wrong_answers": ["flown", "flied", "fled"],
  "hint": "fly, fl_w, flown",
  "context_sentence": "The bird ___ over the lake."
}
```

### Initial content scope
**60 most-common irregular verbs**, each with the following question entries:

- **2 fill-gap questions per verb at difficulty 2** (one for simple past, one for past participle) — used by Sprint, Falling Forms
- **1 type-the-form question per verb at difficulty 3** — used by Type Race, Free Practice
- **1 fill-gap in context at difficulty 4** — uses `context_sentence` meaningfully — used by Fill the Gap

Total: ~240 question entries. Plus the verb table itself needs base/past/participle for all 60 verbs — derive that programmatically from the question entries (every verb appears in multiple questions; `verb`, `correct_answer` for past, and `correct_answer` for participle are recoverable).

**Generation note for the Phase 1 agent:** generate the JSON yourself following the Q&A Generation Rules in the system prompt. Group by verb. Wrong answers at difficulty 2 must be real forms of similar verbs (not regularized "goed" forms — that's difficulty 1). Use the canonical "top 60 irregular verbs" list (be, have, do, say, go, get, make, know, think, see, come, want, look, use, find, give, tell, work, call, try, ask, need, feel, become, leave, put, mean, keep, let, begin, seem, help, show, hear, play, run, move, live, believe, bring, happen, write, sit, stand, lose, pay, meet, include, continue, set, learn, change, lead, understand, watch, follow, stop, create, speak, read — adjust if needed to keep all 60 as genuinely irregular).

### File: `/lib/krabsy-data.js`

Tiny helper module that every other file imports:

```js
// Loads /data/irregular-verbs.json once, caches it.
export async function loadVerbs() { ... }

// Loads /data/ui_<lang>.json based on current language setting.
export async function loadStrings(lang = 'de') { ... }

// Returns a derived verb table: [{ verb, past, participle }, ...]
export async function loadVerbTable() { ... }

// Filter questions by criteria.
export async function getQuestions({ type, difficulty, verbIds }) { ... }
```

Language is stored in `localStorage.krabsy_lang` (default `'de'`). All modules call `loadStrings()` on init.

---

## 5. UI Localization

### File: `/data/ui_de.json`

Complete German UI strings, structured for clean translation. The Phase 1 agent must enumerate **every string every Phase 2 module will need** so parallel agents don't all add keys mid-build.

```json
{
  "lang": "de",
  "common": {
    "start": "Los geht's!",
    "play_again": "Nochmal spielen",
    "back_to_hub": "Zurück zur Übersicht",
    "next": "Weiter",
    "skip": "Überspringen",
    "correct": "Richtig!",
    "wrong": "Falsch",
    "your_score": "Dein Ergebnis",
    "best_score": "Bestleistung",
    "time": "Zeit",
    "accuracy": "Genauigkeit",
    "streak": "Serie",
    "verb_base": "Grundform",
    "verb_past": "Simple Past",
    "verb_pp": "Past Participle"
  },
  "homepage": {
    "hero_title": "Meistere Englisch — Spiel für Spiel!",
    "hero_sub": "Unregelmäßige Verben lernen: spielen, üben, nachschlagen.",
    "section_drills": "Speed-Drills",
    "section_drills_sub": "Kurze Challenges. Schlag deine Bestzeit.",
    "section_tools": "Lernwerkzeuge",
    "section_tools_sub": "Klassisches Üben, ohne Spielzeug.",
    "section_games": "Spiele",
    "section_games_sub": "Arcade-Spiele zum Verb-Training.",
    "section_reference": "Verb-Liste",
    "section_reference_sub": "Alle wichtigen unregelmäßigen Verben auf einen Blick.",
    "section_stats": "Deine Statistik",
    "section_stats_sub": "Was du kannst — und was noch nicht."
  },
  "drills": {
    "sprint": { "name": "Sprint", "tagline": "20 Verben, so schnell wie möglich.", "intro": "..." },
    "type_race": { "name": "Type Race", "tagline": "Tippe alle drei Formen. Schlag die Uhr.", "intro": "..." },
    "drag_match": { "name": "Drag Match", "tagline": "Verbinde Grundform und Simple Past.", "intro": "..." },
    "fill_gap":   { "name": "Lückentext", "tagline": "Setze die richtige Form ein.", "intro": "..." },
    "falling_forms": { "name": "Falling Forms", "tagline": "Tippe die richtige Form, bevor der Block unten ankommt.", "intro": "..." }
  },
  "tools": {
    "flashcards":   { "name": "Karteikarten", "tagline": "Klassisch lernen, in deinem Tempo." },
    "verb_table":   { "name": "Verb-Tabelle", "tagline": "Spalten verstecken und sich selbst abfragen." },
    "free_practice":{ "name": "Freies Üben", "tagline": "Üben ohne Zeitdruck, mit Hinweisen." }
  },
  "stats": {
    "title": "Deine Statistik",
    "overall": "Insgesamt",
    "total_attempts": "Antworten insgesamt",
    "to_review": "Zum Wiederholen",
    "mastered": "Schon gemeistert",
    "practice_these": "Diese jetzt üben",
    "no_data": "Übe ein paar Minuten — dann erscheinen hier deine Zahlen."
  },
  "reference": {
    "title": "Unregelmäßige Verben — Übersicht",
    "search_placeholder": "Verb suchen…",
    "sort_alpha": "A–Z",
    "sort_mastery": "Nach Können",
    "col_base": "Grundform",
    "col_past": "Simple Past",
    "col_pp": "Past Participle",
    "col_meaning": "Bedeutung",
    "col_mastery": "Dein Stand"
  },
  "feedback": {
    "correct_msgs": ["Richtig!", "Super!", "Genau!", "Stark!"],
    "wrong_msgs":   ["Knapp daneben!", "Probier's nochmal!", "Nicht ganz."]
  }
}
```

Fill in the `intro` fields with one-sentence instructions per drill. Phase 2 agents requiring additional strings must add them in the same nested structure, in the right namespace, with a German translation.

---

## 6. Stats Module

### File: `/lib/krabsy-stats.js`

ES module. Exports a singleton-style API. All drills and tools call this. **Arcade games do NOT call this.**

### Storage
- Single localStorage key: `krabsy_stats_v1`
- Value: one JSON blob (schema below)
- Versioned so future migrations don't wipe existing kids' data

### Storage schema

```json
{
  "version": 1,
  "verbs": {
    "fly": {
      "past":       { "attempts": 7, "correct": 5, "mastery": 3, "last_seen": "2026-05-19T12:34:00Z" },
      "participle": { "attempts": 6, "correct": 2, "mastery": 1, "last_seen": "2026-05-19T12:35:00Z" }
    },
    "go": { ... }
  },
  "overall": {
    "total_attempts": 152,
    "total_correct": 109,
    "best_streak": 14,
    "current_streak": 3,
    "first_seen": "2026-05-01T09:00:00Z",
    "sessions": 8
  }
}
```

### Mastery rules
- Per `(verb, form)` pair, mastery is an integer 0–5
- Correct answer: `mastery = min(5, mastery + 1)`
- Wrong answer: `mastery = max(0, mastery - 1)`
- **Decay:** at module load, for each `(verb, form)` where `last_seen` was more than **14 days ago**, drop mastery by 1 (floor 0) and update `last_seen` to today (so it doesn't double-decay on next load)
- Bands for display: 0 = "neu", 1–2 = "lernend", 3–4 = "vertraut", 5 = "gemeistert"

### Public API

```js
// Record one attempt. form = "past" | "participle". source = drill or tool name (e.g. "sprint", "flashcards").
recordAttempt(verbId, form, correct, source)

// Get stats for one verb. Returns { past: {...}, participle: {...} } or null.
getVerbStats(verbId)

// Top N strugglers — lowest mastery, then most recent. Returns [{ verb, form, mastery, last_seen }, ...].
getStrugglers(n = 10)

// Top N mastered — highest mastery, then most recent. Returns [{ verb, form, mastery, last_seen }, ...].
getMastered(n = 10)

// Overall summary. Returns { total_attempts, total_correct, accuracy, best_streak, current_streak, sessions }.
getOverall()

// Returns true iff the user has any recorded attempts. Used by the homepage progress widget.
hasData()

// Reset all stats (for the future "reset progress" button).
reset()

// Internal but exposed: decay pass. Called automatically on load. Idempotent.
runDecay()
```

### `source` strings (assign one per module — used for debugging / future analytics)
- `"sprint"`, `"type_race"`, `"drag_match"`, `"fill_gap"`, `"falling_forms"`
- `"flashcards"`, `"free_practice"`
- Verb Table tool does NOT record stats (no answer moment)

### Streak rules
- `current_streak` = consecutive correct answers across any session
- Resets to 0 on any wrong answer
- `best_streak` = max ever seen

---

## 7. Speed Drills

Each drill is a single self-contained HTML file (CSS + JS embedded) in its own folder. All five share these conventions:

- Landscape layout, max-width 960px, centered
- Three screens per drill: **Start** (title, tagline, "Los geht's" button, last best score), **Play**, **End** (score + accuracy + "Nochmal" + "Zurück zur Übersicht")
- Pull all UI strings from `ui_de.json`
- Pull all verb data from the data loader
- Call `recordAttempt` on every answer
- Best score stored in localStorage per drill (separate key per drill, e.g. `krabsy_best_sprint`)
- ESC key returns to homepage

### 7.1 Sprint — `/drills/sprint/index.html`

**Mechanic.** 20 fill-gap multiple-choice questions, three options each, tap as fast as possible. Pull difficulty-2 fill_gap questions, random verbs. Each question shows the verb on top, three answer chips below. No timer per question; one global stopwatch starts when the first question appears, stops when the 20th is answered. Wrong answer = +3 seconds penalty.

**Stats.** Each tap → `recordAttempt(verb, form, correct, "sprint")`. Form is `"past"` or `"participle"` depending on which the question targeted.

**End screen.** Total time, accuracy %, best time (from localStorage), bullet list of any verbs missed with their correct answer.

### 7.2 Type Race — `/drills/type-race/index.html`

**Mechanic.** 10 random verbs shown one at a time. For each: show the base form, two text inputs side by side (past, participle). User types both, presses Enter to submit. Whitespace-insensitive, lowercase comparison. One global stopwatch.

**Stats.** Each submitted form → `recordAttempt(verb, "past", isCorrect, "type_race")` and separately for participle.

**End screen.** Total time, accuracy %, best time, missed verbs with correct answers.

### 7.3 Drag Match — `/drills/drag-match/index.html`

**Mechanic.** 12 random verbs. Two columns: left = base forms in order, right = past forms shuffled. User drags a past form to its base form (or taps base → taps past — both must work, drag is desktop-only). Stopwatch starts on first interaction, stops when all 12 pairs are correct. Wrong drop snaps back and adds +2 seconds.

**Stats.** Each match attempt → `recordAttempt(verb, "past", isCorrect, "drag_match")`.

**End screen.** Total time, attempts, best time.

**Note.** Only tests past forms (not participles) — keeps the puzzle compact. If we want participle mode later, add a toggle on the start screen.

### 7.4 Fill the Gap — `/drills/fill-the-gap/index.html`

**Mechanic.** 10 difficulty-4 in-context questions. Each shows a full sentence with one verb blanked, plus the base form of the verb in parentheses (e.g. "Yesterday she ___ (to fly) to Berlin."). Single text input. User types the correct form, presses Enter. Tense must be inferred from context. Stopwatch global.

**Stats.** `recordAttempt(verb, form, isCorrect, "fill_gap")` — form determined by which form the answer expects.

**End screen.** Time, accuracy, best time, missed sentences with correct form highlighted.

### 7.5 Falling Forms — `/drills/falling-forms/index.html`

**Mechanic.** Adapted from ser/estar. A sentence-with-blank block falls from the top of the play area. Two answer chips ride along *inside* the block — the correct form and one distractor (use `wrong_answers[0]` from the question entry). Player taps the correct chip before the block hits the bottom. Hit bottom unanswered = wrong + lose a life. 3 lives total. Speed increases every 5 correct answers. Endless mode, ends on 3rd life lost.

**Stats.** Each tap → `recordAttempt(verb, form, isCorrect, "falling_forms")`.

**End screen.** Score (= correct answers), best score, accuracy, missed forms.

**Visual style note.** Use Krabsy brand colors. The ser/estar file's dark palette is **not** the look — light cream background, lavender/sage blocks, coral for correct/wrong feedback flashes. Keep its block-with-chip-buttons *layout* idea but redress entirely.

---

## 8. Study Tools

Same conventions as drills (single HTML file per folder, three-screen structure where applicable, UI strings from `ui_de.json`). Tools are calmer — no timers, no scoring, no lives.

### 8.1 Flashcards — `/tools/flashcards/index.html`

**Mechanic.** Standard flashcard interface. Deck = all 60 verbs (or a filtered subset by mastery — settings panel: "Alle / Nur zu wiederholende / Nur gemeisterte"). Card front: base form, large. Tap/click to flip. Card back: simple past + past participle, both visible. Below the card: two buttons — **"Schon gewusst"** (got it) and **"Nochmal"** (again).

**Stats.** "Schon gewusst" → `recordAttempt(verb, "past", true, "flashcards")` AND `recordAttempt(verb, "participle", true, "flashcards")`. "Nochmal" → two `false` calls. (Both forms recorded since both were on the card.)

**Settings.** Save filter choice in localStorage.

### 8.2 Verb Table — `/tools/verb-table/index.html`

**Mechanic.** Pure hide-and-reveal study aid. Wide table: Verb | Simple Past | Past Participle | Bedeutung (German meaning — add to data as `meaning_de` field on the verb-level). Column headers are clickable: clicking a header hides that column (replace cells with "•••"). Click again to reveal. Three checkbox toggles above the table for clearer UX: "Past verstecken", "Participle verstecken", "Bedeutung verstecken". Search box filters by typed letters. Sort by base form alphabetically.

**Stats.** **None.** No answer moment.

### 8.3 Free Practice — `/tools/free-practice/index.html`

**Mechanic.** Same engine as Type Race but: no timer, no fixed length (endless), hint button on every question (reveals the verb's `hint` field). User can skip any question. Optional filter at start: "Alle Verben / Nur schwache Verben" (the latter calls `getStrugglers(20)` and only quizzes those).

**Stats.** Each typed form → `recordAttempt(verb, form, isCorrect, "free_practice")`. Skipped = no record.

**Progress strip at top.** Live mini-display: session attempts, accuracy %, current streak. No leaderboard, no end screen — user clicks "Fertig" to return to hub.

---

## 9. Verb Reference — `/reference/index.html`

Sortable, filterable table. Five columns:

| Column | Source | Behavior |
|---|---|---|
| Grundform | verb base | Sortable A–Z |
| Simple Past | derived | Display only |
| Past Participle | derived | Display only |
| Bedeutung | `meaning_de` | Display only |
| Dein Stand | `getVerbStats(verb)` mastery (max of past + participle) | Sortable, displayed as 5-segment bar |

**Controls above the table:**
- Search box (filters by base form OR German meaning, case-insensitive)
- Sort toggle: A–Z / Nach Können (mastery ascending — strugglers on top)

**Mobile.** On narrow screens, collapse Bedeutung column. Don't ship a separate mobile layout — let the table scroll horizontally if needed.

**No individual verb pages.** Just the table.

---

## 10. Statistics Page — `/stats/index.html`

Single page, four stacked blocks. All data via `krabsy-stats.js`. Empty state: if `hasData()` is false, show only a friendly "Übe ein paar Minuten — dann erscheinen hier deine Zahlen." with a coral button back to the hub.

### Block 1 — Overall
Big numbers, side by side:
- Total attempts
- Accuracy %
- Current streak (with little 🔥 icon if ≥3)
- Best streak

### Block 2 — Zum Wiederholen (To Review)
Top 10 from `getStrugglers(10)`. Each row: verb, form ("Past" / "Participle"), 5-segment mastery bar, last-seen date. Single "Diese jetzt üben" button at the bottom of the block that opens Free Practice with those 10 verbs preloaded (pass verb IDs via URL query param, e.g. `/tools/free-practice/?verbs=fly,go,eat,...`).

### Block 3 — Schon gemeistert (Mastered)
Top 10 from `getMastered(10)`. Same row layout. No action button — this block is pure encouragement.

### Block 4 — Volle Verb-Liste
Same data as `/reference/` but with extra columns: attempts count and accuracy per verb. Sortable by every column. This is the deep-dive view.

**Reset button.** At the very bottom, small: "Fortschritt zurücksetzen". Confirmation dialog. Calls `reset()`.

---

## 11. Progress Widget (on homepage)

A horizontal strip between the hero and the first section. Built directly into `/index.html` (no separate file). Reads from `krabsy-stats.js`.

**If `hasData()` returns false:** show nothing (or a single subtle "Starte einen Drill, um deinen Fortschritt zu verfolgen" line).

**If true:** show four compact tiles:
1. **Genauigkeit** — accuracy % with a small ring indicator
2. **Serie** — current streak with 🔥
3. **Heute zu üben** — top 3 strugglers as small chips ("fly · past", "go · participle", "eat · past"), tapping any chip opens Free Practice filtered to that one verb
4. **Zur Statistik** — link button to `/stats/`

Compact, single row on desktop, wraps to two rows on tablet. Brand-aligned (lavender cards, coral accents on the streak number).

---

## 12. Homepage — `/index.html`

The final assembly. Pulls everything together. Single self-contained HTML file (no framework, no build step), embedded CSS and minimal JS.

### Sections in order

1. **Header** — Krabsy logo, DE/ES toggle. Toggle just swaps `localStorage.krabsy_lang` and reloads the page for now (real i18n routing is future work).
2. **Hero** — Crab mascot, `hero_title`, `hero_sub`.
3. **Progress Widget** (Section 11).
4. **Speed Drills section** — 5 cards in a 5-column grid (desktop) / 2-col (tablet) / 1-col (narrow). Each card: drill name (Limelight), tagline (Verdana), small "Spielen" button. Cards link to `/drills/<slug>/`.
5. **Study Tools section** — 3 cards, same pattern, link to `/tools/<slug>/`.
6. **Games section** — 5 existing games + the two "Bald verfügbar" placeholders. Keep the existing card design as much as possible (pencil placeholder, name, tagline, BETA badge). Cards link to `/games/<existing-file>.html`.
7. **Verb Reference section** — single wide card. Link to `/reference/`.
8. **Statistics section** — single wide card with a peek at total attempts if `hasData()` is true. Link to `/stats/`.
9. **Footer** — copyright, language toggle echo, "Mehr Grammatik-Themen folgen bald."

### Visual style
Cream background, generous vertical spacing between sections, section headings in Limelight, taglines in Verdana. Cards lift slightly on hover (`transform: translateY(-2px)`, no box-shadow animation per perf rules).

### Required JS on homepage
- Load stats module and conditionally render progress widget
- Hook up language toggle
- That's it — no client-side routing, no SPA behavior

---

## 13. File Structure (final)

```
/
├── index.html                            # Homepage (Phase 3)
├── data/
│   ├── irregular-verbs.json              # Phase 1
│   ├── ui_de.json                        # Phase 1
│   └── ui_es.json                        # Future
├── lib/
│   ├── krabsy-stats.js                   # Phase 1
│   ├── krabsy-data.js                    # Phase 1
│   └── krabsy-ui.css                     # Phase 1
├── drills/
│   ├── sprint/index.html                 # Phase 2
│   ├── type-race/index.html              # Phase 2
│   ├── drag-match/index.html             # Phase 2
│   ├── fill-the-gap/index.html           # Phase 2
│   └── falling-forms/index.html          # Phase 2
├── tools/
│   ├── flashcards/index.html             # Phase 2
│   ├── verb-table/index.html             # Phase 2
│   └── free-practice/index.html          # Phase 2
├── reference/
│   └── index.html                        # Phase 2
├── stats/
│   └── index.html                        # Phase 2
└── games/                                # Existing — DO NOT MODIFY
    ├── krabsy-verb-slashGN.html
    ├── crab-slash.html
    ├── air-control.html
    ├── verb-snake.html
    └── verb-platformer.html
```

---

## 14. Build Order Recommendation

### Pass 1 — Phase 1 (single agent, ~one session)
Build all five Phase 1 outputs in this order:
1. `irregular-verbs.json` (longest — gets it out of the way)
2. `ui_de.json`
3. `krabsy-ui.css`
4. `krabsy-data.js`
5. `krabsy-stats.js` (last, so you can test it loads the data correctly)

Verify all five load without errors via a minimal test HTML file in `/lib/test.html` (delete after).

### Pass 2 — Phase 2 (parallel agents, up to 10)
Dispatch one agent per module. Each receives:
- This document, Section 1 and the section for its specific module
- Read access to all of `/lib/` and `/data/`
- Write access only to its assigned folder

Recommended priority if not running all 10 at once:
- **First wave (4):** Sprint, Flashcards, Verb Reference, Verb Table — these are the simplest and fastest to validate the Phase 1 contracts.
- **Second wave (3):** Type Race, Free Practice, Statistics page — type input + stats reading.
- **Third wave (3):** Drag Match, Fill the Gap, Falling Forms — the more complex interactions.

### Pass 3 — Phase 3 (single agent)
Build the homepage. Verify every link works. Test the progress widget with both empty and populated stats (use the stats module's `reset()` and then run a drill to populate, to confirm both states render correctly).

### Post-build
- Smoke test: do one full play-through of each drill and tool
- Verify the stats page reflects the play-through
- Verify the homepage progress widget appears and updates
- Verify language toggle UI exists (Spanish content not required yet)

---

## 15. Out of Scope (for this build)

Explicitly **not** in this brief, to prevent scope creep:

- Spanish translation (`ui_es.json` and `/es/` routing)
- Restyling existing arcade games
- Adding stats to existing arcade games
- Backend / accounts / cross-device sync
- Spaced repetition algorithms beyond the simple decay rule
- Heatmaps, calendar streaks, time-series charts on stats page
- Individual verb reference pages (only the table)
- Sound effects (each drill may add its own if it improves feel, but no shared sound system)
- Classroom mode, multiplayer, leaderboards beyond local-only best scores
- Other grammar topics (tenses, prepositions, etc.)
- New games beyond the existing 5

If you (Claude Code) find yourself wanting to add something from this list, stop and ask first.

---

## 16. Open Questions

These are flagged for Jan to decide before or during the build:

1. **Drag Match mobile fallback** — drag-and-drop on touch is finicky. The spec says tap-base-then-tap-past also works. Confirm that's an acceptable mobile experience, or whether we drop Drag Match from mobile entirely.
2. **Verb meanings** — German meanings (`meaning_de`) need to be authored alongside the verb data. Phase 1 agent should generate these, but Jan should spot-check.
3. **"Coming soon" placeholders** in the Games section — keep them or remove them until those games actually exist?

---

*End of brief.*

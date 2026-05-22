# Krabsy — Work Log & Project Context

This document is the long-term project memory for Krabsy. It exists so a
fresh Claude Code session (or any new collaborator) can read it once and
understand what we're building, why, and what's currently true.

The code itself tells you HOW things work. This document tells you the
WHY behind decisions, who's involved, what's strategic, and what's been
deliberately deferred. Without this context, well-meaning suggestions
tend to over-engineer or pull the project in directions that conflict
with the business reality.

CC: when you read this, also `git log --oneline -50` and skim the recent
commits — this doc lags reality by however long since the last update.

---

## What Krabsy is (in one paragraph)

Krabsy is a free, browser-based educational gaming platform that teaches
English grammar to children aged 10-14 in European and Latin American
markets. The pitch is not "learning with game aesthetics" — it's real
games (runners, tower defense, fruit-ninja-style, falling-object) that
happen to teach English grammar. The benchmark is whether a 12-year-old
would play voluntarily, not whether a teacher would assign it.

URL: krabsy.com. Currently live with one topic (irregular verbs) and
preparing to launch a second (prepositions).

## Why this project exists, strategically

There is essentially no competition in English grammar gaming for
European/LatAm schoolchildren. The math equivalent (Prodigy, Khan
Academy, IXL) is saturated; the English grammar equivalent is empty.
Existing competitors are boring quiz sites and worksheet generators —
not games. This is Krabsy's structural advantage and the reason the
project is worth building.

The real competition isn't other learning platforms. It's TikTok,
YouTube, and Fortnite. The games must be genuinely engaging or kids
won't choose them. This is the single most important design principle
on the project.

## Business model & strategy

**Model:** Free practice tool tied to school curriculum. Organic discovery
through SEO. Monetised through non-intrusive ads (GDPR-/child-privacy
compliant) and, eventually, freemium subscriptions (€3-4/month for ad-
free + classroom mode).

**Strategic mirror:** Krabsy follows the playbook of einmaleins.de (a
German math site Jan knows the owner of). Same SEO-first strategy, same
free-tier-with-ads model, same per-topic landing page approach. The
einmaleins.de family includes sister sites (timetables.co.uk,
tablesdemultiplication.fr, etc.) — relevant because they validate the
multi-language version of the same playbook.

**Critical content constraint:** Irregular verbs alone is a leaky bucket.
Kids master ~150 verbs in 2-4 weeks and leave forever. The platform's
survival depends on having enough grammar topics to keep kids returning
for months. Every architecture decision should assume 10+ grammar topics
eventually. Irregular verbs is the entry point, not the product.

**Markets, in priority order:** Germany, Spain (+ all Spanish-speaking
LatAm), France, Italy, Netherlands, Poland. German first because that's
Jan's strongest market and where his teacher contacts are. Spanish next
because Spain + LatAm is a massive English-learning population with low
competition.

**Cost discipline:** The project's competitive advantage is that it costs
near-zero to run (static site, no backend, no auth). Keep it that way
until revenue justifies spending. No databases until traffic demands
them. No user auth until subscriptions ship. localStorage over backend
storage. Static JSON over dynamic content.

## People & roles

**Jan** (project owner) — All technical development. Unity games,
HTML5 games, platform infrastructure, deployment. Works through Claude
Code for implementation, web Claude for planning.

**Mika** (designer, friend) — Visual identity, brand assets, Unity game
art, homepage mockups, UI/UX direction. Delivers asset packs (PNG/SVG)
for HTML5/web; pushes to GitHub for Unity. Paid per deliverable once
revenue exists; potential revenue share if the project scales.

**Workflow with Mika:** Jan builds functionality with placeholders →
Mika skins/polishes → iterate. Don't block on Mika for prototyping; do
hand her a precise asset list once a mechanic is validated.

**Teacher contact** — Friend who teaches English to German schoolchildren.
Available for occasional content validation (curriculum fit) and class
beta-testing of finished features. Don't lean on her heavily; one
20-30 minute ask per major content addition is the right cadence.

**einmaleins.de owner** — Friend, runs a math site with existing
traffic. Krabsy's Unity games (a runner and a tower defense) are being
built FIRST for einmaleins.de with multiplication content (younger
audience, ages 6-10), then adapted for Krabsy with English grammar
content. This gives Jan free playtesting at scale on a site with
existing traffic before Krabsy even launches the Unity games.

Implication: the Unity games when they arrive on Krabsy will need
significant aesthetic upgrades. einmaleins.de targets ages 6-10; Krabsy
targets 10-14. A 13-year-old will not play something that looks like
it was built for a 7-year-old.

## Brand & design

**Mascot:** A coral crab. Multiple poses planned (happy, thinking,
celebrating, wrong-answer, idle). The crab is the brand identity.

**Theme:** Ocean/beach, but restrained. Clean and modern, not cluttered.

**Tone:** Fun, encouraging, slightly cheeky. Never condescending.
Mental model: "cool older sibling helping with homework," not "teacher
explaining a worksheet."

**Color palette (locked, don't deviate):**
- Lavender: `#babfd8`
- Sage: `#cdd9b4`
- Coral: `#f2937e`
- Cream: `#fdfaf3`
- Ink: `#2c2a3a`

**Fonts:** Limelight (display) + Verdana (body).

These tokens live in `/lib/krabsy-ui.css` as CSS variables. Use them.

## Technical architecture

**Stack:** Plain HTML/CSS/JS, no framework. Static site. No build step.

**Hosting:** Hetzner server managed via Coolify. Auto-deploys from the
GitHub repo on push to main.

**Storage:** Question content as static JSON in `/data/`. Player progress
in localStorage. No backend, no database.

**Routing:** Subdirectory localisation — `/de/` and `/es/` are the only
language roots that matter now. Topics live one level deeper:
`/de/unregelmaessige-verben/`, `/de/praepositionen/`, etc.

**Performance baseline:** Budget tablets are a real constraint. Avoid
`backdrop-filter`, `drop-shadow`, `filter: blur()`, `text-shadow`, and
`box-shadow` on animated elements. Use `transform: translate()` for
motion (GPU compositing).

**Mobile/desktop:** Despite the original brief mentioning mobile-first,
the target audience is on desktop and tablets more than phones during
study time. Landscape ratio for games. Don't sacrifice desktop UX for
mobile.

## Content architecture

**Topics in development order:**
1. Irregular verbs (LIVE — ~155 verbs)
2. Prepositions (LIVE as of recent work — 46 use-case rules)
3. Tenses (planned next)
4. If-clauses
5. Prepositions (deeper coverage)
6. Phrasal verbs
7. Passive voice
8. Reported speech
9. Comparatives/superlatives
10. Modal verbs

**Question database principle:** One universal database, topic-scoped.
Grammar content is language-independent (English verbs are English
verbs); UI translations are stored separately so adding a new language
doesn't require regenerating question content.

**Difficulty levels (aspirational, not yet authored across all topics):**
1. Recognition with obviously wrong distractors
2. Recall with plausible distractors
3. Pure recall, typed input
4. In context, tense awareness
5. Mixed and tricky

**Question types:** Fill the gap (MC), transform, pick correct form,
spot the error. The same content powers all games via type/difficulty
filtering.

## Drills & tools (current shipped surface)

CC: file paths are indicative; read the actual directory tree to confirm.

**Per-topic structure** mirrors between verbs (live) and prepositions
(live). Each topic has a hub page that links to its drills, tools,
reference, and stats.

**Drill mechanics that exist (verb side, full set):** Sprint (in-page MC
speed drill), Type Race (iframe, two-input typing), Drag Match (iframe,
match-three-forms), Fill the Gap (iframe, sentence with blank), Falling
Forms (iframe, falling-block reflex game — currently has a known bug
on the verb side).

**Drill mechanics on prepositions side:** Sprint and Fill the Gap only.
Type Race, Drag Match, and Falling Forms were investigated and
deliberately skipped — see DECISIONS below.

**Tools shipped (both topics):** Karteikarten/Flashcards, Freies Üben/
Free Practice. Verb side additionally has a Verb-Tabelle (verb table
with hide-columns mechanic) — no equivalent on prepositions side
because the data shape doesn't fit a table.

**Reference pages:** Verbs use a sortable searchable table. Prepositions
use a categorised card layout (newer design, more visually rich).

**Arcade-game layer:** Cross-topic, lives at `/de/spiele/` and
`/es/juegos/`. Games declare topic affinity via `games.json` metadata.
Currently 5 games shipped (verb-affinity), 0 prep-affinity.

## Key decisions made (and why)

**Static everything, no backend.** Cost discipline + the architecture
of the question database means a backend doesn't add value yet. Earned
by traffic, not assumed.

**Topic-scoped activities, platform-wide games.** Drills and tools
live under `/de/<topic>/<activity>/` because they're topic-specific.
Arcade games live at `/de/spiele/` because they're cross-topic — a
runner game can teach verbs or prepositions or tenses interchangeably,
and forcing kids to pick a topic before choosing a game would feel
artificial.

**Multi-topic architecture before multi-topic content.** The platform
restructure to support multiple topics happened before the second topic
had any content. This was the right call — it forced clean abstractions
and the second topic dropped in without major code churn.

**Drag Match and Type Race skipped for prepositions.** Drag Match's
identity is the two-stage past→participle progression, which doesn't
exist in preposition grammar. Type Race adapted to one input is
mechanically indistinguishable from Fill the Gap, so shipping both
would dilute both. Prepositions ships 2 drills, not 4. This decision
came out of a formal investigation; the investigation report is in the
git history.

**Iframes self-fetch via `?topic=` URL param.** When iframe drills need
topic-aware data, they read the topic from their src URL and fetch the
right JSON themselves. The wrapper page is responsible for setting the
src; the iframe is responsible for parsing it. This pattern is used by
Fill the Gap; other iframes still carry hardcoded verb arrays.

**L1-interference distractors.** Preposition content is engineered to
include German and Spanish interference errors as distractors. Germans
say "discuss about" (from *diskutieren über*); Spanish speakers say
"depend of" (from *depender de*). The data file tags these via
`l1_traps` so they can power smarter feedback later.

## Deliberately deferred

These are known gaps, intentionally not addressed yet:

- **Stats page for prepositions.** Verb stats page is shipped; prep
  stats deferred until cross-topic stats UX is designed. Stats DATA is
  being recorded correctly, just no UI to view it.
- **Type Race's `BEST_KEY` collision bug.** Type Race writes to the same
  localStorage slot as Fill the Gap, so they overwrite each other.
  Known, surfaced, needs a fix-with-migration.
- **Falling Forms verb-side bug.** Renders Sprint layout instead of
  sentence-with-blank. Known, separate fix-it task.
- **Hub CSS duplication.** ~290 lines of identical CSS across 4 hub
  files. Defer until topic 3 lands and we can see which patterns are
  truly shared vs hub-specific.
- **ES verb hub `inLanguage: "de"` SEO bug.** One-line fix, bundle into
  next SEO sweep.
- **Difficulty selection in Sprint.** Hardcoded to difficulty 2; prep
  data has 1-3 available. Surface as player choice in a future task.
- **Prep-specific banner image from Mika.** Currently using verb banner
  as placeholder; replace when Mika delivers.
- **`initToolPage` allow-list could become topics.json-derived** instead
  of caller-provided. Currently caller-provided because of an earlier
  empty `topics.json` pages map; now that the map is populated, the
  cleaner approach is viable. Defer until next time `krabsy-nav.js`
  needs to be touched.

## How Jan likes to work

**Investigate-then-implement.** For any non-trivial CC task, the first
prompt is read-only investigation: "look at these files, propose what
needs to change, surface what you find." The second prompt is the
implementation, written by web-Claude using the investigation as input.
This pattern has caught real architectural mismatches before they
became bugs. Use it for anything touching shared lib code or data
shapes.

**Direct feedback, one to three issues per round.** Jan reviews CC
deliverables with specific feedback, not broad redesign asks. CC
should mirror this: when reporting back, lead with what was done,
then flag concrete issues you want decisions on. Don't drown reports
in caveats.

**Push back when you disagree.** If a planned approach has a real
problem, say so. Don't be agreeable to be agreeable. Examples in the
project history where pushback changed outcomes: skipping Drag Match
for prepositions; using deep-merge i18n overrides instead of parallel
keys; using cards instead of a table for the prep reference.

**Scope discipline.** Jan reliably catches and corrects scope creep.
If a CC task is growing past its initial bounds, surface the question
of "should we still ship this, or split it?" rather than just doing
more.

## Operational details

**Dev environment:** WSL (Ubuntu) on Windows. File access via
`\\wsl$\Ubuntu\...` in Windows Explorer.

**Deployment:** Push to main → Coolify auto-deploys. SSL via Let's
Encrypt (Coolify-managed). No build step required.

**Analytics:** `api.krabsy.com` is deployed and working. Don't touch
analytics infrastructure as part of feature work.

**Legal pages:** Stable. Don't touch as part of feature work.

## Repo conventions

CC: confirm these from the actual codebase. Things that should be true:

- Topic IDs in JS/JSON use snake_case (`irregular_verbs`, `prepositions`).
- Page IDs in `topics.json` use hyphen-form slugs (`fill-the-gap`,
  `free-practice`).
- Drill keys in `krabsy-nav.js` `DRILLS` array use snake_case
  (`fill_gap`, `type_race`).
- These three conventions live in different layers and aren't going
  to be unified — be deliberate when crossing layers.

## Session log

Each work session ends with a 3-5 bullet entry here. Newest at the top.
CC: when starting fresh, read the top 5-10 entries to know what just
happened.

**[2026-05-22] — Prep banner art: in/on/at + for/by/to bubbles**
- The prep topic was using the bare `/thumbnails/banner.png` (crab on
  sand with mostly-empty cream sky). Filled the empty area with six
  preposition speech bubbles matching the verb thumbnail's style:
  three main bubbles (`in` lavender, `on` sage, `at` coral) plus three
  smaller satellites (`for`, `by`, `to`) for visual balance.
- Generated programmatically — `/tmp/add_prep_bubbles.py` reads the
  bubble-free original from commit `30c094c` each run, so re-running
  doesn't stack bubbles. Edit the `bubbles` list (text / colour /
  angle / position / scale / ticks) and re-run to iterate later.
- Used Ubuntu variable font at weight 700, Pillow `set_variation_by_axes`.
  Tick accents only on the main trio so satellites read as background.
- Shipped as commits `a47357c` (initial trio) and `6401d5c` (added
  satellites).

**[2026-05-22] — Big session: content expansion + site-wide nav restructure**

*Content side:*
- Prep rules expanded from 46 → **99 rules** / 297 example sentences.
  Tier 1 + Tier 2 from the englishrevealed.co.uk B1 inventory; new
  `phrase` group covers fixed expressions (`on time`, `in fact`,
  `by accident`, etc.).
- Adopted CEFR levels internally (`level: 1|2|3|4` per rule, mapping to
  A1/A2/B1/B2). UI surfaces them as friendly **Level 1-4 / Stufe 1-4 /
  Nivel 1-4** badges on the reference cards. Decided against showing
  the raw CEFR code to kids — adults/SEO still get value via the
  internal field. Drove the chip rendering through `loadPrepositionReference`
  in `lib/krabsy-data.js`.
- **L1 trap field removed entirely** after Jan tested live and found
  them unconvincing. Trap rendering blocks gone from reference (DE+ES)
  and Karteikarten (DE+ES), trap data stripped from JSON, `l1_trap_label`
  i18n key dropped. SEO descriptions updated to remove the "klassische
  Fallen für Deutsche / trampas clásicas para hispanohablantes" hooks.
- Lückentext intros & SEO copy fixed across **all 4 wrappers**
  (prep DE/ES + verb DE/ES). They were stale from when the game had
  a falling-block mechanic — the actual game has been static
  (`BLOCK_FIXED_Y`) for a while. Same pass also fixed the in-game start
  window: `<h1>` was still "Falling Forms", tagline still said "Fülle
  beide Lücken, bevor der Block unten ankommt", input placeholder
  was verb-specific. Made `games/fill-the-gap.html` topic-aware via a
  small `TOPIC_STRINGS` overlay so prep/verb modes get correctly-
  worded copy without forking the file.
- Prep drills had a giveaway bug: the "Muster: interested + in" hint
  shown above each question literally contained the answer. Hidden
  behind a `[?] Tipp` / `[?] Pista` button in **Sprint (prep DE+ES)**
  and **Fill the Gap (prep mode only)**; state resets each new
  question. Verb side untouched — there the hint is the base form,
  which IS the question.

*Architecture side (the bigger one):*
- Added **persistent topic chip-bar in every page header**
  via a new `lib/krabsy-topic-nav.js` (plain script, same model as
  `krabsy-footer.js`): `[krabsy] [Verben] [Präpositionen] · [Spiele]
  [DE | ES]`. Active chip = current URL's topic. Driven by
  `topics.json` so adding a topic = single JSON edit. Coming-soon
  topics render strikethrough. `Spiele/Juegos` is intentionally
  separated by a `·` to signal "different kind of destination".
- **Expanded footer grid** (`Themen / Spiele / Über` columns) injected
  by an extended `krabsy-footer.js`. Reads `topics.json` + `data/games.json`
  so footer link surface scales automatically with topics + games.
- **Spiele strip on lang hubs** between topic catalog and About —
  compact tile row (5→4→3→2 columns by viewport). Kids in "just let
  me play" mode reach a game in one click without picking a topic
  first.
- **Visible H1 on topic hubs** — was `k-visually-hidden` for SEO only.
  Now shows the topic name plainly: "Unregelmäßige Verben lernen" /
  "Englische Präpositionen üben" / "Aprende verbos irregulares en
  inglés" / "Preposiciones en inglés". The generic "Meistere
  Englisch — Spiel für Spiel!" tagline was a brand line on the lang
  hub leaking into topic hubs; removed.
- **Back-arrow removed from 30 inner pages** (drills, tools, reference,
  stats). The active chip in the header chip-bar now performs the
  "go to topic hub" function. Logo still goes to the lang hub.
- **Footer class normalised** — 4 topic hubs used `<footer class="footer">`
  instead of `k-footer`; renamed and dropped the local `.footer` /
  `.footer-more` CSS dupes plus the stale "Mehr Themen folgen bald" span.
- **Cache-bust on `krabsy-ui.css`** — every page now references it
  with `?v=2026-05-24`. The HTML had aggressive no-cache meta but
  the stylesheet didn't; browsers were happily serving the old
  stylesheet without the new chip-bar / footer-grid styles.
- All 44 pages now load `krabsy-topic-nav.js`. Script injection done
  via a Python pass anchored on the existing `krabsy-footer.js` line.

*Known follow-ups (deferred):*
- Drill pages historically don't include the `DE | ES` lang toggle in
  their header. With the back-arrow gone, those headers now show
  `[logo] [chip-bar]` without a lang switcher. Acceptable for now,
  worth adding the lang toggle to drill headers in a follow-up.
- `es/verbos-irregulares/fill-the-gap/index.html` SEO meta is **in
  German** on a Spanish page (lines 8/17/25/33). Pre-existing bug
  from a stale SEO sweep, not addressed in this session.

**[2026-05-22] — Initial doc creation**
- Created this WORK_LOG.md as long-term project memory.
- Drafted by web-Claude based on accumulated project context from a
  multi-session planning thread that produced the prep topic launch.
- Replaces the now-deleted `krabsy-homepage-brief.md` (Mar 2026, pre-hub
  arcade-only homepage) and `krabsy-hub-build-brief.md` (May 2026,
  irregular-verbs hub build) — both superseded by current architecture.
- CC to expand sections on technical architecture, current shipped
  surface, and repo conventions over time by reading the actual codebase.

**[2026-05-22 — uncommitted in working tree] — Prepositions topic launch**
- Prepositions topic launched end-to-end: hub at `/de/praepositionen/`
  and `/es/preposiciones/`, 2 drills (Sprint, Fill the Gap), 2 tools
  (Karteikarten, Freies Üben), reference page, sitemap entries.
- Data layer (`lib/krabsy-data.js`) generalised to be topic-aware —
  fetches `data/prepositions.json` when topic=`prepositions`, falls back
  to verbs otherwise. Same change in `krabsy-nav.js` and `krabsy-stats.js`.
- `data/prepositions.json` authored: 46 use-case rules, L1-interference
  distractors tagged via `l1_traps` (German + Spanish).
- `games/fill-the-gap.html` iframe self-fetches via `?topic=` URL param —
  the pattern that other iframes will eventually follow.
- `_verify_prep_ship.mjs` written as a one-shot verification script;
  delete or formalise after the launch lands on main.
- Status: changes are STAGED but UNCOMMITTED. Verify with `git status`
  and `git diff --stat` before assuming the launch is shipped.

**[2026-05-21 — commit 30c094c] — URL restructure into per-topic trees**
- Restructured URLs from flat `/de/sprint/` to per-topic
  `/de/<topic>/sprint/`. Topic + games hubs added.
- Drills moved into iframe wrappers around `/games/` self-contained
  apps (commit 46e203e).
- Intro orientation block added to drill, tool, reference, and stats
  pages (commit 1b8b81d).
- This was the multi-topic enabling work that made the prep launch
  drop-in possible.

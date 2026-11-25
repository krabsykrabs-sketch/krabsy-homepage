# Unterrichtsideen / Ideas para clase: plan (2026-11-25)

Why: englishonline.training (one Berlin teacher's site, likely AI-written) wins
teachers with **"Teacher Notes"**: ready-to-run lesson plans with set times, a
materials list and support/challenge tasks. It also sorts everything by
**school year** ("Klasse 9 Gymnasium"). It has no worksheets, no answer keys and
no class overview. Krabsy has those (11 worksheet PDFs, class code, Quiz-Raum,
practice links, word overview) but no lesson plans and no year/level labels.
Teachers search "Klasse 6 unregelmäßige Verben Stunde", not "Verb Kitchen".

Goal: a small, high-quality lesson-plan section that turns the existing tools
into lessons a teacher can run tomorrow. Each plan exists as a web page (SEO,
sharing) **and** a one-page printable PDF (4teachers upload, staff room).

## Where

| Language | Hub | Plan page |
|---|---|---|
| DE | `/de/lehrkraefte/unterrichtsideen/` | `/de/lehrkraefte/unterrichtsideen/<slug>/` + `<slug>.pdf` |
| ES | `/es/docentes/ideas-para-clase/` | `/es/docentes/ideas-para-clase/<slug>/` + PDF |
| EN Spanish | later, after the Spanish pilot has users | `/en/spanish/teachers/lesson-ideas/` |

The teacher page's section "Zwei Ideen für die Stunde" becomes a teaser: the two
existing ideas stay, plus "Alle Unterrichtsideen →". Link from the worksheet
pages too ("Mit diesem Blatt: Stundenablauf").

## One template for every plan

1. **Auf einen Blick** box: Klasse, Niveau (GER/CEFR), Dauer, Geräte (Handy /
   Tablet / Computerraum / keine), Material, Lösungsblatt ja/nein, Kosten
   ("kostenlos, ohne Anmeldung").
2. **Vorbereitung**: what to do before the lesson (≤ 5 minutes), with QR code.
3. **Ablauf**: a table of timed steps (minute ranges), each with the exact URL.
4. **Leichter / Schwerer**: one support and one challenge option per plan.
5. **Ohne Geräte**: fallback if Wi-Fi or devices fail (every plan must work on
   paper only).
6. **Danach**: what the class overview shows, the homework.
7. Footer: Datenschutz in two lines, "Stand: <Monat Jahr>".

Rules:
- Facts must match the live site (same rule as `tools/generate_teacher_guide.py`).
  Every URL in a plan is checked by the generator (file exists under `homepage/`).
- No grammar terms as tasks for the children (presentation mandate); fine in
  the teacher-facing text.
- No usage anecdotes (no Uruguay), no "built by AI" tone: short, concrete, no
  "not X but Y" lines.

## Content: first set (DE)

| # | Plan | Klasse / Niveau | Dauer | Uses | New material needed |
|---|---|---|---|---|---|
| 1 | Unregelmäßige Verben in der Vertretungsstunde | 5–8 · A1–A2 | 45 | class code, Sprint, "Die drei Formen", Verb-Diplom | none (exists as PDF) |
| 2 | in, on, at: Präpositionen der Zeit und des Ortes | 5–6 · A1 | 45 | Präpositionen Sprint, Fill the Gap, worksheet "Zeit und Ort", Quiz-Raum | none |
| 3 | Quiz-Raum als Stundenabschluss | 5–9 · A1–A2 | 10–15 | Quiz-Raum (verbs or prepositions) | none |
| 4 | Vor der Klassenarbeit: Wiederholung mit der Wortübersicht | 6–8 · A2 | 45 | class code overview, practice link with `difficulty`, worksheet Lückentext | none |
| 5 | Eine Woche Hausaufgabe: 10 Minuten am Tag | 5–7 · A1–A2 | 5 × 10 | practice link `from=teacher`, Verb Kitchen, Verb-Diplom on day 5 | none |
| 6 | (seasonal) Winter- und Weihnachtsgeschichte mit unregelmäßigen Verben | 6–7 · A2 | 45 | Sprint, new gap-text story sheet, Quiz-Raum | **new worksheet** |

#6 only if it can be live by ~5 December; otherwise skip to next year (an
Advent lesson published on 20 Dec is useless).

Klasse labels: irregular verbs are taught from Klasse 5–6 (simple past usually
Klasse 6, present perfect 6–7); prepositions of time/place Klasse 5. Check this
against 2–3 Bundesländer curricula before publishing and keep the labels as
ranges.

ES: translate 1–5 (same tools exist in ES). Use age and level ("12–14 años ·
A1–A2") instead of German Klassen.

## Build

- **One generator, one source per plan.** Turn
  `tools/generate_teacher_guide.py` into `tools/generate_lesson_plans.py`: each
  plan is a Python dict (glance box, steps, support/challenge, fallback) per
  language; the script writes the HTML page (on the teacher-page skeleton, site
  nav/footer, JSON-LD `LearningResource` with `educationalLevel`,
  `timeRequired`, `teaches`) and the PDF (headless Chrome, as now). Page and PDF
  can then never disagree.
- Hub page: cards with the glance data, filter chips by Klasse and Dauer
  (plain JS, no framework).
- Sitemap URLs, IndexNow after deploy, links from teacher page + worksheet
  pages.
- Phase 2: put the same Klasse/Niveau chip on worksheet pages and topic pages.

## Order of work

1. Generator + hub + plans 1–3 (DE). Localhost preview for the owner.
2. Plans 4–5 (DE), then ES 1–5.
3. Upload PDFs 1–2 to 4teachers (per `docs/outreach-4teachers-2026-11-25.md`).
4. Phase 2 level chips; plan 6 if the date still works.

## Open questions for the owner

- Plan 6 (winter/Christmas): build now under time pressure or skip this year?
- Should plans name school types (Gymnasium / Realschule / Gesamtschule) or
  only Klasse ranges? (Recommendation: ranges only; fewer pages to keep right.)

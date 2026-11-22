# Brief: Verb-Diplom / Diploma de verbos

Written by the SEO chat, 2026-11-22. For the session that builds it (homepage or
master session; it is a drill-type page, not a 3D game).

## Why

The einmaleins.de case study (`docs/seo-case-study-einmaleins-2026-11-22.md`) showed
that their links come from school websites, and that teachers link **one named
feature**, not "a learning website" (e.g. a primary school linking "the 100-second
test"). einmaleins.de also has a "Diplom". Krabsy has no feature like that yet.

A Verb-Diplom gives teachers a reason to share one specific link ("Bis Freitag
macht ihr alle das Verb-Diplom Bronze"), gives pupils something to print or show,
and gives us a page with its own search intent:

- DE: "unregelmäßige Verben Test", "unregelmäßige Verben Test online", "Verb Test Englisch"
- ES: "test verbos irregulares inglés", "examen verbos irregulares"

## What

A test page per language with three levels. Passing a level shows a certificate
the pupil can print or save as PDF.

Each verb is asked as **two typed answers** (2nd form, then 3rd form with the 2nd
filled in — the CLAUDE.md chain order). Counts below are in verbs; the test length
in answers is twice that. A **mistake is one wrong answer** (not one wrong verb).
Pass mark is **90 % of the answers** for every level.

| Level | Verbs (answers) | Which verbs | Pass |
|---|---|---|---|
| Bronze | 15 (30) | fixed list, see below | at most 3 mistakes |
| Silber / Plata | 30 (60) | 30 drawn at random from the 43 tier-1 verbs | at most 6 mistakes |
| Gold / Oro | 45 (90) | 15 random tier-1 + 30 random tier-2 verbs | at most 9 mistakes |

Bronze list (the data has no frequency field, so this is hand-picked from tier 1):
be, have, do, go, get, make, say, see, come, take, give, know, think, write, eat.
Silber and Gold draw a new set on every attempt, so a retry is not the same test.
Pass the verb list to `getQuizSet` with `ids` and `count = 2 × verbs`
(`count` counts answers, not verbs).

- **Stops early:** once the mistakes exceed the pass mark the test ends (it can no
  longer be passed), so pupils on a phone don't type 60 more answers for nothing.
  The result screen lists the verbs to practise and offers "try again".
- **Levels are not locked:** a teacher may assign Silber directly.
- Numbers are a starting proposal; tune after a play-test (analytics below).

- **Questions:** typed answers (the "typewriter" mode), validated with
  `checkTyped` from `homepage/lib/krabsy-questions.js` (accepts burnt/burned etc.).
  Load with `getQuizSet({topic: 'irregular_verbs', ...})`; keep the default chain
  order (2nd form, then 3rd form with the 2nd filled in, per CLAUDE.md).
- **Presentation mandate:** positional notation `go → ___ → ___`, no grammar terms
  in the question.
- **No timer pressure for Bronze**; optional time shown on the certificate.
- **After a mistake:** show the correct chain (teach beat), as in the drills.
- **Certificate:** pupil types a first name (or nickname) into a field before
  printing. Shows level, date, number of verbs, Krabsy logo, the page URL.
  Print stylesheet so only the certificate prints (same pattern as the hub
  verb table's "Liste drucken"). The name **stays in the browser**: not sent to
  analytics, not stored on a server (privacy promise on the teacher pages).
- **Progress:** passed levels stored in localStorage like other drill stats.
- **No login, no class accounts** (that is a separate, later product decision).
- **Self-reported:** the certificate is made in the pupil's browser, so anyone can
  print one. Say so plainly in the teacher block ("a motivation tool, not proof";
  for a real check, let pupils do the test in class).

## URLs and SEO

- `/de/unregelmaessige-verben/verb-diplom/` and `/es/verbos-irregulares/diploma/`
  (register the page in `homepage/data/topics.json` → `pages`, so the DE/ES toggle works).
- Title DE: "Unregelmäßige Verben Test online: das Verb-Diplom mit Urkunde — Krabsy"
- Title ES: "Test de verbos irregulares en inglés con diploma — Krabsy"
- Below the test: a short SEO article (how it works, levels, for teachers), a
  visible FAQ with FAQPage JSON-LD, a teacher block ("Im Unterricht einsetzen":
  e.g. "Hausaufgabe: Bronze bis Freitag"; the diploma as a reward).
- Link it from: both verb hubs (card in the drills grid), the teacher pages
  (`/de/lehrkraefte/`, `/es/docentes/`) as a start-point card, the worksheet
  pages ("Danach: das Verb-Diplom"), and the sitemap. IndexNow after deploy.

## Analytics

Use the existing anonymous game events (`gameEvent` from
`homepage/lib/krabsy-game-events.js`, game slug `verb-diplom`): `level_start {level}`,
`level_end {level, result: 'won'|'lost', answers, correct, mistakes, seconds}`,
`certificate_print {level}`. Levels are numbered 1–3 (Bronze–Gold). Also
`recordAttempt(verb, form, correct, 'verb_diplom')` so answers feed the stats page.
No name, no free text.

## Acceptance

- Works on phone, tablet and PC (typing on a phone keyboard is the main case).
- All three levels pass/fail correctly; alternates accepted.
- Certificate prints on one A4 page in Chrome, Firefox, Safari; the name never
  leaves the browser.
- DE and ES complete, language toggle works.
- Page validates (title, description, canonical, hreflang, JSON-LD).

## Decisions

1. Level sizes and pass marks: taken as in the table above (review 2026-11-22:
   the first proposal, 2/3/4 mistakes out of 40/86/120 answers, was ~96 % and too
   long on a phone). Owner may still change them.
2. Name on the certificate: optional free text field (stays in the browser).
3. Later, separate: a teacher view that shows which pupils passed would need
   accounts or class codes and a backend. Not part of this brief.

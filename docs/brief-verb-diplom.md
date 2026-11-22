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

| Level | Verbs | Pass |
|---|---|---|
| Bronze | the 20 most frequent (tier 1 subset) | at most 2 mistakes |
| Silber / Plata | all 43 tier-1 verbs | at most 3 mistakes |
| Gold / Oro | 60 verbs from tiers 1–2 | at most 4 mistakes |

Numbers are a starting proposal; tune after a play-test.

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

Use the existing anonymous events (`krabsy-analytics.js`): level started, level
passed/failed, certificate printed (button click). No name, no free text.

## Acceptance

- Works on phone, tablet and PC (typing on a phone keyboard is the main case).
- All three levels pass/fail correctly; alternates accepted.
- Certificate prints on one A4 page in Chrome, Firefox, Safari; the name never
  leaves the browser.
- DE and ES complete, language toggle works.
- Page validates (title, description, canonical, hreflang, JSON-LD).

## Open owner decisions

1. Level sizes and pass marks (table above is a proposal).
2. Name on the certificate: free text field (proposed) or no name.
3. Later, separate: a teacher view that shows which pupils passed would need
   accounts or class codes and a backend. Not part of this brief.

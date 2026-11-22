# Overview pages vs. top search results (2026-11-22)

Pages: `/de/unregelmaessige-verben/` and `/es/verbos-irregulares/`. Both are indexed in
Google (URL inspection 2026-11-22). The problem is ranking, not indexing. Both hub pages
are hand-written HTML (no generator in `tools/`).

Method: web search from a US location, so the rankings are approximate, not google.de/.es.
QuillBot and Migaku could not be opened (snippets only).

## Who ranks

- **DE "unregelmäßige Verben Englisch (Liste)":** Wikibooks (2 pages), Lingoda, Studyflix,
  Berlitz DE, lernhelfer (Duden), Duolingo blog, schule-bw, Superprof; PDFs rank too.
- **ES "(lista de) verbos irregulares en inglés":** QuillBot (2 pages incl. "PDF para
  imprimir"), Berlitz (es-us/pr/uy/ec), Lingoda ES, Duolingo, MosaLingua, Migaku;
  university PDFs rank too.

## What the top results have and our hubs lack

1. **The verb table itself on the ranking URL**, usually right under the H1, with translation
   (Wikibooks ~190, Studyflix ~104, Berlitz 117). Our hubs: 0 table rows. The
   Übersicht/Resumen table is JavaScript-rendered (5 rows in the HTML); the A–Z list
   (172, static) is a separate URL.
2. **Query words in title and H1**, often with a number ("117 unregelmäßige Verben in Englisch",
   "Tabelle und PDF", "Lista…"). Ours: DE has neither "Englisch" nor "Liste"; ES H1 lacks
   "en inglés", neither has "lista".
3. **Grouping by pattern**: cut-cut-cut / come-came-come / keep-kept-kept / sing-sang-sung.
4. **Printable PDF**, named in the title (Studyflix, QuillBot).
5. **FAQ and 600–1,200 words of real text.** Ours: ~480–540 words, mostly card labels.
6. Example sentence per verb in the table (Berlitz ES).

## What we have and they don't

Real exercises on the site (drills, flashcards, typed practice, games, stats without an
account), a page per verb with examples, typical mistakes and a quiz, no ads, no pop-ups,
no sign-up. ES: "El error más típico" section.

## Improvements, ordered by likely impact (same for DE and ES)

1. **Full static table of all 172 verbs on the hub, directly under the H1**
   (base / past / participle / translation), linking each verb to its page; search/sort as
   progressive enhancement. Cards move below the table.
2. **Title, H1, meta description for the query**, e.g.
   DE "Unregelmäßige Verben Englisch – Liste & Tabelle (172 Verben) | Krabsy",
   ES "Lista de verbos irregulares en inglés (172 verbos) | Krabsy",
   H1 "Unregelmäßige Verben Englisch: Liste mit Übungen" / "Verbos irregulares en inglés: lista y ejercicios".
3. **Printable list** (print stylesheet first; a PDF later), mention it in the title once it exists.
4. **Section "Verben nach Mustern" / "Tipos de verbos irregulares"** with the 4 groups, 5–10
   verbs each, linked to the verb pages.
5. **FAQ with FAQPage JSON-LD**, prose to ~800–1,000 words; DE/ES "Top 20" mini table optional.

Small fix: the ES hub says "unos 150 verbos" (line ~507) while the site has 172.

Presentation mandate still applies: column headers may say Simple Past / Past Participle
(it's a reference table, not a question).

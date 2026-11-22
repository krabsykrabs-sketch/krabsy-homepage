# SEO snapshot: 2026-11-22 (Search Console coverage only)

Interim check, 10 days after the 2026-11-12 deploy. Google's data ends on
**2026-11-16**, so it covers only 4 days after the deploy: too early to judge the
tier-3 noindex experiment. Full evaluation stays mid/late December against
`../seo-baseline-2026-11-12/`.

- Indexed: 351 (late Aug) → 221 (Sep 22) → 119 (Oct 24) → 83 (Nov 7) →
  **54 (Nov 10, before the deploy)** → 55 (Nov 14–16).
  The drop from 83 to 54 happened before the deploy, so it was not caused by it.
- Not indexed: 387. Known URLs grew 397 → 442; the +45 match "Gefunden – zurzeit
  nicht indexiert" (45), i.e. the new sitemap URLs are discovered but not yet crawled.
- Reasons: Gecrawlt – zurzeit nicht indexiert 322 (validation running since 11-12),
  Gefunden – nicht indexiert 45, Weiterleitung 12 (http/www, expected),
  noindex 4 (the 132 tier-3 pages are not yet recrawled), robots.txt 2, 404 2
  (old /1/ shop URLs, validation passed).
- Impressions: 0–3 per day on Google (one spike of 10 on Oct 27).
- Not exported this time: GSC performance, Bing.

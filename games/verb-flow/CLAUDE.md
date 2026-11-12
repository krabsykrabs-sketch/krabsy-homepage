# Verb Flow — game brief

Single-file canvas game. Source: `krabsy-verb-flow.html` here; served copy:
`homepage/krabsy-verb-flow.html`, iframed by `homepage/de/spiele/verb-flow/`
and `homepage/es/juegos/verb-flow/`.

## Notes from the master session (2026-11-12)

- The served copy now carries `<meta name="robots" content="noindex, indexifembedded">`
  (Google should index the wrapper page, not the raw file). **Add the same tag
  to this source file**, or the next copy into `homepage/` drops it.
- The wrapper pages have an SEO info section (text in
  `tools/game_info_content.py`, rendered by `tools/render_game_info.py`). If
  features change (levels, timer, saving), update that text and re-run.

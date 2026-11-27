# Krabsy icons

`krabsy-icons.svg` is a sprite of `<symbol id="ki-…">`. Use it from any page:

```html
<svg class="ki" aria-hidden="true" focusable="false"><use href="/lib/icons/krabsy-icons.svg?v=2026-11-27#ki-play"/></svg>
```

Icons always sit next to visible text, so they are decorative (`aria-hidden`,
no alt text). Bump `?v=` where they are used when you change the sprite.

| id | shows | used for |
|---|---|---|
| `ki-play` | game pad | games / play |
| `ki-practise` | pencil | practise, drills |
| `ki-diploma` | medal on ribbons | verb diploma, certificates |
| `ki-teacher` | graduation cap | teacher links |
| `ki-class` | two pupils | class code, class badge |
| `ki-quiz` | speech bubble with ? | Quiz Room |

## Style rules (keep every new icon to them)

- `viewBox="0 0 24 24"`, about 2 px clear at the edges.
- One outline: stroke `#2c2a3a` (ink), `stroke-width="2"`, round caps and
  joins. Corners rounded (radius 2–3 on boxes); no sharp spikes.
- Fills only from the palette: teal `#2ee6c0`, coral `#ff8585`, amber
  `#ffcf5e`, ink `#2c2a3a` for small solid details (dots, star). At most two
  fill colours per icon.
- Presentation attributes on `<symbol>` / shapes, no `<style>` and no
  classes (CSS inside an external sprite is not applied reliably through
  `<use>`). No text, no gradients, no filters.
- Must read at 20 px: few shapes, no detail thinner than the stroke.
- Drawn by hand for Krabsy; no icon fonts, no third-party sets.
- On a teal surface don't use a teal-filled icon; put it on a white chip
  (see `.gl-act-ico` in `lib/krabsy-landing.css`).

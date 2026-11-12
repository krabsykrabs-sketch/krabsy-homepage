# Server-side redirects for krabsy.com (Coolify)

**Why this matters:** Google dropped from 352 to 83 indexed pages. Some of
the reasons sit on the server, not in the HTML. The site answers with
*temporary* redirects and with duplicate URLs, so Google keeps finding
several addresses for the same page and doesn't know which one counts.
This doc lists the fixes. You make them in the Coolify dashboard, and each
takes about 10 minutes. Nothing here changes how the site is built or
deployed.

Two ready-made files live next to this doc:

| File | Goes into | Fixes |
|---|---|---|
| `docs/traefik-krabsy-redirects.yaml` | Coolify → Server → Proxy → Dynamic Configurations | http→https and www→apex become **301** (single hop) |
| `docs/nginx-krabsy.conf` | Coolify → static app → Custom Nginx Configuration | root `/`→`/de/`, missing trailing slash, `…/index.html`, the 30 legacy URLs (all **301**), language-specific 404 pages |

Coolify does **not** read either file from the repo. You paste them in by
hand, and they are kept in the repo as the source of truth.

---

## 1. What the server does today (measured 2026-11-12 with curl)

| Request | Today | Should be |
|---|---|---|
| `http://krabsy.com/` | **302** → `https://krabsy.com/` (307 for HEAD) | 301 → `https://krabsy.com/de/`, one hop is fine |
| `http://www.krabsy.com/` | **302** → `https://www.krabsy.com/` → **302** → `https://krabsy.com/` | 301 → `https://krabsy.com/…` in one hop |
| `https://www.krabsy.com/de/` | **302** → `https://krabsy.com/de/` | 301 |
| `https://krabsy.com/` | 200 (meta-refresh page) | 301 → `/de/` |
| `https://krabsy.com/de` | **200** (duplicate of `/de/`) | 301 → `/de/` |
| `https://krabsy.com/de/unregelmaessige-verben/arise` | **200** (duplicate) | 301 → `…/arise/` |
| `https://krabsy.com/de/index.html` | **200** (duplicate) | 301 → `/de/` |
| `https://krabsy.com/de/drills/sprint/` (+ 29 more) | 200 meta-refresh "moved" stub | 301 → new URL |
| `https://krabsy.com/nope/` | 404 with `de/404.html` | unchanged |

How this is served:

- **Proxy = Traefik v3.** The http→https and www redirects answer
  `302 Found` with a 5-byte body `Found`, and `307` for HEAD. That
  pattern comes from Traefik's `redirectScheme`/`redirectRegex` middleware
  with `permanent=false`, which is what Coolify generates by default.
- **App = Coolify "Static" build pack.** That is the `nginx` image
  (`server: nginx/1.31.1`) serving `/homepage` from
  `/usr/share/nginx/html`.
- **There is already a custom nginx config.** `/es/…` 404s get
  `es/404.html` and everything else gets `de/404.html`. Coolify's default
  config doesn't do that, so someone added an `error_page` setup earlier.
  Before you paste the new config, save the old one (step 3.1).

---

## 2. Step 1: permanent http→https and www→apex (Traefik)

1. Coolify → **Servers** → your server (probably `localhost`) → **Proxy**.
   Check that it says *Traefik*. If it says Caddy, see the note at the end
   of this section.
2. Open **Dynamic Configurations** (a tab or link on the Proxy page) →
   **+ Add**.
3. File name: `krabsy-redirects.yaml`. Content: paste all of
   `docs/traefik-krabsy-redirects.yaml`. **Save.**
4. Traefik watches that folder and reloads by itself. You don't need to
   restart the proxy or redeploy the app.
5. Verify right away (section 5, checks A1–A4).

How it works: the file adds two routers with priority 10000 for
`krabsy.com`/`www.krabsy.com`. They win over the routers Coolify generates
from the app's labels. Every http request and every `https://www.` request
gets a **301** straight to `https://krabsy.com/<same path>`. The app's
Coolify settings stay as they are. You don't need to touch the
"Direction" (www / non-www) dropdown or the container labels, and the fix
survives redeploys and domain edits.

*Alternative (only if you'd rather not use a dynamic file):* app →
Configuration → General → **Container Labels**. Turn off "Readonly
labels". Then in every `…redirectregex.permanent=false` /
`…redirectscheme.permanent=false` label, change `false` to `true`, and add
the missing `…redirectscheme.permanent=true` label. **Also rename the
middleware** (for example `redirect-to-https` → `krabsy-redirect-to-https`,
both where it's defined and in every `…routers.*.middlewares=` reference).
Other apps on the same server define a middleware with the same name, and
if the definitions differ Traefik rejects them. This route is more fragile
because Coolify regenerates the labels whenever the domains change.

*If the proxy is Caddy:* Coolify's Caddy redirects use `redir … 302`.
Add a Caddy dynamic config with
`www.krabsy.com { redir https://krabsy.com{uri} permanent }` instead, and
let the http→https upgrade stay Caddy's automatic one (Caddy uses 308).

---

## 3. Step 2: nginx 301s (root, trailing slash, index.html, legacy URLs)

1. Coolify → **Projects** → the krabsy static app (base directory
   `/homepage`) → **Configuration → General** → scroll to **Custom Nginx
   Configuration**. It's only shown for static apps. If the box is empty,
   click "Generate default".
   - **Copy what is there now into a local file first** as a backup and to
     roll back. If it has anything beyond `error_page` lines, such as
     `gzip`, cache headers or `add_header`, copy those directives into the
     new `server { … }` block.
2. Replace the content with all of `docs/nginx-krabsy.conf`. **Save.**
3. Click **Redeploy**. The config is baked into the image at build time,
   so saving alone does nothing.
4. Verify right away (section 5, checks B1–B9). If the site doesn't come
   up, paste the backup back in and redeploy (section 6).

What the config does:

- **Legacy URLs:** a `map` matches all 30 old paths, with or without the
  trailing slash and with `index.html`, and sends each one in one 301 to
  its new URL:
  - `/de|es/drills/{drag-match,falling-forms,fill-the-gap,sprint,type-race}/`
    → the drill under `/de/unregelmaessige-verben/…` or
    `/es/verbos-irregulares/…`
  - `/de|es/games/{air-control,crab-slash,verb-platformer,verb-slash,verb-snake}/`
    → `/de/spiele/…` or `/es/juegos/…`
  - `/de/reference/` → `/de/unregelmaessige-verben/uebersicht/`, and
    `/es/reference/` → `/es/verbos-irregulares/resumen/`
  - `/de/stats/` → `…/statistik/`, and `/es/stats/` → `…/estadisticas/`
  - `/de|es/tools/{flashcards,free-practice,verb-table}/` →
    karteikarten/freies-ueben/verb-tabelle and
    tarjetas/practica-libre/tabla-de-verbos
- **`/` → `/de/`**, and the query string is kept.
- **`…/index.html` → `…/`**
- **Missing trailing slash:** `/de` → `/de/` and `/de/x/y` → `/de/x/y/`
  when that folder exists. Real files like `/lib/x.css` and
  `/krabsy-air-control.html` are served as before.
- **404s:** `/es/…` → `es/404.html`, everything else → `de/404.html`, as
  today.
- `absolute_redirect off` keeps `Location:` relative. Without it nginx,
  which only sees plain http behind Traefik, would redirect to `http://…`
  and cause an extra hop.

Tested locally with nginx 1.28 on the real `homepage/` folder:
`nginx -t` passes, and every row in section 5 behaves as described. One
thing wasn't tested: the exact Coolify UI and the Traefik file. Those are
checked by the live verification below.

After this is live, the meta-refresh stub folders
(`homepage/{de,es}/{drills,games,tools,reference,stats}/`) and the
meta-refresh in `homepage/index.html` are never served again. Keep them as
a fallback. You can delete the stubs later, but there's no hurry.

When you add or remove stubs, regenerate the list with
`python3 tools/generate_sitemap.py --print-legacy-nginx`.

---

## 4. Order and timing

1. Do step 1 (Traefik) and check A1–A4.
2. Do step 2 (nginx + Redeploy) and check B1–B9.
3. Deploy the `seo-pages` content changes as usual. The regenerated
   `sitemap.xml` comes from `tools/generate_sitemap.py`.
4. In Google Search Console, resubmit `https://krabsy.com/sitemap.xml`.
   Then use "Validate fix" on *Page with redirect* and *Duplicate without
   user-selected canonical*, and request indexing for `/de/` and `/es/`.
5. Send the changed URLs to IndexNow (see `CLAUDE.md`).

---

## 5. Verification checklist (copy-paste)

`curl -sI` sends a HEAD request, and Traefik answers HEAD with 308 instead
of 301. Both are permanent. The checks below use GET (`-o /dev/null -w`)
so you see what browsers and Googlebot get.

```bash
chk() { printf '%-55s ' "$1"; curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$1"; }

# A — Traefik (step 1)
chk http://krabsy.com/                    # A1 expect: 301 https://krabsy.com/
chk http://www.krabsy.com/de/             # A2 expect: 301 https://krabsy.com/de/   (one hop!)
chk https://www.krabsy.com/de/?x=1        # A3 expect: 301 https://krabsy.com/de/?x=1
chk https://krabsy.com/de/                # A4 expect: 200

# B — nginx (step 2)
chk https://krabsy.com/                                         # B1 expect: 301 https://krabsy.com/de/
chk https://krabsy.com/de                                       # B2 expect: 301 https://krabsy.com/de/
chk https://krabsy.com/de/unregelmaessige-verben/arise          # B3 expect: 301 …/arise/
chk https://krabsy.com/de/index.html                            # B4 expect: 301 https://krabsy.com/de/
chk https://krabsy.com/de/drills/sprint/                        # B5 expect: 301 …/de/unregelmaessige-verben/sprint/
chk https://krabsy.com/es/tools/verb-table/                     # B6 expect: 301 …/es/verbos-irregulares/tabla-de-verbos/
chk https://krabsy.com/lib/krabsy-ui.css                        # B7 expect: 200
chk https://krabsy.com/es/nope/                                 # B8 expect: 404 (Spanish 404 page)
chk https://krabsy.com/eae8988c209c98a109229e9b03a9c0c4.txt    # B9 expect: 200 (IndexNow key)

# Full chain of the worst case — must be exactly 2 lines: 301 then 200
curl -sL -o /dev/null -w '%{num_redirects} redirects → %{url_effective} %{http_code}\n' http://www.krabsy.com/de/drills/sprint
#   expect: 2 redirects → https://krabsy.com/de/unregelmaessige-verben/sprint/ 200

# All 30 legacy URLs must be 301 (prints only failures)
for p in de es; do for s in drills/drag-match drills/falling-forms drills/fill-the-gap drills/sprint drills/type-race \
  games/air-control games/crab-slash games/verb-platformer games/verb-slash games/verb-snake reference stats \
  tools/flashcards tools/free-practice tools/verb-table; do
  c=$(curl -s -o /dev/null -w '%{http_code}' "https://krabsy.com/$p/$s/"); [ "$c" = 301 ] || echo "FAIL $c /$p/$s/"; done; done

# Spot-check that pages still render (play one drill in the browser, too)
chk https://krabsy.com/de/unregelmaessige-verben/sprint/        # expect: 200
chk https://krabsy.com/games/verb-platformer/                   # expect: 200
```

---

## 6. Rollback

- **Traefik:** delete `krabsy-redirects.yaml` under Proxy → Dynamic
  Configurations. Traefik falls back to Coolify's 302s within seconds.
- **nginx:** paste the backup from step 3.1 back into Custom Nginx
  Configuration and **Redeploy**. If the box was empty before, empty it
  again. The repo's meta-refresh stubs and root page keep working without
  any server rule.

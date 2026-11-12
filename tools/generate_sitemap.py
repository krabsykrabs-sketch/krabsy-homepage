#!/usr/bin/env python3
"""Build homepage/sitemap.xml from the pages actually present under homepage/.

Run from the repo root:

  python3 tools/generate_sitemap.py                 # rewrite homepage/sitemap.xml
  python3 tools/generate_sitemap.py --out /tmp/s.xml  # write somewhere else
  python3 tools/generate_sitemap.py --check         # write nothing; diff vs current sitemap
  python3 tools/generate_sitemap.py --print-legacy-nginx   # nginx `map` lines for the stubs

A page is listed when it is an index.html under homepage/ and
  - has no <meta name="robots" content="…noindex…">,
  - is not a meta-refresh stub (legacy "page moved" pages, the root redirect),
  - is not under a path disallowed for User-agent * in homepage/robots.txt,
  - has a <link rel="canonical"> that points to its own trailing-slash URL
    (pages without a canonical, e.g. iframed game builds under /games/,
    or pages canonicalising elsewhere are left out).
404 pages and standalone *.html files are never listed (not index.html).

<loc> is the trailing-slash URL; xhtml:link hreflang alternates are copied
from the page's own <link rel="alternate" hreflang> tags; <lastmod> is the
date of the last commit touching the file (git log -1 --format=%cs), or
today if the file has uncommitted changes / is untracked. Output order is
sorted by URL (language homepages first) so reruns are byte-identical.

Note: tools/generate_verb_pages.py also appends verb URLs to sitemap.xml.
Run this script AFTER it — this one rebuilds the whole file from disk.
"""
import argparse, datetime, html, pathlib, re, subprocess, sys
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent
HP = ROOT / "homepage"
ORIGIN = "https://krabsy.com"
HREFLANG_ORDER = {"de": 0, "es": 1, "x-default": 9}


class Head(HTMLParser):
    """Collect the <head> signals we need (stops caring after <body>)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.robots, self.canonical, self.refresh = "", None, None
        self.alternates = []
        self.in_body = False

    def handle_starttag(self, tag, attrs):
        if tag == "body":
            self.in_body = True
        if self.in_body:
            return
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "meta":
            if a.get("name", "").lower() == "robots":
                self.robots += " " + a.get("content", "").lower()
            if a.get("http-equiv", "").lower() == "refresh":
                self.refresh = a.get("content", "")
        elif tag == "link":
            rel = a.get("rel", "").lower().split()
            if "canonical" in rel:
                self.canonical = a.get("href")
            elif "alternate" in rel and a.get("hreflang"):
                self.alternates.append((a["hreflang"].lower(), a.get("href", "")))


def robots_disallows():
    rules, applies = [], False
    path = HP / "robots.txt"
    if not path.exists():
        return rules
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        key, val = (x.strip() for x in line.split(":", 1))
        key = key.lower()
        if key == "user-agent":
            applies = val == "*"
        elif key == "disallow" and applies and val:
            rules.append(val)
    return rules


def url_path(index_file):
    rel = index_file.parent.relative_to(HP).as_posix()
    return "/" if rel == "." else f"/{rel}/"


def git_lastmod(rel, today):
    dirty = subprocess.run(["git", "status", "--porcelain", "--", rel], cwd=ROOT,
                           capture_output=True, text=True).stdout.strip()
    if dirty:
        return today
    out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", rel], cwd=ROOT,
                         capture_output=True, text=True).stdout.strip()
    return out or today


def scan():
    """Return (included: {path: page}, excluded: {path: reason}, stubs: {path: target})."""
    disallow = robots_disallows()
    today = datetime.date.today().isoformat()
    included, excluded, stubs = {}, {}, {}
    for f in sorted(HP.rglob("index.html")):
        path = url_path(f)
        rel = f.relative_to(ROOT).as_posix()
        p = Head()
        p.feed(f.read_text(encoding="utf-8", errors="replace"))
        if p.refresh is not None:
            m = re.search(r"url\s*=\s*['\"]?([^'\";]+)", p.refresh, re.I)
            stubs[path] = m.group(1).strip() if m else ""
            excluded[path] = "meta-refresh redirect"
        elif "noindex" in p.robots:
            excluded[path] = "robots noindex"
        elif any(path.startswith(d) for d in disallow):
            excluded[path] = "robots.txt disallow"
        elif not p.canonical:
            excluded[path] = "no canonical (not a standalone page)"
        elif html.unescape(p.canonical) != ORIGIN + path:
            excluded[path] = f"canonical points elsewhere ({p.canonical})"
        else:
            alts = sorted({(h, html.unescape(u)) for h, u in p.alternates},
                          key=lambda x: (HREFLANG_ORDER.get(x[0], 5), x[0], x[1]))
            included[path] = {"lastmod": git_lastmod(rel, today), "alternates": alts}
    return included, excluded, stubs


def render(included):
    def order(path):
        return (0 if path.count("/") == 2 else 1, path)  # /de/, /es/ first
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<!-- Generated by tools/generate_sitemap.py — do not edit by hand. -->',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
           '        xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for path in sorted(included, key=order):
        page = included[path]
        out += ["  <url>",
                f"    <loc>{html.escape(ORIGIN + path)}</loc>",
                f"    <lastmod>{page['lastmod']}</lastmod>",
                "    <changefreq>monthly</changefreq>"]
        for lang, href in page["alternates"]:
            pad = " " * max(1, 10 - len(lang))
            out.append(f'    <xhtml:link rel="alternate" hreflang="{lang}"{pad}href="{html.escape(href)}"/>')
        out.append("  </url>")
    out.append("</urlset>")
    return "\n".join(out) + "\n"


def warnings(included):
    """hreflang targets must be listed too, and should point back."""
    msgs = []
    urls = {ORIGIN + p for p in included}
    for path, page in sorted(included.items()):
        for lang, href in page["alternates"]:
            if href not in urls:
                msgs.append(f"{path}: hreflang {lang} → {href} is not an indexable page")
            elif lang != "x-default":
                back = included[href[len(ORIGIN):]]["alternates"]
                if (ORIGIN + path) not in {h for _, h in back}:
                    msgs.append(f"{path}: hreflang {lang} → {href} has no return link")
    return msgs


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", default=str(HP / "sitemap.xml"), help="output path (default: homepage/sitemap.xml)")
    ap.add_argument("--check", action="store_true", help="write nothing; report the diff vs homepage/sitemap.xml")
    ap.add_argument("--print-legacy-nginx", action="store_true", help="print nginx map lines for meta-refresh stubs")
    args = ap.parse_args()

    included, excluded, stubs = scan()

    if args.print_legacy_nginx:
        for path, target in sorted(stubs.items()):
            if path != "/":
                print(f"    ~^{path.rstrip('/')}/?(index\\.html)?$  {target};")
        return

    xml = render(included)
    for w in warnings(included):
        print("WARN", w, file=sys.stderr)

    current = HP / "sitemap.xml"
    old = set(re.findall(r"<loc>([^<]+)</loc>", current.read_text(encoding="utf-8"))) if current.exists() else set()
    new = {ORIGIN + p for p in included}
    added, removed = sorted(new - old), sorted(old - new)
    print(f"{len(new)} URLs ({len(excluded)} index.html excluded); vs current sitemap: +{len(added)} −{len(removed)}")
    for u in added:
        print("  + " + u)
    for u in removed:
        why = excluded.get(u[len(ORIGIN):]) if u.startswith(ORIGIN) else None
        print("  - " + u + (f"   ({why})" if why else "   (no such page on disk)"))
    if args.check:
        reasons = {}
        for r in excluded.values():
            reasons[r.split(" (")[0]] = reasons.get(r.split(" (")[0], 0) + 1
        print("excluded:", ", ".join(f"{n}× {r}" for r, n in sorted(reasons.items())))
        return
    pathlib.Path(args.out).write_text(xml, encoding="utf-8")
    print("wrote", args.out)


if __name__ == "__main__":
    main()

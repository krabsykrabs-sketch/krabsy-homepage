"""polypizza_get.py <bundle-url> <dest-dir>: download every GLB of a Poly Pizza bundle (only models whose page says
"By Quaternius" and "Public Domain (CC0)"). Writes _source.json (title, page, glb url, licence line)."""
import sys, re, os, json, time, html, urllib.request
def get(u, binary=False):
    r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=120)
    d = r.read(); return d if binary else d.decode("utf8", "replace")
url, dest = sys.argv[1], sys.argv[2]
os.makedirs(dest, exist_ok=True)
t = get(url)
cards = re.findall(r'static\.poly\.pizza/([0-9a-f-]{36})\.webp"[^>]*alt="([^"]*)".*?to="(/m/[A-Za-z0-9_-]+)"', t, re.S)
print(len(cards), "models listed")
src, used = [], set()
for uuid, alt, m in cards:
    name = re.sub(r'[^A-Za-z0-9]+', '_', html.unescape(alt)).strip('_') or m[3:]
    while name in used: name += "_2"
    used.add(name)
    page = get("https://poly.pizza" + m)
    txt = re.sub(r'<[^>]+>', '|', re.sub(r'<script.*?</script>|<style.*?</style>', '', page, flags=re.S))
    if "By Quaternius" not in txt or "Public Domain (CC0)" not in txt:
        print("SKIP (author/licence not confirmed)", alt, m); continue
    g = re.search(r'static\.poly\.pizza/([0-9a-f-]{36})\.glb', page)
    gu = "https://static.poly.pizza/" + (g.group(1) if g else uuid) + ".glb"
    out = os.path.join(dest, name + ".glb")
    try:
        if not os.path.exists(out):
            d = get(gu, True)
            if d[:4] != b"glTF": print("SKIP (not a GLB)", alt); continue
            open(out, "wb").write(d)
        src.append({"title": html.unescape(alt), "file": name + ".glb", "page": "https://poly.pizza" + m, "glb": gu, "author": "Quaternius", "licence": "Public Domain (CC0)"})
    except Exception as e: print("FAIL", alt, e)
    time.sleep(0.25)
json.dump({"bundle": url, "models": src}, open(os.path.join(dest, "_source.json"), "w"), indent=1)
print("saved", len(src), "to", dest)

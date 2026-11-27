#!/usr/bin/env python3
"""Give a 3D game's own ES modules versioned URLs, so a deploy reaches returning players.

The server lets browsers keep .js files for an hour (docs/nginx-krabsy.conf). A game
whose index.html is new but whose src/*.js still come from the cache runs half old,
half new code (2026-11-25: Verb Dungeon showed neither the old "turn your device"
screen nor the new sideways mode on the owner's phone).

This script writes one entry per src/*.js into the game's import map,
  "./src/touch.js": "./src/touch.js?v=<hash>"
and the same ?v=<hash> on the <script type="module" src="src/main.js">. Relative
imports inside the modules (`import … from './touch.js'`, `import('./verbs.js')`)
resolve to those URLs and are remapped by the import map, so every module changes
URL whenever any of them changes. <hash> = the first 10 hex digits of a SHA-1 over
all src/*.js. Run it after changing a game's src/ (on the source AND the served copy,
or copy index.html over), e.g.:

  python3 tools/stamp_game_modules.py homepage/games/verb-dungeon games/verb-dungeon
(modules in src/, or js/ for Verb Towers; a root ./main.js entry for the Platformer)
"""
import hashlib
import json
import re
import sys
from pathlib import Path


def stamp(game: Path) -> str:
    mdir = 'src' if (game / 'src').is_dir() else 'js'   # Verb Towers keeps its modules in js/
    src = sorted((game / mdir).glob('*.js'))
    root_main = (game / 'main.js').exists()   # Verb Platformer: entry at ./main.js
    h = hashlib.sha1()
    for f in src + ([game / 'main.js'] if root_main else []):
        h.update(f.name.encode())
        h.update(f.read_bytes())
    v = h.hexdigest()[:10]

    page = game / 'index.html'
    html = page.read_text(encoding='utf-8')
    m = re.search(r'(<script type="importmap">\s*)(\{.*?\})(\s*</script>)', html, re.S)
    if not m:
        sys.exit(f'{page}: no import map')
    imap = json.loads(m.group(2))
    imports = {k: val for k, val in imap.get('imports', {}).items() if not k.startswith(f'./{mdir}/')}
    for f in src:
        imports[f'./{mdir}/{f.name}'] = f'./{mdir}/{f.name}?v={v}'
    imap['imports'] = imports
    body = json.dumps(imap, indent=2, ensure_ascii=False)
    html = html[:m.start(2)] + body + html[m.end(2):]

    entry = r'(?:\./)?main\.js' if root_main else mdir + r'/main\.js'
    html, n = re.subn(r'(<script type="module" src="' + entry + r')(\?v=[0-9a-f]+)?(")',
                      rf'\g<1>?v={v}\3', html)
    if n != 1:
        sys.exit(f'{page}: expected one <script type="module"> for the entry module, found {n}')
    page.write_text(html, encoding='utf-8')
    return v


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for d in sys.argv[1:]:
        print(d, stamp(Path(d)))

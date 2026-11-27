#!/usr/bin/env python3
"""Dev server for the duo game: a site-like folder without copying anything.

  python3 games/duo-coop/tools/serve.py [port]        (default 8930)
  → http://localhost:8930/games/duo-coop/

/games/duo-coop/… is served from this source folder, everything else
(/lib, /data, /assets/figures …) from homepage/, so the game finds the
question engine, the stats and the figures exactly as it would on the site.
No caching, so a reload always runs the current source.
"""
import http.server, os, sys
from functools import partial

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # games/duo-coop
SITE = os.path.abspath(os.path.join(HERE, '..', '..', 'homepage'))
PREFIX = '/games/duo-coop'


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        clean = path.split('?', 1)[0].split('#', 1)[0]
        if clean == PREFIX or clean.startswith(PREFIX + '/'):
            rel = clean[len(PREFIX):].lstrip('/')
            root = HERE
        else:
            rel = clean.lstrip('/')
            root = SITE
        full = os.path.normpath(os.path.join(root, rel))
        return full if full.startswith(root) else root

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8930
    Handler.extensions_map.update({'.js': 'text/javascript', '.wasm': 'application/wasm'})
    srv = http.server.ThreadingHTTPServer(('0.0.0.0', port), Handler)
    print(f'duo-coop: http://localhost:{port}{PREFIX}/')
    srv.serve_forever()

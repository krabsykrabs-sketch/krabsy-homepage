"""Local test server that mimics the released layout.

Serves the game (TowerDefense3D/) at the root, plus the site's shared /lib and /data
folders from homepage/ (read-only), so the real question engine works as it will
after release. Plain `python3 -m http.server` in TowerDefense3D/ uses the game's
fallback verbs instead.

usage: python3 tools/dev-server.py [port]      (default 8125)
then open http://localhost:8125/?lang=de      (add &unlock=all to open every level)
"""
import http.server
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, '..', 'TowerDefense3D'))
SITE = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'homepage'))


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split('?')[0].split('#')[0]
        root = SITE if (p.startswith('/lib/') or p.startswith('/data/')) else GAME
        return os.path.join(root, os.path.normpath(p).lstrip('/'))

    def end_headers(self):
        # Always fetch fresh files while testing.
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8125
print(f'Verb Towers test server: http://localhost:{port}/?lang=de')
http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()

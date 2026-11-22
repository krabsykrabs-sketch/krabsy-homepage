"""Dev server for Krabsy Quiz Show: plain static files, but with caching switched off.

`python3 -m http.server` lets browsers (Firefox especially) reuse old copies of ES
modules. Run from this folder:  python3 tools/serve.py [port]   (default 8142)

/lib/ and /data/ are served from ../../homepage/, so the game uses the real site
question engine in dev, as it will on the site. Add ?offline=1 to test the inline
fallback lists.
"""
import http.server, socketserver, sys, os

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = os.path.abspath(os.path.join(HERE, '..', '..', 'homepage'))

class NoCache(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split('?', 1)[0].split('#', 1)[0]
        if p.startswith('/lib/') or p.startswith('/data/'):
            return os.path.join(SITE, *[s for s in p.split('/') if s and s != '..'])
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

os.chdir(HERE)
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8142
socketserver.TCPServer.allow_reuse_address = True
socketserver.TCPServer.request_queue_size = 64  # the studio loads ~20 files at once
with socketserver.ThreadingTCPServer(('127.0.0.1', port), NoCache) as httpd:
    print(f'Serving Krabsy Quiz Show on http://localhost:{port}/ (no cache)', flush=True)
    httpd.serve_forever()

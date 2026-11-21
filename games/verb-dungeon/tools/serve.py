"""Dev server for Verb Dungeon: plain static files, but with caching switched off.

`python3 -m http.server` lets browsers (Firefox especially) reuse old copies of ES
modules, which once served the PoC's src/verbs.js to the new game and broke level
starts. Run from this folder:  python3 tools/serve.py [port]   (default 8130)
"""
import http.server, socketserver, sys, os

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8130
socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('127.0.0.1', port), NoCache) as httpd:
    print(f'Serving Verb Dungeon on http://localhost:{port}/ (no cache)', flush=True)
    httpd.serve_forever()

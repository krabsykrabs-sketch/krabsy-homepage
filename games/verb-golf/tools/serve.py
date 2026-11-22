"""Dev server for Verb Golf: plain static files, but with caching switched off.

`python3 -m http.server` lets browsers (Firefox especially) reuse old copies of ES
modules. Run from this folder:  python3 tools/serve.py [port]   (default 8140)
"""
import http.server, socketserver, sys, os

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8140
socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('127.0.0.1', port), NoCache) as httpd:
    print(f'Serving Verb Golf on http://localhost:{port}/ (no cache)', flush=True)
    httpd.serve_forever()

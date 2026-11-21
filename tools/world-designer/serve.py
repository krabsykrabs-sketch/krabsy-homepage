#!/usr/bin/env python3
"""Local World Designer server.

Serves the editor (no-cache, so edited ES modules always reload) AND a tiny
"levels API" so rooms open / save straight to the repo's JSON files — no
download/upload. Guard rails: binds 127.0.0.1 only, rejects non-localhost Host
headers (DNS rebinding), and reads/writes only `.json` files inside a
`games/<game>/levels/` directory.

  python3 tools/world-designer/serve.py [port]   # default 8044
  open http://localhost:8044/

API:
  GET  /api/dirs                         -> [{dir, count}]  (games/*/levels)
  GET  /api/levels?dir=<rel>             -> {dir, files:[{name, objects}]}
  GET  /api/level?dir=<rel>&name=<f.json>-> the level JSON
  POST /api/level?dir=<rel>&name=<f.json>-> writes the body (level JSON) to the file
"""
import http.server, socketserver, json, re, sys, urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent     # tools/world-designer
REPO = HERE.parents[1]                      # repo root
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8044
NAME_RE = re.compile(r'^[\w.\- ]+\.json$')


def levels_dir(rel):
    """A repo-relative levels dir. Only games/<game>/levels/ is readable/writable."""
    p = (REPO / (rel or '')).resolve()
    try:
        parts = p.relative_to(REPO).parts
    except ValueError:
        raise ValueError('path outside the repo')
    if len(parts) != 3 or parts[0] != 'games' or parts[2] != 'levels':
        raise ValueError('dir must be games/<game>/levels')
    return p


def level_file(rel, name):
    if not NAME_RE.match(name or ''):
        raise ValueError('bad file name')
    return levels_dir(rel) / name


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(HERE), **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _host_ok(self):
        # only the local browser may talk to us — a foreign Host header means a
        # DNS-rebinding page (or LAN device) is probing the repo-write API
        h = (self.headers.get('Host') or '').split(':')[0].strip().lower()
        return h in ('localhost', '127.0.0.1')

    def do_GET(self):
        if not self._host_ok():
            return self._json({'error': 'forbidden host'}, 403)
        u = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        try:
            if u.path == '/api/dirs':
                return self._json(self._dirs())
            if u.path == '/api/levels':
                return self._json(self._list(q.get('dir', '')))
            if u.path == '/api/level':
                f = level_file(q.get('dir', ''), q.get('name', ''))
                if not f.is_file():
                    return self._json({'error': 'not found'}, 404)
                return self._json(json.loads(f.read_text(encoding='utf-8')))
        except Exception as e:
            return self._json({'error': str(e)}, 400)
        return super().do_GET()

    def do_POST(self):
        if not self._host_ok():
            return self._json({'error': 'forbidden host'}, 403)
        u = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        if u.path != '/api/level':
            return self._json({'error': 'not found'}, 404)
        try:
            f = level_file(q.get('dir', ''), q.get('name', ''))
            n = int(self.headers.get('Content-Length', 0))
            obj = json.loads(self.rfile.read(n).decode('utf-8'))   # validate it IS json
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_text(json.dumps(obj, indent=2) + '\n', encoding='utf-8')
            return self._json({'ok': True, 'name': f.name})
        except Exception as e:
            return self._json({'error': str(e)}, 400)

    def _dirs(self):
        out = []
        for lv in sorted((REPO / 'games').glob('*/levels')):
            if lv.is_dir():
                out.append({'dir': lv.relative_to(REPO).as_posix(),
                            'count': len(list(lv.glob('*.json')))})
        return out

    def _list(self, rel):
        d = levels_dir(rel)
        files = []
        if d.is_dir():
            for p in sorted(d.glob('*.json')):
                try:
                    obj = json.loads(p.read_text(encoding='utf-8'))
                    objs = len(obj.get('objects', [])) if isinstance(obj, dict) else 0
                except Exception:
                    objs = 0
                files.append({'name': p.name, 'objects': objs})
        return {'dir': rel, 'files': files}

    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    with Server(('127.0.0.1', PORT), Handler) as httpd:   # localhost only — this API writes repo files
        print(f'World Designer on http://localhost:{PORT}/   repo: {REPO}')
        httpd.serve_forever()

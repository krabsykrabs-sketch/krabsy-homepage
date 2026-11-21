#!/usr/bin/env python3
# Dev static server that disables caching, so edited ES modules always reload.
import http.server, socketserver

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True

if __name__ == '__main__':
    with Server(('', 8042), Handler) as httpd:
        httpd.serve_forever()

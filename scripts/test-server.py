"""Static test server with Cloudflare Pages clean URLs: /events serves events.html.

Pages links use the clean form (a .html href costs every crawler a 308 hop),
so the Playwright server must resolve it too. Usage: python3 scripts/test-server.py PORT
"""
import http.server
import os
import sys


class CleanUrlHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        local = super().translate_path(path)
        if not os.path.exists(local) and os.path.isfile(local + '.html'):
            return local + '.html'
        return local


if __name__ == '__main__':
    server = http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), CleanUrlHandler)
    server.serve_forever()

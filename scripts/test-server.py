"""Static test server with Cloudflare Pages clean URLs: /events serves events.html.

Pages links use the clean form (a .html href costs every crawler a 308 hop),
so the Playwright server must resolve it too. Usage: python3 scripts/test-server.py PORT
"""
import http.server
import os
import sys


class Server(http.server.ThreadingHTTPServer):
    # The default listen backlog is 5: a page's parallel asset burst overflows it and the
    # browser sees ERR_CONNECTION_RESET (the flaky cookie-banner and smoke failures).
    request_queue_size = 256


class CleanUrlHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        local = super().translate_path(path)
        if not os.path.exists(local) and os.path.isfile(local + '.html'):
            return local + '.html'
        return local


if __name__ == '__main__':
    server = Server(('127.0.0.1', int(sys.argv[1])), CleanUrlHandler)
    server.serve_forever()

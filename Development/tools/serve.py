# Dev server for Crow Game: static files with caching disabled, so phones
# and browsers always pick up fresh code after a reload.
# Usage: python serve.py [port]   (serves the Development folder on 0.0.0.0)

import http.server
import os
import sys
from functools import partial

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    handler = partial(NoCacheHandler, directory=ROOT)
    server = http.server.ThreadingHTTPServer(('0.0.0.0', port), handler)
    print(f'Crow Game dev server: http://0.0.0.0:{port} (serving {ROOT}, no-cache)')
    server.serve_forever()


if __name__ == '__main__':
    main()

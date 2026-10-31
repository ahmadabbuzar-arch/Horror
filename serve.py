#!/usr/bin/env python3
"""Tiny local web server (assets are external files now, so file:// will not work).  python3 serve.py  ->  http://localhost:8000"""
import http.server,socketserver,mimetypes
mimetypes.add_type('model/gltf-binary','.glb')
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self): self.send_header('Cache-Control','no-cache'); super().end_headers()
with socketserver.TCPServer(('',8000),H) as s:
    print('Serving on http://localhost:8000  (Ctrl+C to stop)'); s.serve_forever()

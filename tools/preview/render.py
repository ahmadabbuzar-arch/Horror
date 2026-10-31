import json,sys,threading,http.server,socketserver,base64,functools,os
from playwright.sync_api import sync_playwright
ROOT='/home/claude/proj'
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
def serve():
    os.chdir(ROOT)
    socketserver.TCPServer.allow_reuse_address=True;s=socketserver.TCPServer(('127.0.0.1',0),H)
    threading.Thread(target=s.serve_forever,daemon=True).start();return s
class R:
    def __enter__(self):
        self.srv=serve();self.pw=sync_playwright().start()
        self.b=self.pw.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        self.pg=self.b.new_page();self.pg.on('console',lambda m:print('[page]',m.text) if m.type in('error','warning') else None)
        self.pg.goto('http://127.0.0.1:%d/tools/preview/preview.html'%self.srv.server_address[1]+'');self.pg.wait_for_function('window.ready===true');return self
    def render(self,spec,out):
        d=self.pg.evaluate('async s=>{for(const m of s.models){if(m.preM)m.pre=new Float32Array(m.preM)}return await window.renderSpec(s)}',spec)
        open(out,'wb').write(base64.b64decode(d.split(',')[1]))
    def bounds(self,url,pre=None):
        return self.pg.evaluate('async a=>await window.bounds(a[0],a[1]?new Float32Array(a[1]):undefined)',[url,pre])
    def __exit__(self,*a):
        self.b.close();self.pw.stop();self.srv.shutdown();self.srv.server_close()

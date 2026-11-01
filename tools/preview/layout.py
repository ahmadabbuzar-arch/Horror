"""Offline layout check: renders the whole village (original + new props) from above/oblique using the same placement maths as js/p1-props.js.
Usage: python3 tools/preview/layout.py   -> /tmp/layout_top.png, /tmp/layout_obl.png"""
import sys, json, re, subprocess, numpy as np
sys.path.insert(0, '/home/claude')
from render import R
ROOT = '/tmp/tlv'
cfg = json.loads(subprocess.check_output(['node', '-e', "const vm=require('vm'),fs=require('fs');const P1={cfg:{car:{}}};const w={P1:P1,window:null};w.window=w;vm.createContext(w);vm.runInContext(fs.readFileSync('js/p1-config.js','utf8'),w);console.log(JSON.stringify(w.P1.config.village))"], cwd=ROOT))
def ry(a): c, s = np.cos(a), np.sin(a); return np.array([[c,0,s,0],[0,1,0,0],[-s,0,c,0],[0,0,0,1.]])
def T(x,y,z): m = np.eye(4); m[:3,3] = (x,y,z); return m
def S(k): return np.diag([k,k,k,1.])
with R() as r:
    models = []
    for c in cfg['props'] + cfg['wrecks']:
        url = '/' + c['url'].split('?')[0]; b = r.bounds(url); lo, hi = np.array(b['lo']), np.array(b['hi']); sz = hi - lo
        s = c['lengthM'] / max(sz[0], sz[2]) if 'lengthM' in c else c.get('scale', 1)
        ctr = np.array([(lo[0]+hi[0])/2, lo[1], (lo[2]+hi[2])/2])
        M = T(c['x'], -c.get('sink', 0), c['z']) @ ry(np.radians(c.get('yaw', 0))) @ S(s) @ T(-ctr[0], -ctr[1], -ctr[2])
        models.append({'url': url, 'preM': M.T.flatten().tolist()})
        print(c['id'], 'size m', (sz*s).round(1))
    models.append({'url': '/assets/models/village.glb', 'preM': T(-0.15, 0, 16.92).T.flatten().tolist()})   # original village (offset computed from its bbox, see index.html loadVillage)
    cx, cz = 8, 40
    for name, eye, fov in (('top', [cx, 150, cz + 0.01], 50), ('obl', [cx - 5, 55, cz - 70], 55)):
        spec = {'w': 1000, 'h': 800, 'models': models, 'cam': {'eye': eye, 'target': [cx, 0, cz], 'fov': fov}, 'bg': [.15, .17, .22],
                'light': {'sky': [.9, .9, .95], 'gnd': [.45, .42, .4], 'keyC': [.7, .7, .65], 'fillC': [.3, .3, .35]}}
        r.render(spec, '/tmp/layout_%s.png' % name)

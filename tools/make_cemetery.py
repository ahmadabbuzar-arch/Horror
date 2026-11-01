#!/usr/bin/env python3
"""r21: builds the small cemetery from the 'cemetery' kitbash (OBJ + BaseColor png).
   -> assets/props/cemetery.glb        7 graves (mound + headstone), metres, texture 2048 jpg
   -> assets/props/cemetery_fence.glb  closed wooden boundary on all four sides + open gate on the east side (plank crop of the same texture)
Usage: python3 tools/make_cemetery.py <folder with cemetery.obj and cemetery_None_BaseColor.png>
Prints the numbers to put into js/p1-config.js (x,z of gy_graves / gy_fence + collision circles)."""
import sys, os, json, struct, io, math
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = 'assets/props'
S = 1.6                                   # OBJ units -> metres (headstones ~1.3 m, graves 2.4 m long)
# fence rectangle in local metres (origin = OBJ origin * S), gate on the east (+x) side
X0, X1, Z0, Z1 = -4.5, 7.5, -2.0, 9.0
GATE_Z, GATE_W = 4.5, 2.8
PANEL_H, POST_H, GATE_POST_H = 1.45, 1.75, 2.3

# ---------------------------------------------------------------- OBJ
V, VT, VN, F = [], [], [], []
for l in open(os.path.join(SRC, 'cemetery.obj')):
    p = l.split()
    if not p: continue
    if p[0] == 'v': V.append(list(map(float, p[1:4])))
    elif p[0] == 'vt': VT.append(list(map(float, p[1:3])))
    elif p[0] == 'vn': VN.append(list(map(float, p[1:4])))
    elif p[0] == 'f': F.append([tuple(int(x) if x else 0 for x in t.split('/')) for t in p[1:]])
V = np.array(V); VT = np.array(VT); VN = np.array(VN)
par = list(range(len(V)))
def fd(x):
    while par[x] != x: par[x] = par[par[x]]; x = par[x]
    return x
for f in F:
    for t in f[1:]: par[fd(t[0] - 1)] = fd(f[0][0] - 1)
comps = {}
for f in F: comps.setdefault(fd(f[0][0] - 1), []).append(f)

def grave_part(faces):
    idx = sorted({t[0] - 1 for f in faces for t in f}); P = V[idx]
    mn, mx = P.min(0), P.max(0)
    if mx[1] > 0.5: return 'stone', mn, mx
    if len(faces) == 136 and mx[1] < 0.2 and mn[2] > 0.3: return 'mound', mn, mx
    return None, mn, mx                    # the model's own low fence pieces -> dropped (we build a closed one)

# ---------------------------------------------------------------- GLB writer
class Glb:
    def __init__(self): self.bin = bytearray(); self.views = []; self.acc = []; self.meshes = []; self.nodes = []
    def _view(self, data, target=None):
        while len(self.bin) % 4: self.bin.append(0)
        o = len(self.bin); self.bin += data
        v = {'buffer': 0, 'byteOffset': o, 'byteLength': len(data)}
        if target: v['target'] = target
        self.views.append(v); return len(self.views) - 1
    def _acc(self, arr, ctype, typ, target, minmax=False):
        a = {'bufferView': self._view(arr.tobytes(), target), 'componentType': ctype, 'count': int(len(arr)), 'type': typ}
        if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        self.acc.append(a); return len(self.acc) - 1
    def mesh(self, name, pos, nor, uv, idx):
        pos = np.asarray(pos, np.float32); nor = np.asarray(nor, np.float32); uv = np.asarray(uv, np.float32); idx = np.asarray(idx, np.uint32)
        prim = {'attributes': {'POSITION': self._acc(pos, 5126, 'VEC3', 34962, True), 'NORMAL': self._acc(nor, 5126, 'VEC3', 34962),
                               'TEXCOORD_0': self._acc(uv, 5126, 'VEC2', 34962)},
                'indices': self._acc(idx, 5125, 'SCALAR', 34963), 'material': 0}
        self.meshes.append({'name': name, 'primitives': [prim]}); self.nodes.append({'name': name, 'mesh': len(self.meshes) - 1})
    def save(self, path, jpg, wrap=10497):
        img = self._view(jpg)
        doc = {'asset': {'version': '2.0', 'generator': 'tools/make_cemetery.py'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(self.nodes)))}],
               'nodes': self.nodes, 'meshes': self.meshes, 'accessors': self.acc, 'bufferViews': self.views,
               'buffers': [{'byteLength': len(self.bin)}],
               'images': [{'bufferView': img, 'mimeType': 'image/jpeg'}],
               'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': wrap, 'wrapT': wrap}],
               'textures': [{'source': 0, 'sampler': 0}],
               'materials': [{'name': 'cemetery', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': 1.0}, 'doubleSided': True}]}
        js = json.dumps(doc, separators=(',', ':')).encode()
        while len(js) % 4: js += b' '
        b = bytes(self.bin)
        while len(b) % 4: b += b'\0'
        out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(b)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(b), 0x004E4942) + b
        open(path, 'wb').write(out); return len(out)

def jpeg(im, q=85):
    b = io.BytesIO(); im.convert('RGB').save(b, 'JPEG', quality=q, optimize=True); return b.getvalue()

# ---------------------------------------------------------------- graves
tex = Image.open(os.path.join(SRC, 'cemetery_None_BaseColor.png')).convert('RGB')
g = Glb(); n_st = n_mo = 0
circles_raw = []     # (x, z, r) in metres, local (origin = OBJ origin)
allp = []
rnd = np.random.RandomState(13)          # fixed seed -> same crooked layout every build
def rot_y(a):
    c, s_ = math.cos(a), math.sin(a); return np.array([[c, 0, s_], [0, 1, 0], [-s_, 0, c]])
def rot_axis(ax, a):
    ax = np.asarray(ax, float); ax /= np.linalg.norm(ax); x, y, z = ax; c, s_ = math.cos(a), math.sin(a); C = 1 - c
    return np.array([[c + x*x*C, x*y*C - z*s_, x*z*C + y*s_], [y*x*C + z*s_, c + y*y*C, y*z*C - x*s_], [z*x*C - y*s_, z*y*C + x*s_, c + z*z*C]])
parts = []
for faces in comps.values():
    kind, mn, mx = grave_part(faces)
    if kind: parts.append((kind, faces, mn, mx))
mounds = [q for q in parts if q[0] == 'mound']
def pair(st):                                        # mound that belongs to a headstone: same column, just south of it
    sx = (st[2][0] + st[3][0]) / 2
    c = [m for m in mounds if m[2][2] > st[3][2] - 0.05 and abs((m[2][0] + m[3][0]) / 2 - sx) < 0.4]
    return min(c, key=lambda m: m[2][2] - st[3][2])
templates = [(pair(st), st) for st in parts if st[0] == 'stone']        # 7 different mound+headstone pairs of the model
templates.sort(key=lambda t: (t[0][2][2] > 1.0, t[0][2][0]))
# GRID: columns x (m), rows = z where the mound starts (headstone stands just north of it). 5 x 3 = 15 graves, aisles ~0.9 m, free strip on the east for the gate.
COLS = [-3.0, -1.0, 1.0, 3.0, 5.0]; ROWS = [-0.8, 2.4, 5.6]
N_GRAVES = len(COLS) * len(ROWS)
heavy = set(rnd.choice(N_GRAVES, 4, replace=False).tolist())          # these headstones lean a lot (nearly falling)
n_st = n_mo = 0; gi = 0
for ri, rz in enumerate(ROWS):
    for ci, cx0 in enumerate(COLS):
        mnd, stn = templates[(ri * 3 + ci * 2 + ri * ci) % len(templates)]
        mc = np.array([(mnd[2][0] + mnd[3][0]) / 2 * S, 0, (mnd[2][2] + mnd[3][2]) / 2 * S])            # template mound centre (ground)
        shift = np.array([cx0, 0, rz + (mnd[3][2] - mnd[2][2]) / 2 * S]) - mc
        yaw = math.radians(rnd.uniform(-14, 14)); off = np.array([rnd.uniform(-.15, .15), -rnd.uniform(0, .05), rnd.uniform(-.15, .15)])
        lean = math.radians(rnd.uniform(14, 24) if gi in heavy else rnd.uniform(3, 10)); dirn = rnd.uniform(0, 2 * math.pi)
        syaw = math.radians(rnd.uniform(-16, 16)); ssink = rnd.uniform(.04, .16); gi += 1
        ctr = mc + shift                                                                                  # mound centre in the grid
        for kind, (kfaces, kmn, kmx) in (('mound', mnd[1:]), ('stone', stn[1:])):
            key = {}; pos = []; nor = []; uv = []; idx = []
            for f in kfaces:
                ids = []
                for t in f:
                    k = (t[0], t[1], t[2])
                    if k not in key:
                        key[k] = len(pos); pos.append(V[t[0] - 1] * S); nor.append(VN[t[2] - 1] if t[2] else (0, 1, 0)); uv.append((VT[t[1] - 1][0], 1 - VT[t[1] - 1][1]))
                    ids.append(key[k])
                for i in range(1, len(ids) - 1): idx += [ids[0], ids[i], ids[i + 1]]
            pos = np.array(pos) + shift; nor = np.array(nor)
            Rm = rot_y(yaw)
            pos = (pos - ctr) @ Rm.T + ctr + off; nor = nor @ Rm.T            # mound AND its headstone turn / shift together
            if kind == 'stone':
                piv = np.array([(kmn[0] + kmx[0]) / 2 * S, kmn[1] * S, (kmn[2] + kmx[2]) / 2 * S]) + shift
                piv = (piv - ctr) @ Rm.T + ctr + off
                R = rot_axis((math.cos(dirn), 0, math.sin(dirn)), lean) @ rot_y(syaw)
                pos = (pos - piv) @ R.T + piv; nor = nor @ R.T
                pos[:, 1] -= pos[:, 1].min() + ssink                            # lowest corner of the leaning stone sinks into the ground
            nm = ('stone_%d' if kind == 'stone' else 'mound_%d') % (n_st if kind == 'stone' else n_mo)
            if kind == 'stone': n_st += 1
            else: n_mo += 1
            g.mesh(nm, pos, nor, uv, idx); allp += pos.tolist()
            qx, qz = (pos[:, 0].min() + pos[:, 0].max()) / 2, (pos[:, 2].min() + pos[:, 2].max()) / 2
            if kind == 'stone': circles_raw.append((qx, qz, 0.38))
            else:
                ax = Rm @ np.array([0, 0, 1.0])
                for d in (-0.6, 0.6): circles_raw.append((qx + ax[0] * d, qz + ax[2] * d, 0.55))
allp = np.array(allp); gmn, gmx = allp.min(0), allp.max(0)
size = g.save(os.path.join(OUT, 'cemetery.glb'), jpeg(tex.resize((2048, 2048), Image.LANCZOS), 84))
gcx, gcz = (gmn[0] + gmx[0]) / 2, (gmn[2] + gmx[2]) / 2
print('cemetery.glb %.2f MB  stones %d mounds %d  bbox x[%.2f,%.2f] z[%.2f,%.2f] y[%.3f,%.2f]' % (size / 1e6, n_st, n_mo, gmn[0], gmx[0], gmn[2], gmx[2], gmn[1], gmx[1]))

# ---------------------------------------------------------------- fence
# plank crop of the same texture (u .78-.90, v .05-.40), mirrored-repeat so tiles have no seams
W = tex.size[0]
crop = tex.crop((int(.78 * W), int((1 - .40) * W), int(.90 * W), int((1 - .05) * W))).resize((256, 768), Image.LANCZOS)
fg = Glb(); allf = []
def box(cx, cy, cz, sx, sy, sz, tu=0.9, tv=2.0):
    """axis-aligned box centred at (cx,cy,cz) with size (sx,sy,sz); uv tiled in metres (tu wide, tv tall)."""
    hx, hy, hz = sx / 2, sy / 2, sz / 2; P = []; N = []; U = []; I = []
    faces = [((1, 0, 0), [(hx, -hy, hz), (hx, -hy, -hz), (hx, hy, -hz), (hx, hy, hz)], sz, sy),
             ((-1, 0, 0), [(-hx, -hy, -hz), (-hx, -hy, hz), (-hx, hy, hz), (-hx, hy, -hz)], sz, sy),
             ((0, 0, 1), [(-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)], sx, sy),
             ((0, 0, -1), [(hx, -hy, -hz), (-hx, -hy, -hz), (-hx, hy, -hz), (hx, hy, -hz)], sx, sy),
             ((0, 1, 0), [(-hx, hy, hz), (hx, hy, hz), (hx, hy, -hz), (-hx, hy, -hz)], sx, sz),
             ((0, -1, 0), [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, -hy, hz), (-hx, -hy, hz)], sx, sz)]
    for nrm, cs, a, b in faces:
        o = len(P)
        for c, (u, v) in zip(cs, [(0, 0), (1, 0), (1, 1), (0, 1)]):
            P.append((cx + c[0], cy + c[1], cz + c[2])); N.append(nrm); U.append((u * a / tu, 1 - v * b / tv))
        I += [o, o + 1, o + 2, o, o + 2, o + 3]
    return P, N, U, I
def merge(parts):
    P = []; N = []; U = []; I = []
    for p, n, u, i in parts:
        o = len(P); P += p; N += n; U += u; I += [x + o for x in i]
    return P, N, U, I
def seg_posts(a, b, step=2.4):
    n = max(1, math.ceil(abs(b - a) / step)); return [a + (b - a) * i / n for i in range(n + 1)]
posts = []; caps = []; panels = []     # panels: (name, cx,cz,sx,sz)
def side(axis, fixed, a, b):
    """panel run along axis ('x' or 'z') at coordinate `fixed`, from a to b; posts between."""
    ps = seg_posts(a, b)
    for q in ps: posts.append((q, fixed) if axis == 'x' else (fixed, q))
    for i in range(len(ps) - 1):
        m = (ps[i] + ps[i + 1]) / 2; L = ps[i + 1] - ps[i]
        panels.append((axis, m, fixed, L))
gz0, gz1 = GATE_Z - GATE_W / 2, GATE_Z + GATE_W / 2
side('x', Z0, X0, X1); side('x', Z1, X0, X1); side('z', X0, Z0, Z1)
side('z', X1, Z0, gz0); side('z', X1, gz1, Z1)
gate_posts = {(X1, gz0), (X1, gz1)}
posts = [p for p in posts if (round(p[0], 3), round(p[1], 3)) not in {(round(a, 3), round(b, 3)) for a, b in gate_posts}]
posts = list({(round(a, 3), round(b, 3)) for a, b in posts})        # corners are added by two sides
pm = []; cm = []
for (px, pz) in posts:
    pm.append(box(px, POST_H / 2, pz, 0.20, POST_H, 0.20)); cm.append(box(px, POST_H + 0.04, pz, 0.30, 0.08, 0.30, 0.3, 0.3))
for (px, pz) in gate_posts:
    pm.append(box(px, GATE_POST_H / 2, pz, 0.30, GATE_POST_H, 0.30)); cm.append(box(px, GATE_POST_H + 0.05, pz, 0.42, 0.10, 0.42, 0.4, 0.4))
cm.append(box(X1, 2.12, GATE_Z, 0.22, 0.26, GATE_W + 0.3, 0.9, 0.3))        # lintel over the open gate
i = 0
for axis, m, fixed, L in panels:
    cx, cz, sx, sz = (m, fixed, L, 0.08) if axis == 'x' else (fixed, m, 0.08, L)
    P = box(cx, PANEL_H / 2, cz, sx, PANEL_H, sz)
    R = box(cx, PANEL_H + 0.05, cz, sx if axis == 'x' else 0.16, 0.10, 0.16 if axis == 'x' else sz, 0.9, 0.2)     # top rail
    p, n, u, ii = merge([P, R]); fg.mesh('fence_panel_%d' % i, p, n, u, ii); allf += p; i += 1
p, n, u, ii = merge(pm); fg.mesh('fence_posts', p, n, u, ii); allf += p
p, n, u, ii = merge(cm); fg.mesh('fence_caps', p, n, u, ii); allf += p
allf = np.array(allf); fmn, fmx = allf.min(0), allf.max(0)
size = fg.save(os.path.join(OUT, 'cemetery_fence.glb'), jpeg(crop, 88), wrap=33648)
fcx, fcz = (fmn[0] + fmx[0]) / 2, (fmn[2] + fmx[2]) / 2
print('cemetery_fence.glb %.2f MB  %d panels, %d posts, bbox x[%.2f,%.2f] z[%.2f,%.2f]' % (size / 1e6, len(panels), len(posts) + 2, fmn[0], fmx[0], fmn[2], fmx[2]))

# ---------------------------------------------------------------- config numbers
print('\nLOCAL (origin = OBJ origin * %.1f): graves centre (%.3f, %.3f), fence centre (%.3f, %.3f)' % (S, gcx, gcz, fcx, fcz))
print('circles (relative to graves centre):')
print(json.dumps([{'x': round(x - gcx, 2), 'z': round(z - gcz, 2), 'r': r} for x, z, r in circles_raw]))
json.dump({'gcx': gcx, 'gcz': gcz, 'fcx': fcx, 'fcz': fcz, 'circles': [{'x': round(x - gcx, 2), 'z': round(z - gcz, 2), 'r': r} for x, z, r in circles_raw]}, open('/tmp/cem.json', 'w'))
print('fence rect local x %.2f..%.2f z %.2f..%.2f ; gate z %.2f..%.2f on the east side' % (X0, X1, Z0, Z1, gz0, gz1))

#!/usr/bin/env python3
"""Builds assets/props/graveyard_wall.glb: the gate model's pillar + wall/railing wing, COPIED along a rectangle around the graveyard (world coordinates,
one mesh per ~3 units so the game's ray collision can skip far chunks). Opening on the east side is left for gy_gate. numpy only.
Run after tools/prep_props.py produced assets/props/graveyard_entrance.glb. Prints the bbox centre -> put it into p1-config.js (x,z of gy_wall)."""
import sys, json, struct
import numpy as np
sys.path.insert(0, 'tools/preview')
from glbinfo import load, accessor, walk
SRC = 'assets/props/graveyard_entrance.glb'; OUT = 'assets/props/graveyard_wall.glb'
GATE = (-23.4, 38.5); X_E, X_W, Z_S, Z_N = -23.4, -61.0, 17.94, 59.06
js, bn = load(SRC)
parts = {}
def fn(i, n, W, path):
    if 'mesh' not in n: return
    for pr in js['meshes'][n['mesh']]['primitives']:
        mat = js['materials'][pr['material']]['name']
        if mat not in ('Collum', 'Wall'): continue
        P = accessor(js, bn, pr['attributes']['POSITION']).astype(float); N = accessor(js, bn, pr['attributes']['NORMAL']).astype(float)
        U = accessor(js, bn, pr['attributes']['TEXCOORD_0']).astype(float); I = accessor(js, bn, pr['indices']).reshape(-1, 3).astype(np.int64)
        Pw = (np.c_[P, np.ones(len(P))] @ W.T)[:, :3]; Nw = N @ W[:3, :3].T; Nw /= np.maximum(np.linalg.norm(Nw, axis=1, keepdims=True), 1e-9)
        parts[mat] = dict(P=Pw, N=Nw, U=U, I=I, mi=pr['material'])
walk(js, bn, fn)
def sub(p, keep):   # keep triangles, compact vertices
    I = p['I'][keep]; used = np.unique(I); rm = np.full(len(p['P']), -1); rm[used] = np.arange(len(used))
    return dict(P=p['P'][used], N=p['N'][used], U=p['U'][used], I=rm[I], mi=p['mi'])
C, Wl = parts['Collum'], parts['Wall']
cen = C['P'][C['I']].mean(1)[:, 0]
pil = sub(C, cen > 0); cx = (pil['P'][:, 0].min() + pil['P'][:, 0].max()) / 2; half = (pil['P'][:, 0].max() - pil['P'][:, 0].min()) / 2
wing = sub(Wl, (Wl['P'][Wl['I']][:, :, 0] >= cx).all(1))
wmax = wing['P'][:, 0].max() - cx
print('pillar centre x %.3f half-width %.3f ; wing length (from pillar centre) %.3f' % (cx, half, wmax))
PERIOD = wmax + half     # next pillar centre = wing end + its half width
def place(p, A, d, o, stretch=1.0):
    P = p['P'].copy(); u = (P[:, 0] - cx) * stretch; z = P[:, 2]
    W = np.stack([A[0] + u * d[0] + z * o[0], P[:, 1], A[1] + u * d[1] + z * o[1]], 1)
    N = np.stack([p['N'][:, 0] * d[0] + p['N'][:, 2] * o[0], p['N'][:, 1], p['N'][:, 0] * d[1] + p['N'][:, 2] * o[1]], 1)
    return W, N
sides = [  # (start, end, outward)  d = (oz, -ox)
    ((X_E, Z_N), (X_E, GATE[1] + (cx if False else 1.76)), (1, 0)),
    ((X_E, GATE[1] - 1.76), (X_E, Z_S), (1, 0)),
    ((X_W, Z_S), (X_W, Z_N), (-1, 0)),   # placeholder, fixed below
]
# explicit, direction d=(oz,-ox):  east d=(0,-1) | north d=(1,0) | west d=(0,1) | south d=(-1,0)
spans = [
    ((X_E, Z_N), (X_E, GATE[1] + 1.76), (1, 0), True),      # NE corner -> gate north pillar (pillar at start only)
    ((X_E, GATE[1] - 1.76), (X_E, Z_S), (1, 0), False),     # gate south pillar -> SE corner (no pillar at the gate end)
    ((X_W, Z_N), (X_E, Z_N), (0, 1), True),                  # NW -> NE along north
    ((X_W, Z_S), (X_W, Z_N), (-1, 0), True),                 # SW -> NW along west
    ((X_E, Z_S), (X_W, Z_S), (0, -1), True),                 # SE -> SW along south
]
units = []   # (A, d, o, stretch, pillar?)
for A, B, o, pil_at_start in spans:
    d = (o[1], -o[0]); L = np.hypot(B[0] - A[0], B[1] - A[1]); n = max(1, round(L / PERIOD)); s = L / n
    assert abs((B[0] - A[0]) * d[0] + (B[1] - A[1]) * d[1] - L) < 1e-6, 'direction mismatch'
    for k in range(n):
        Ak = (A[0] + d[0] * s * k, A[1] + d[1] * s * k)
        units.append((Ak, d, o, s / PERIOD, pil_at_start or k > 0))
print('units', len(units))
CH = 3; chunks = []
for c0 in range(0, len(units), CH):
    prim = {'Collum': [], 'Wall': []}
    for A, d, o, st, pl in units[c0:c0 + CH]:
        if pl: prim['Collum'].append(place(pil, A, d, o) + (pil['U'], pil['I']))
        prim['Wall'].append(place(wing, A, d, o, st) + (wing['U'], wing['I']))
    chunks.append(prim)
# ---- write glb (only the 2 materials / their textures)
mats_src = [js['materials'][Wl['mi']], js['materials'][C['mi']]]; matidx = {'Wall': 0, 'Collum': 1}
texids = set()
def walk_tex(o):
    if isinstance(o, dict):
        if 'index' in o and isinstance(o['index'], int) and set(o) <= {'index', 'texCoord', 'scale', 'strength'}: texids.add(o['index'])
        for v in o.values(): walk_tex(v)
    elif isinstance(o, list):
        for v in o: walk_tex(v)
walk_tex(mats_src)
texids = sorted(texids); tmap = {t: i for i, t in enumerate(texids)}
imgids = sorted({js['textures'][t]['source'] for t in texids}); imap = {t: i for i, t in enumerate(imgids)}
# raw binary of the source file
d = open(SRC, 'rb').read(); l = struct.unpack('<I', d[12:16])[0]; bl = struct.unpack('<I', d[20 + l:24 + l])[0]; B = d[28 + l:28 + l + bl]
bins = bytearray(); BV = []; AC = []
def addbv(data, tgt=None):
    while len(bins) % 4: bins.append(0)
    BV.append({'buffer': 0, 'byteOffset': len(bins), 'byteLength': len(data), **({'target': tgt} if tgt else {})}); bins.extend(data); return len(BV) - 1
def addacc(arr, ct, typ, tgt, mm=False):
    ac = {'bufferView': addbv(arr.tobytes(), tgt), 'componentType': ct, 'count': int(len(arr)), 'type': typ}
    if mm: ac['min'] = arr.min(0).tolist(); ac['max'] = arr.max(0).tolist()
    AC.append(ac); return len(AC) - 1
images = []
for t in imgids:
    im = js['images'][t]; bv = js['bufferViews'][im['bufferView']]
    images.append({'bufferView': addbv(B[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]), 'mimeType': im.get('mimeType', 'image/png')})
def remap(o):
    if isinstance(o, dict):
        if 'index' in o and isinstance(o['index'], int) and set(o) <= {'index', 'texCoord', 'scale', 'strength'}: o['index'] = tmap[o['index']]
        for v in o.values(): remap(v)
    elif isinstance(o, list):
        for v in o: remap(v)
mats = json.loads(json.dumps(mats_src)); remap(mats)
textures = [{'sampler': 0, 'source': imap[js['textures'][t]['source']]} for t in texids]
meshes = []; nodes = []; allv = []
for ci, prim in enumerate(chunks):
    prs = []
    for mat in ('Wall', 'Collum'):
        if not prim[mat]: continue
        P = np.vstack([q[0] for q in prim[mat]]); N = np.vstack([q[1] for q in prim[mat]]); U = np.vstack([q[2] for q in prim[mat]])
        off = 0; I = []
        for q in prim[mat]: I.append(q[3] + off); off += len(q[0])
        I = np.vstack(I).reshape(-1).astype('<u2' if len(P) < 65535 else '<u4'); allv.append(P)
        prs.append({'attributes': {'POSITION': addacc(P.astype('<f4'), 5126, 'VEC3', 34962, True), 'NORMAL': addacc(N.astype('<f4'), 5126, 'VEC3', 34962), 'TEXCOORD_0': addacc(U.astype('<f4'), 5126, 'VEC2', 34962)},
                    'indices': addacc(I.reshape(-1, 1), 5123 if I.dtype == np.dtype('<u2') else 5125, 'SCALAR', 34963), 'material': matidx[mat]})
    meshes.append({'name': 'wall_chunk_%d' % ci, 'primitives': prs}); nodes.append({'name': 'wall_chunk_%d' % ci, 'mesh': ci})
out = {'asset': {'version': '2.0', 'generator': 'tools/make_graveyard_wall.py'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
       'materials': mats, 'textures': textures, 'images': images, 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
       'accessors': AC, 'bufferViews': BV, 'buffers': [{'byteLength': len(bins)}]}
j = json.dumps(out, separators=(',', ':')).encode(); j += b' ' * ((4 - len(j) % 4) % 4)
while len(bins) % 4: bins.append(0)
body = struct.pack('<II', len(j), 0x4E4F534A) + j + struct.pack('<II', len(bins), 0x004E4942) + bytes(bins)
open(OUT, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12 + len(body)) + body)
V = np.vstack(allv); lo, hi = V.min(0), V.max(0)
print('%s: %d tris, %.2f MB, bbox lo %s hi %s' % (OUT, sum(len(q[3]) for pr in chunks for m in pr.values() for q in m), (12 + len(body)) / 1e6, lo.round(2), hi.round(2)))
print('bbox centre x %.3f z %.3f' % ((lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2))

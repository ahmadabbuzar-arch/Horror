#!/usr/bin/env python3
"""THE LAST VILLAGE r25 - builds assets/models/village.glb = a Western street made from the 'Westen building pack' OBJ.

Usage:  python3 tools/make_western_town.py <folder with 'Westen building pack.obj/.mtl' + Texture/> <old village.glb> assets/models/village.glb

* the 5 old houses (and everything that belonged to them) are NOT copied; only the 9 cactus cylinders of the old village are kept
* every building is one named node (WT_<name>) with translation / yaw / uniform scale, so it can be nudged later by editing LAYOUT below
* coordinates are WORLD metres (the GLB is flagged scene.extras.worldCoords = true, index.html then does not re-centre it)
* textures: shrunk to power-of-two JPEG (BIG = 1024 px for the main wall atlases, others 512)
Only Pillow + numpy are needed.
"""
import sys, os, io, json, math, struct, collections
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
SRC, OLD, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
K = 5.0                      # OBJ units -> metres (a door in the pack is ~0.33 units high -> 1.65 m)
BIG_CAP, SMALL_CAP, JPEG_Q = 1024, 512, 80
BIG = {'bank txtr', 'blacksmith txtr', 'cerkov txtr', 'domik 1 txtr', 'hotel textura', 'izba 1 txtr', 'littlesaloon txtr',
       'old wood build txtr', 'sheriff build txtr', 'store txtr', 'visileca', 'fluger txtr', 'viz txtr',
       'hptel vizor dveri txtr', 'cerkov dver vizor txtr', 'door saray', 'dver bilo chrna'}

# ---------------------------------------------------------------- LAYOUT (world x, z in metres; yaw in degrees, 0 = front looks +Z, 90 = front looks +X, 270 = looks -X, 180 = looks -Z)
# main street runs north (+Z) along x = 3; the player arrives from the south (z ~ 6).
# obj name -> (id, x, z, yaw, scale_multiplier)
LAYOUT = [
    # west side of the street, fronts look east
    ('Cube.006_Cube.015',   'blacksmith', -4.4, 15.0,  90, 1.0),
    ('Cube.001',            'store',      -5.3, 25.0,  91, 1.0),
    ('Cube.002',            'hotel',      -5.4, 38.0,  89, 1.0),
    ('Cube.003',            'bank',       -5.0, 51.0,  90, 1.0),
    # east side of the street, fronts look west
    ('Cube.007_Cube.005',   'woodhouse',  10.8, 13.0, 270, 1.0),
    ('Cube.005_Cube.004',   'sheriff',    10.2, 23.5, 269, 1.25),
    ('Cube.004_Cube.008',   'saloon',     10.6, 38.0, 271, 1.0),
    ('Cube.009_Cube.007',   'house',      10.0, 47.0, 270, 1.0),
    ('Cube.008_Cube.006',   'cabin',       9.6, 54.0, 268, 1.0),
    # end of the street, looks back down the street (south)
    ('Cube',                'church',      3.0, 64.0, 180, 1.0),
    # street furniture / back yards
    ('Cube.014_Cube.013',   'wagon',       0.8, 19.8,  88, 1.0),
    ('Cube.011_Cube.010',   'gallows',    11.5,  8.0, 270, 1.0),
    ('Cube.012_Cube.011',   'vane',        3.0, 31.5,   0, 1.0),
    ('Cylinder',            'tower',     -12.5, 30.0,   0, 1.0),
    ('Cube.010_Cube.009',   'shed',      -11.0, 15.5,  90, 1.0),
    ('Cube.013_Cube.012',   'crate',       5.8, 34.0, 270, 1.0),
]
CACTUS_SHIFT = (9.5, 0.0, -1.0)     # old cactus group (world x 4.8..7.2, z 29.9..35.5 after the old placement) moved to the south-east outskirts
OLD_OFFSET = (-0.15, 0.05, 16.92)   # old village.glb -> world offset used by the old index.html

# ---------------------------------------------------------------- tiny GLB writer
class G:
    def __init__(s):
        s.bin = bytearray(); s.views = []; s.acc = []; s.images = []; s.tex = []; s.mats = []; s.meshes = []; s.nodes = []; s.imgmap = {}; s.matmap = {}
    def view(s, data, target=None):
        while len(s.bin) % 4: s.bin += b'\0'
        v = {'buffer': 0, 'byteOffset': len(s.bin), 'byteLength': len(data)}
        if target: v['target'] = target
        s.bin += data; s.views.append(v); return len(s.views) - 1
    def accessor(s, arr, ctype, typ, target, minmax=False):
        a = {'bufferView': s.view(arr.tobytes(), target), 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
        if minmax: a['min'] = [float(x) for x in arr.min(0)]; a['max'] = [float(x) for x in arr.max(0)]
        s.acc.append(a); return len(s.acc) - 1
    def image(s, key, data, mime):
        if key in s.imgmap: return s.imgmap[key]
        s.images.append({'bufferView': s.view(data), 'mimeType': mime, 'name': key}); s.tex.append({'sampler': 0, 'source': len(s.images) - 1})
        s.imgmap[key] = len(s.tex) - 1; return s.imgmap[key]
    def material(s, key, texidx, name, factor=(1, 1, 1, 1), rough=0.9):
        if key in s.matmap: return s.matmap[key]
        pb = {'baseColorFactor': list(factor), 'metallicFactor': 0.0, 'roughnessFactor': rough}
        if texidx is not None: pb['baseColorTexture'] = {'index': texidx}
        s.mats.append({'name': name, 'doubleSided': True, 'pbrMetallicRoughness': pb}); s.matmap[key] = len(s.mats) - 1; return s.matmap[key]
    def write(s, path, extras):
        js = {'asset': {'version': '2.0', 'generator': 'make_western_town.py'}, 'scene': 0,
              'scenes': [{'nodes': list(range(len(s.nodes))), 'extras': extras}], 'nodes': s.nodes, 'meshes': s.meshes, 'materials': s.mats,
              'textures': s.tex, 'images': s.images, 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
              'accessors': s.acc, 'bufferViews': s.views, 'buffers': [{'byteLength': len(s.bin)}]}
        j = json.dumps(js, separators=(',', ':')).encode()
        while len(j) % 4: j += b' '
        b = bytes(s.bin)
        while len(b) % 4: b += b'\0'
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(b)))
            f.write(struct.pack('<II', len(j), 0x4E4F534A)); f.write(j)
            f.write(struct.pack('<II', len(b), 0x004E4942)); f.write(b)

def pot(n, cap):
    n = min(n, cap); e = round(math.log2(max(n, 8))); return min(2 ** e, cap)

def jpeg_for(fname, cache={}):
    key = os.path.splitext(os.path.basename(fname))[0]
    if key in cache: return cache[key]
    im = Image.open(os.path.join(SRC, 'Texture', os.path.basename(fname))).convert('RGB')
    cap = BIG_CAP if key in BIG else SMALL_CAP
    sc = cap / max(im.size)
    w, h = pot(int(im.size[0] * min(1, sc)), cap), pot(int(im.size[1] * min(1, sc)), cap)
    im = im.resize((w, h), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=JPEG_Q, optimize=True)
    cache[key] = (key, b.getvalue(), (w, h)); return cache[key]

# ---------------------------------------------------------------- read OBJ / MTL
def read_mtl():
    mt, cur = {}, None
    for l in open(os.path.join(SRC, 'Westen building pack.mtl'), errors='ignore'):
        p = l.strip().split(None, 1)
        if len(p) < 2: continue
        if p[0] == 'newmtl': cur = p[1]; mt[cur] = {}
        elif cur: mt[cur][p[0]] = p[1]
    return mt

def read_obj():
    V, VT, VN = [], [], []
    objs = collections.OrderedDict(); cur = None; mat = None
    for line in open(os.path.join(SRC, 'Westen building pack.obj'), errors='ignore'):
        p = line.split()
        if not p: continue
        c = p[0]
        if c == 'v': V.append([float(x) for x in p[1:4]])
        elif c == 'vt': VT.append([float(p[1]), float(p[2])])
        elif c == 'vn': VN.append([float(x) for x in p[1:4]])
        elif c == 'o': cur = ' '.join(p[1:]); objs[cur] = collections.OrderedDict()
        elif c == 'usemtl': mat = p[1]; objs[cur].setdefault(mat, [])
        elif c == 'f':
            idx = []
            for t in p[1:]:
                q = t.split('/'); vi = int(q[0]) - 1
                ti = int(q[1]) - 1 if len(q) > 1 and q[1] else -1
                ni = int(q[2]) - 1 if len(q) > 2 and q[2] else -1
                idx.append((vi, ti, ni))
            for k in range(1, len(idx) - 1): objs[cur][mat].append((idx[0], idx[k], idx[k + 1]))
    return np.array(V), np.array(VT), np.array(VN), objs

def build_prim(V, VT, VN, tris):
    """-> positions, normals, uvs (glTF flipped v), indices ; vertices de-duplicated on (v, vt, vn)"""
    m = {}; P, N, U, I = [], [], [], []
    for tri in tris:
        for key in tri:
            j = m.get(key)
            if j is None:
                j = len(P); m[key] = j
                vi, ti, ni = key
                P.append(V[vi]); U.append([VT[ti][0], 1 - VT[ti][1]] if ti >= 0 else [0, 0]); N.append(VN[ni] if ni >= 0 else [0, 1, 0])
            I.append(j)
    return np.array(P, 'f4'), np.array(N, 'f4'), np.array(U, 'f4'), np.array(I, 'u4')

def quat_y(deg):
    h = math.radians(deg) / 2; return [0.0, math.sin(h), 0.0, math.cos(h)]

def main():
    g = G(); mt = read_mtl(); V, VT, VN, objs = read_obj()
    for oname, bid, x, z, yaw, mult in LAYOUT:
        mats = objs[oname]
        allv = sorted({t[0] for tris in mats.values() for tri in tris for t in tri})
        B = V[allv]; lo, hi = B.min(0), B.max(0)
        ctr = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
        prims = []
        for mname, tris in mats.items():
            if not tris: continue
            P, N, U, I = build_prim(V, VT, VN, tris)
            P = P - ctr.astype('f4')
            tx = os.path.basename(mt[mname]['map_Kd'].replace('\\', '/'))
            key, data, _ = jpeg_for(tx)
            ti = g.image(key, data, 'image/jpeg'); mi = g.material(key, ti, key)
            prims.append({'attributes': {'POSITION': g.accessor(P, 5126, 'VEC3', 34962, True), 'NORMAL': g.accessor(N, 5126, 'VEC3', 34962),
                                         'TEXCOORD_0': g.accessor(U, 5126, 'VEC2', 34962)},
                          'indices': g.accessor(I.reshape(-1, 1), 5125, 'SCALAR', 34963), 'material': mi, 'mode': 4})
        g.meshes.append({'name': 'WT_' + bid, 'primitives': prims})
        g.nodes.append({'name': 'WT_' + bid, 'mesh': len(g.meshes) - 1, 'translation': [x, -0.0, z], 'rotation': quat_y(yaw), 'scale': [K * mult] * 3,
                        'extras': {'building': bid}})
        print('%-11s %5.1f x %4.1f x %4.1f m  at (%.1f, %.1f) yaw %d' % (bid, *((hi - lo) * K * mult * np.array([1, 1, 1])), x, z, yaw))
    # ---- keep the old cactus group
    from importlib.machinery import SourceFileLoader
    gi = SourceFileLoader('glbinfo', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preview', 'glbinfo.py')).load_module()
    js, bn = gi.load(OLD)
    cact = [i for i, m in enumerate(js['materials']) if m.get('name') == 'Cactus']
    cm = js['materials'][cact[0]]; pb = cm.get('pbrMetallicRoughness', {})
    texidx = None
    if 'baseColorTexture' in pb:
        im = js['images'][js['textures'][pb['baseColorTexture']['index']]['source']]; bv = js['bufferViews'][im['bufferView']]
        raw = bytes(bn[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']])
        texidx = g.image('cactus', raw, im['mimeType'])
    cmi = g.material('cactus', texidx, 'Cactus', pb.get('baseColorFactor', [1, 1, 1, 1]))
    n_c = 0
    def collect(ni, n, W, path):
        nonlocal n_c
        if 'mesh' not in n: return
        for pr in js['meshes'][n['mesh']]['primitives']:
            if pr.get('material') not in cact: continue
            P = gi.accessor(js, bn, pr['attributes']['POSITION']).astype('f8'); P4 = np.c_[P, np.ones(len(P))] @ W.T
            Nn = gi.accessor(js, bn, pr['attributes']['NORMAL']).astype('f8') @ np.linalg.inv(W[:3, :3]).T if 'NORMAL' in pr['attributes'] else np.tile([0, 1, 0], (len(P), 1))
            Nn /= np.maximum(np.linalg.norm(Nn, axis=1, keepdims=True), 1e-9)
            U = gi.accessor(js, bn, pr['attributes']['TEXCOORD_0']).astype('f4')
            I = gi.accessor(js, bn, pr['indices']).astype('u4').reshape(-1)
            Pw = P4[:, :3] + np.array(OLD_OFFSET) + np.array(CACTUS_SHIFT)
            g.meshes.append({'name': 'WT_cactus%d' % n_c, 'primitives': [{'attributes': {
                'POSITION': g.accessor(Pw.astype('f4'), 5126, 'VEC3', 34962, True), 'NORMAL': g.accessor(Nn.astype('f4'), 5126, 'VEC3', 34962),
                'TEXCOORD_0': g.accessor(U, 5126, 'VEC2', 34962)}, 'indices': g.accessor(I.reshape(-1, 1), 5125, 'SCALAR', 34963), 'material': cmi, 'mode': 4}]})
            g.nodes.append({'name': 'Cactus%d' % n_c, 'mesh': len(g.meshes) - 1}); n_c += 1
    gi.walk(js, bn, collect)
    print('cactus pieces kept:', n_c)
    g.write(OUT, {'worldCoords': True, 'streetX': 3.0, 'entry': [3.0, 6.5], 'generator': 'r25 western town'})
    print('wrote', OUT, os.path.getsize(OUT) / 1e6, 'MB;', len(g.images), 'textures')

main()

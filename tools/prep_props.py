#!/usr/bin/env python3
"""Mobile-prep for the village prop GLBs (r5). numpy + Pillow only.
  prep_props.py in.glb out.glb [--tris N] [--tex 1024] [--lit]
* --tris N : decimate to about N triangles in total (UV-aware vertex clustering: vertices that share a grid cell AND a UV cell are merged,
             so texture seams stay intact). Meshes already below the target are untouched.
* --tex    : cap for every texture (px). Opaque textures -> JPEG q84, textures that really use alpha stay PNG.
* --lit    : drop KHR_materials_unlit (photogrammetry scans) so the game's torch/fog light them; roughness 1, metallic 0.
Drops: KHR_materials_specular, vertex colours, tangents, cameras. Node transforms/materials/texture assignments are preserved."""
import json, struct, io, sys, argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--tris', type=int, default=0); ap.add_argument('--tex', type=int, default=1024); ap.add_argument('--lit', action='store_true')
ap.add_argument('--drop-mat', default='', help='comma list of material names whose primitives are removed')
ap.add_argument('--crop', default='', help='cx,cz,hx,hz in WORLD units (node transforms applied): keep only triangles whose centre lies in this XZ rectangle')
ap.add_argument('--ntex', type=int, default=0, help='cap for NON-base-colour textures (normal / metal-rough / occlusion / emissive); 0 = same as --tex. Saves ~75%% of the memory of those.')
ap.add_argument('--uvq', type=int, default=40, help='UV cells per unit (seam preservation)')
a = ap.parse_args()

d = open(a.src, 'rb').read(); _, _, L = struct.unpack('<III', d[:12]); o = 12
while o < L:
    cl, ct = struct.unpack('<II', d[o:o + 8]); c = d[o + 8:o + 8 + cl]
    if ct == 0x4E4F534A: J = json.loads(c)
    elif ct == 0x004E4942: B = c
    o += 8 + cl

DT = {5126: '<f4', 5123: '<u2', 5125: '<u4', 5121: 'u1', 5120: 'i1', 5122: '<i2'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def acc(i):
    ac = J['accessors'][i]; bv = J['bufferViews'][ac['bufferView']]
    n = NC[ac['type']]; dt = np.dtype(DT[ac['componentType']]); off = bv.get('byteOffset', 0) + ac.get('byteOffset', 0)
    st = bv.get('byteStride', 0); isz = dt.itemsize * n
    if st and st != isz:
        raw = np.frombuffer(B, 'u1', st * ac['count'], off).reshape(ac['count'], st)[:, :isz].copy(); arr = raw.view(dt).reshape(ac['count'], n)
    else: arr = np.frombuffer(B, dt, ac['count'] * n, off).reshape(ac['count'], n)
    if ac.get('normalized'):
        arr = arr.astype(np.float32) / np.iinfo(dt).max
    return arr

# ---------- node world matrices (only needed for --crop)
def _nm(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    x, y, z, w = n.get('rotation', [0, 0, 0, 1]); sc = np.array(n.get('scale', [1, 1, 1]))
    R = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
    M = np.eye(4); M[:3, :3] = R * sc; M[:3, 3] = n.get('translation', [0, 0, 0]); return M
MESHW = {}
def _walk(i, Mp):
    W = Mp @ _nm(J['nodes'][i])
    if 'mesh' in J['nodes'][i]: MESHW.setdefault(J['nodes'][i]['mesh'], W)
    for c in J['nodes'][i].get('children', []): _walk(c, W)
for r in J['scenes'][J.get('scene', 0)]['nodes']: _walk(r, np.eye(4))

# ---------- geometry
class Prim: pass
prims = []   # (mesh index, prim index, data)
total = 0
for mi, m in enumerate(J['meshes']):
    for pi, pr in enumerate(m['primitives']):
        if pr.get('mode', 4) != 4: continue
        if J.get('materials') and 'material' in pr and J['materials'][pr['material']].get('name') in set(filter(None, a.drop_mat.split(','))): continue
        at = pr['attributes']
        P = acc(at['POSITION']).astype(np.float64)
        N = acc(at['NORMAL']).astype(np.float64) if 'NORMAL' in at else None
        U = acc(at['TEXCOORD_0']).astype(np.float64) if 'TEXCOORD_0' in at else None
        I = acc(pr['indices']).reshape(-1).astype(np.int64) if 'indices' in pr else np.arange(len(P))
        if pr.get('mode', 4) != 4: continue   # lines/points are dropped
        if a.crop:
            cx, cz, hx, hz = [float(v) for v in a.crop.split(',')]
            Wm = MESHW[mi]; Pw = (np.c_[P, np.ones(len(P))] @ Wm.T)[:, :3]
            ins = (np.abs(Pw[:, 0] - cx) <= hx) & (np.abs(Pw[:, 2] - cz) <= hz)
            keep = ins[I.reshape(-1, 3)].all(1)     # all three corners inside: long triangles that cross the border are dropped (no spikes)
            I = I.reshape(-1, 3)[keep].reshape(-1)
            if len(I) == 0: continue
        total += len(I) // 3
        prims.append(dict(mi=mi, pi=pi, P=P, N=N, U=U, I=I.reshape(-1, 3), pr=pr))

def cluster(p, s):
    P, N, U, I = p['P'], p['N'], p['U'], p['I']
    cell = np.floor((P - P.min(0)) / s).astype(np.int64)
    key = [cell[:, 0], cell[:, 1], cell[:, 2]]
    if U is not None:
        uc = np.floor(U * a.uvq).astype(np.int64); key += [uc[:, 0], uc[:, 1]]
    K = np.stack(key, 1)
    _, inv = np.unique(K, axis=0, return_inverse=True); inv = inv.reshape(-1)
    nv = inv.max() + 1; cnt = np.bincount(inv, minlength=nv).astype(np.float64)
    def mean(X):
        out = np.zeros((nv, X.shape[1]))
        for k in range(X.shape[1]): out[:, k] = np.bincount(inv, X[:, k], minlength=nv) / cnt
        return out
    P2 = mean(P); N2 = None
    if N is not None:
        N2 = mean(N); ln = np.linalg.norm(N2, axis=1, keepdims=True); N2 = N2 / np.where(ln < 1e-9, 1, ln)
    U2 = mean(U) if U is not None else None
    T = inv[I]
    ok = (T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])
    T = T[ok]
    return P2, N2, U2, T

def decimate(p, target):
    if len(p['I']) <= target: return p['P'], p['N'], p['U'], p['I']
    ext = (p['P'].max(0) - p['P'].min(0)).max()
    lo, hi = ext / 4000, ext / 3     # cell size search (bigger cell = fewer triangles)
    best = None
    for _ in range(18):
        mid = (lo * hi) ** 0.5; r = cluster(p, mid)
        if len(r[3]) > target: lo = mid
        else: hi = mid; best = r
    return best if best is not None else cluster(p, hi)

for p in prims:
    tgt = int(a.tris * len(p['I']) / total) if a.tris else 10 ** 12
    if a.tris and tgt < 150: tgt = min(len(p['I']), 150)
    P_, N_, U_, T_ = decimate(p, tgt)
    used = np.unique(T_); remap = np.full(len(P_), -1, np.int64); remap[used] = np.arange(len(used))   # drop vertices no triangle uses (after crop / degenerate removal)
    p['out'] = (P_[used], None if N_ is None else N_[used], None if U_ is None else U_[used], remap[T_])

# ---------- rebuild file
bins = bytearray(); BV = []; AC = []
def add_bv(data, target=None):
    while len(bins) % 4: bins.append(0)
    BV.append({'buffer': 0, 'byteOffset': len(bins), 'byteLength': len(data), **({'target': target} if target else {})}); bins.extend(data); return len(BV) - 1
def add_acc(arr, ctype, typ, target, minmax=False):
    bv = add_bv(arr.tobytes(), target)
    ac = {'bufferView': bv, 'componentType': ctype, 'count': int(len(arr)), 'type': typ}
    if minmax: ac['min'] = arr.min(0).tolist(); ac['max'] = arr.max(0).tolist()
    AC.append(ac); return len(AC) - 1

newmeshes = [{'name': m.get('name'), 'primitives': []} for m in J['meshes']]
tris_out = 0
for p in prims:
    P, N, U, T = p['out']; tris_out += len(T)
    at = {'POSITION': add_acc(P.astype('<f4'), 5126, 'VEC3', 34962, True)}
    if N is not None: at['NORMAL'] = add_acc(N.astype('<f4'), 5126, 'VEC3', 34962)
    if U is not None: at['TEXCOORD_0'] = add_acc(U.astype('<f4'), 5126, 'VEC2', 34962)
    idx = T.reshape(-1); big = len(P) > 65535
    ia = add_acc(idx.astype('<u4' if big else '<u2').reshape(-1, 1), 5125 if big else 5123, 'SCALAR', 34963)
    np_ = {'attributes': at, 'indices': ia}
    if 'material' in p['pr']: np_['material'] = p['pr']['material']
    newmeshes[p['mi']]['primitives'].append(np_)

# ---------- textures
alpha_used = set()
for m in J.get('materials', []):
    if m.get('alphaMode') in ('MASK', 'BLEND'):
        bt = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if bt: alpha_used.add(J['textures'][bt['index']]['source'])
base_src = set()
for m in J.get('materials', []):
    bt = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    if bt: base_src.add(J['textures'][bt['index']]['source'])
newimgs = []
for ii, im in enumerate(J.get('images', [])):
    bv = J['bufferViews'][im['bufferView']]; raw = B[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
    img = Image.open(io.BytesIO(raw)); w, h = img.size; cap = a.tex if (ii in base_src or not a.ntex) else min(a.tex, a.ntex); s = min(1.0, cap / max(w, h))
    if s < 1: img = img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    buf = io.BytesIO()
    has_a = ii in alpha_used and (img.mode in ('RGBA', 'LA', 'P')) and img.convert('RGBA').getchannel('A').getextrema()[0] < 250
    if has_a: img.convert('RGBA').quantize(256, method=Image.FASTOCTREE).save(buf, 'PNG', optimize=True); mt = 'image/png'
    else: img.convert('RGB').save(buf, 'JPEG', quality=84, optimize=True); mt = 'image/jpeg'
    newimgs.append({'bufferView': add_bv(buf.getvalue()), 'mimeType': mt, **({'name': im['name']} if 'name' in im else {})})

mats = json.loads(json.dumps(J.get('materials', [])))
for m in mats:
    ex = m.get('extensions', {})
    for k in ('KHR_materials_specular', 'KHR_materials_unlit'): ex.pop(k, None)
    if not ex: m.pop('extensions', None)
    if a.lit:
        pm = m.setdefault('pbrMetallicRoughness', {}); pm['metallicFactor'] = 0.0; pm['roughnessFactor'] = 1.0; pm.pop('metallicRoughnessTexture', None)
out = {'asset': {'version': '2.0', 'generator': 'tools/prep_props.py'}, 'scene': J.get('scene', 0), 'scenes': J['scenes'], 'nodes': J['nodes'],
       'meshes': newmeshes, 'materials': mats, 'textures': J.get('textures', []), 'images': newimgs, 'samplers': J.get('samplers', []),
       'accessors': AC, 'bufferViews': BV, 'buffers': [{'byteLength': len(bins)}]}
for n in out['nodes']:
    for k in ('camera', 'skin', 'extensions', 'extras'): n.pop(k, None)
for k in ('textures',):
    if not out[k]: out.pop(k)
for k in ('images', 'samplers', 'materials'):
    if not out[k]: out.pop(k)
j = json.dumps(out, separators=(',', ':')).encode(); j += b' ' * ((4 - len(j) % 4) % 4)
while len(bins) % 4: bins.append(0)
body = struct.pack('<II', len(j), 0x4E4F534A) + j + struct.pack('<II', len(bins), 0x004E4942) + bytes(bins)
open(a.dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12 + len(body)) + body)
print('%s: %d -> %d tris, %.2f -> %.2f MB' % (a.src.split('/')[-1], total, tris_out, len(d) / 1e6, (12 + len(body)) / 1e6))

#!/usr/bin/env python3
"""Decimate a vertex-coloured photogrammetry scan (COLOR_0, no real base-colour texture) for mobile. numpy only.
  prep_scan_color.py in.glb out.glb --tris 110000 [--sat 1.0]
Vertex clustering (grid cells); positions, normals and COLOR_0 are averaged per cluster. Textures/specular extension are dropped
(the Cluny file's only texture is a specular map - it carries no colour). Node transforms are kept."""
import json, struct, sys, argparse
import numpy as np
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst'); ap.add_argument('--tris', type=int, default=100000)
a = ap.parse_args()
d = open(a.src, 'rb').read(); L = struct.unpack('<I', d[8:12])[0]; o = 12
while o < L:
    cl, ct = struct.unpack('<II', d[o:o + 8]); c = d[o + 8:o + 8 + cl]
    if ct == 0x4E4F534A: J = json.loads(c)
    elif ct == 0x004E4942: B = c
    o += 8 + cl
DT = {5126: '<f4', 5123: '<u2', 5125: '<u4', 5121: 'u1', 5120: 'i1', 5122: '<i2'}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def acc(i):
    ac = J['accessors'][i]; bv = J['bufferViews'][ac['bufferView']]; n = NC[ac['type']]; dt = np.dtype(DT[ac['componentType']])
    off = bv.get('byteOffset', 0) + ac.get('byteOffset', 0); st = bv.get('byteStride', 0); isz = dt.itemsize * n
    if st and st != isz:
        arr = np.frombuffer(B, 'u1', st * ac['count'], off).reshape(ac['count'], st)[:, :isz].copy().view(dt).reshape(ac['count'], n)
    else: arr = np.frombuffer(B, dt, ac['count'] * n, off).reshape(ac['count'], n)
    if ac.get('normalized'): arr = arr.astype(np.float64) / np.iinfo(dt).max
    return arr.astype(np.float64)
prims = []; total = 0
for mi, m in enumerate(J['meshes']):
    for pr in m['primitives']:
        at = pr['attributes']; P = acc(at['POSITION']); N = acc(at['NORMAL']); C = acc(at['COLOR_0'])[:, :3]
        I = acc(pr['indices']).reshape(-1, 3).astype(np.int64) if 'indices' in pr else np.arange(len(P)).reshape(-1, 3)
        total += len(I); prims.append(dict(mi=mi, P=P, N=N, C=C, I=I))
def cluster(p, s):
    P = p['P']; cell = np.floor((P - P.min(0)) / s).astype(np.int64)
    _, inv = np.unique(cell, axis=0, return_inverse=True); inv = inv.reshape(-1); nv = inv.max() + 1; cnt = np.bincount(inv, minlength=nv)
    mean = lambda X: np.stack([np.bincount(inv, X[:, k], minlength=nv) / cnt for k in range(X.shape[1])], 1)
    N2 = mean(p['N']); N2 /= np.maximum(np.linalg.norm(N2, axis=1, keepdims=True), 1e-9)
    T = inv[p['I']]; ok = (T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])
    return mean(P), N2, mean(p['C']), T[ok]
def decimate(p, tgt):
    if len(p['I']) <= tgt: return p['P'], p['N'], p['C'], p['I']
    ext = (p['P'].max(0) - p['P'].min(0)).max(); lo, hi = ext / 4000, ext / 3; best = None
    for _ in range(18):
        mid = (lo * hi) ** .5; r = cluster(p, mid)
        if len(r[3]) > tgt: lo = mid
        else: hi = mid; best = r
    return best if best is not None else cluster(p, hi)
bins = bytearray(); BV = []; AC = []
def add(arr, ct, typ, tgt, mm=False):
    while len(bins) % 4: bins.append(0)
    BV.append({'buffer': 0, 'byteOffset': len(bins), 'byteLength': arr.nbytes, 'target': tgt}); bins.extend(arr.tobytes())
    ac = {'bufferView': len(BV) - 1, 'componentType': ct, 'count': int(len(arr)), 'type': typ}
    if mm: ac['min'] = arr.min(0).tolist(); ac['max'] = arr.max(0).tolist()
    AC.append(ac); return len(AC) - 1
meshes = [{'name': m.get('name'), 'primitives': []} for m in J['meshes']]; tout = 0
for p in prims:
    P, N, C, T = decimate(p, max(150, int(a.tris * len(p['I']) / total)))
    used = np.unique(T); rm = np.full(len(P), -1, np.int64); rm[used] = np.arange(len(used)); T = rm[T]; tout += len(T)
    big = len(used) > 65535
    at = {'POSITION': add(P[used].astype('<f4'), 5126, 'VEC3', 34962, True), 'NORMAL': add(N[used].astype('<f4'), 5126, 'VEC3', 34962),
          'COLOR_0': add(np.clip(C[used] * 65535, 0, 65535).astype('<u2'), 5123, 'VEC3', 34962)}
    J_acc = AC[at['COLOR_0']]; J_acc['normalized'] = True
    ia = add(T.reshape(-1, 1).astype('<u4' if big else '<u2'), 5125 if big else 5123, 'SCALAR', 34963)
    meshes[p['mi']]['primitives'].append({'attributes': at, 'indices': ia, 'material': 0})
out = {'asset': {'version': '2.0', 'generator': 'tools/prep_scan_color.py'}, 'scene': J.get('scene', 0), 'scenes': J['scenes'], 'nodes': J['nodes'], 'meshes': meshes,
       'materials': [{'name': 'Scan', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0.0, 'roughnessFactor': 1.0}}],
       'accessors': AC, 'bufferViews': BV, 'buffers': [{'byteLength': len(bins)}]}
for n in out['nodes']:
    for k in ('camera', 'skin', 'extensions', 'extras'): n.pop(k, None)
j = json.dumps(out, separators=(',', ':')).encode(); j += b' ' * ((4 - len(j) % 4) % 4)
while len(bins) % 4: bins.append(0)
body = struct.pack('<II', len(j), 0x4E4F534A) + j + struct.pack('<II', len(bins), 0x004E4942) + bytes(bins)
open(a.dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12 + len(body)) + body)
print('%d -> %d tris, %.2f MB' % (total, tout, (12 + len(body)) / 1e6))

#!/usr/bin/env python3
"""r29: builds assets/props/graveyard_map.glb from the Sketchfab "GRAVEYARD (HIGH QUALITY)" GLB (lorem Models, CC-BY-4.0).
  prep_graveyard.py graveyard_high_quality.glb assets/props/graveyard_map.glb [--scale 0.4] [--ground 1.75] [--tex 1024] [--terrain-tex 2048]

What it fixes (the source is a 98 MB / 431k-triangle Sketchfab export, not game-ready):
 * orientation : every node transform (Z-up -> Y-up, x2908 scale, mirrored axes) is BAKED into the vertices, winding is checked against the
                 normals (flipped if the node matrix mirrors) -> the file has no node transforms left, y is up, the origin is the map centre.
 * metres      : --scale converts model units to metres (0.4: terrain 23 m, tree 19 m, tombs up to 1.7 m high). File is in metres.
 * ground      : the terrain floats 0.9-2.9 model units above y=0 and has a hollow around the tree that would sink BELOW the game's flat ground
                 plane (= 'texture gone'). Heights below --ground are lifted to it and the outer margin is blended down to it, then --ground is
                 moved to y=0. The map therefore meets the game's ground exactly at its border and nothing is hidden under the ground plane.
 * tombs       : bottoms are extended down into the terrain, so no tomb floats after the terrain was changed.
 * materials   : metallicFactor 0.998 (terrain) / roughness 0.08 (tombs) without an environment map = black in three.js. Rebuilt as plain
                 diffuse (metal 0, rough 1); specular / metal-rough textures and KHR_materials_specular are dropped (not used by r128 anyway).
 * size        : terrain 128x128 -> 65x65 grid (fast floor ray), tree trunk + branches vertex-clustered (the branch UV is tiled V=0..600, so the
                 V cell size follows each vertex's own UV density), textures capped, JPEG. 98 MB -> ~10 MB.
Prints the numbers to put into js/p1-config.js (trunk collision circles, footprint, triangle counts).
numpy + Pillow only."""
import sys, json, struct, io, argparse
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--scale', type=float, default=0.4, help='model units -> metres')
ap.add_argument('--ground', type=float, default=1.75, help='model-unit height that becomes y=0 (edge level of the terrain)')
ap.add_argument('--margin', type=float, default=5.0, help='model units: width of the border strip that is blended down to --ground')
ap.add_argument('--tex', type=int, default=1024); ap.add_argument('--terrain-tex', type=int, default=2048)
ap.add_argument('--no-branch-normals', action='store_true', help='drop NORMAL from the thin branches (three.js then shades them flat) -> ~1 MB smaller')
ap.add_argument('--trunk-tris', type=int, default=45000); ap.add_argument('--branch-cell', type=float, default=0.15)
a = ap.parse_args()
S = a.scale

# ------------------------------------------------------------------ read
d = open(a.src, 'rb').read(); _, _, L = struct.unpack('<III', d[:12]); o = 12
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
        return np.frombuffer(B, 'u1', st * ac['count'], off).reshape(ac['count'], st)[:, :isz].copy().view(dt).reshape(ac['count'], n)
    return np.frombuffer(B, dt, ac['count'] * n, off).reshape(ac['count'], n)
def nodemat(n):
    if 'matrix' in n: return np.array(n['matrix'], float).reshape(4, 4).T
    x, y, z, w = n.get('rotation', [0, 0, 0, 1]); sc = np.array(n.get('scale', [1, 1, 1]))
    R = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
    M = np.eye(4); M[:3, :3] = R * sc; M[:3, 3] = n.get('translation', [0, 0, 0]); return M

# ------------------------------------------------------------------ bake every mesh node into world space (model units, Y up)
parts = {}      # material name -> list of dicts(P,N,U,I,name)
def visit(ni, Mp):
    n = J['nodes'][ni]; W = Mp @ nodemat(n)
    if 'mesh' in n:
        W3 = W[:3, :3]; det = np.linalg.det(W3); inv = np.linalg.inv(W3)
        for pr in J['meshes'][n['mesh']]['primitives']:
            at = pr['attributes']
            P = acc(at['POSITION']).astype(np.float64); Pw = P @ W3.T + W[:3, 3]
            Nw = acc(at['NORMAL']).astype(np.float64) @ inv; Nw /= np.linalg.norm(Nw, axis=1, keepdims=True) + 1e-12
            I = acc(pr['indices']).reshape(-1, 3).astype(np.int64)
            if det < 0: I = I[:, [0, 2, 1]]                      # mirrored node matrix -> keep counter-clockwise front faces
            parts.setdefault(J['materials'][pr['material']]['name'], []).append(dict(P=Pw, N=Nw, U=acc(at['TEXCOORD_0']).astype(np.float64), I=I, name=n.get('name', '')))
    for ch in n.get('children', []): visit(ch, W)
for r in J['scenes'][J.get('scene', 0)]['nodes']: visit(r, np.eye(4))

def fix_winding(p):
    T = p['P'][p['I']]; gn = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); gn /= np.linalg.norm(gn, axis=1, keepdims=True) + 1e-12
    vn = p['N'][p['I']].mean(1); agree = float(((gn * vn).sum(1) > 0).mean())
    if agree < 0.5: p['I'] = p['I'][:, [0, 2, 1]]; agree = 1 - agree
    return agree

MAT = {'terrain': 'coast_sand_rocks_02', 'tombs': 'gravel_concrete_03', 'trunk': 'jacaranda_tree_trunk', 'branches': 'jacaranda_tree_branches'}
for k, v in MAT.items():
    if v not in parts: sys.exit('material %s not found in %s' % (v, a.src))
    ag = [fix_winding(p) for p in parts[v]]
    print('%-9s %2d prim, winding vs normals agree %.3f..%.3f' % (k, len(ag), min(ag), max(ag)))
allP = np.concatenate([p['P'] for v in parts.values() for p in v])
print('baked bbox (model units) min', allP.min(0).round(2), 'max', allP.max(0).round(2))

# ------------------------------------------------------------------ terrain: regular grid -> 65x65, lifted / blended to --ground
tp = parts[MAT['terrain']]; assert len(tp) == 1
T0 = tp[0]; X = T0['P'][:, 0]; Z = T0['P'][:, 2]
xmin, xmax, zmin, zmax = X.min(), X.max(), Z.min(), Z.max(); NX = NZ = int(round(np.sqrt(len(X))))
ix = np.rint((X - xmin) / (xmax - xmin) * (NX - 1)).astype(int); iz = np.rint((Z - zmin) / (zmax - zmin) * (NZ - 1)).astype(int)
assert len(set(zip(ix, iz))) == NX * NZ, 'terrain is not a regular grid'
G = np.zeros((NZ, NX, 3)); GU = np.zeros((NZ, NX, 2)); G[iz, ix] = T0['P']; GU[iz, ix] = T0['U']
sel = list(range(0, NX - 1, 2)) + [NX - 1]
G = G[np.ix_(sel, sel)]; GU = GU[np.ix_(sel, sel)]; n = len(sel)
H0, M = a.ground, a.margin
half = max(xmax, -xmin, zmax, -zmin)
dist = half - np.maximum(np.abs(G[:, :, 0]), np.abs(G[:, :, 2]))            # distance to the map border
w = np.clip(dist / M, 0, 1); w = w * w * (3 - 2 * w)                          # smoothstep: 0 at the border, 1 inside
y_raw = G[:, :, 1].copy()
y = H0 + (np.maximum(y_raw, H0) - H0) * w                                     # lift hollows to H0, blend the border to H0
G[:, :, 1] = y
print('terrain %dx%d  raw y %.2f..%.2f  -> %.2f..%.2f (ground %.2f); lifted %.0f%% of vertices' % (n, n, y_raw.min(), y_raw.max(), y.min(), y.max(), H0, 100 * float((y_raw < H0).mean())))
def height_at(x, z):                                                           # bilinear, model units
    gx = np.clip((np.asarray(x) - G[0, 0, 0]) / (G[0, -1, 0] - G[0, 0, 0]), 0, 1) * 0 + 0
    xs = G[0, :, 0]; zs = G[:, 0, 2]
    i = np.clip(np.searchsorted(xs, x) - 1, 0, n - 2); j = np.clip(np.searchsorted(zs, z) - 1, 0, n - 2)
    fx = np.clip((x - xs[i]) / (xs[i + 1] - xs[i]), 0, 1); fz = np.clip((z - zs[j]) / (zs[j + 1] - zs[j]), 0, 1)
    return (G[j, i, 1] * (1 - fx) * (1 - fz) + G[j, i + 1, 1] * fx * (1 - fz) + G[j + 1, i, 1] * (1 - fx) * fz + G[j + 1, i + 1, 1] * fx * fz)
tidx = np.arange(n * n).reshape(n, n)
a_, b_, c_, d_ = tidx[:-1, :-1].ravel(), tidx[:-1, 1:].ravel(), tidx[1:, :-1].ravel(), tidx[1:, 1:].ravel()
TI = np.concatenate([np.stack([a_, c_, b_], 1), np.stack([b_, c_, d_], 1)])
TP = G.reshape(-1, 3); TU = GU.reshape(-1, 2)
gn = np.cross(TP[TI[:, 1]] - TP[TI[:, 0]], TP[TI[:, 2]] - TP[TI[:, 0]])
if gn[:, 1].mean() < 0: TI = TI[:, [0, 2, 1]]; gn = -gn                      # make sure the terrain faces UP
TN = np.zeros_like(TP)
for k in range(3): np.add.at(TN, TI[:, k], gn)
TN /= np.linalg.norm(TN, axis=1, keepdims=True) + 1e-12
print('terrain normals: mean y %.3f (must be > 0.9 = faces up), tris %d' % (TN[:, 1].mean(), len(TI)))
assert TN[:, 1].mean() > 0.9

# ------------------------------------------------------------------ tombs: extend the bottoms into the (changed) terrain
slabs = []
for p in parts[MAT['tombs']]:
    P = p['P']; ymin = P[:, 1].min()
    gx = np.linspace(P[:, 0].min(), P[:, 0].max(), 24); gz = np.linspace(P[:, 2].min(), P[:, 2].max(), 24)
    gg = np.array(np.meshgrid(gx, gz)).reshape(2, -1)
    t_low = float(height_at(gg[0], gg[1]).min())
    ext = ymin > t_low - 0.05
    if ext:
        low = P[:, 1] < ymin + 0.06; P[low, 1] = t_low - 0.4
    slabs.append(dict(name=p['name'], ymin0=float(ymin), terrain_min=t_low, extended=bool(ext), bb=(P.min(0).tolist(), P.max(0).tolist())))
print('tombs: %d, bottoms extended into the ground: %d' % (len(slabs), sum(s['extended'] for s in slabs)))

# ------------------------------------------------------------------ vertex clustering (tree)
def merge(prims):
    off = 0; P, N, U, I = [], [], [], []
    for p in prims: P.append(p['P']); N.append(p['N']); U.append(p['U']); I.append(p['I'] + off); off += len(p['P'])
    return np.concatenate(P), np.concatenate(N), np.concatenate(U), np.concatenate(I)
def vdens(P, U, I):                          # per-vertex UV density along its tube: max |dV| / edge length
    rho = np.zeros(len(P))
    for s_, t_ in ((0, 1), (1, 2), (2, 0)):
        Ln = np.linalg.norm(P[I[:, s_]] - P[I[:, t_]], axis=1) + 1e-9; r = np.minimum(np.abs(U[I[:, s_], 1] - U[I[:, t_], 1]) / Ln, 1e4)
        np.maximum.at(rho, I[:, s_], r); np.maximum.at(rho, I[:, t_], r)
    return np.maximum(rho, 1e-3)
def cluster(P, N, U, I, s, ukey):
    cell = np.floor((P - P.min(0)) / s).astype(np.int64); K = np.concatenate([cell, ukey], 1)
    _, inv = np.unique(K, axis=0, return_inverse=True); inv = inv.reshape(-1); nv = inv.max() + 1; cnt = np.bincount(inv, minlength=nv).astype(float)
    mean = lambda X: np.stack([np.bincount(inv, X[:, k], minlength=nv) / cnt for k in range(X.shape[1])], 1)
    P2, N2, U2 = mean(P), mean(N), mean(U); N2 /= np.linalg.norm(N2, axis=1, keepdims=True) + 1e-12
    Tt = inv[I]; ok = (Tt[:, 0] != Tt[:, 1]) & (Tt[:, 1] != Tt[:, 2]) & (Tt[:, 0] != Tt[:, 2])
    return P2, N2, U2, Tt[ok]
def shrink(P, N, U, I, target, ukey_fn):
    if len(I) <= target: return P, N, U, I
    lo, hi, best = 0.005, (P.max(0) - P.min(0)).max() / 3, None
    for _ in range(14):
        mid = (lo * hi) ** 0.5; r = cluster(P, N, U, I, mid, ukey_fn(mid))
        if len(r[3]) > target: lo = mid
        else: hi = mid; best = r
    return best if best is not None else cluster(P, N, U, I, hi, ukey_fn(hi))
tr = merge(parts[MAT['trunk']])
trunk = shrink(*tr, a.trunk_tris, lambda s: np.floor(tr[2] * 40).astype(np.int64))             # trunk UV is 0..1 (not tiled)
br = merge(parts[MAT['branches']]); rho = vdens(br[0], br[2], br[3])
bkey = lambda s: np.stack([np.floor(br[2][:, 0] * 3), np.floor(br[2][:, 1] / (rho * s))], 1).astype(np.int64)
branches = cluster(*br, a.branch_cell, bkey(a.branch_cell))
print('trunk %d -> %d tris, branches %d -> %d tris' % (len(tr[3]), len(trunk[3]), len(br[3]), len(branches[3])))
tomb = merge(parts[MAT['tombs']])

# ------------------------------------------------------------------ to metres, ground = y 0
def fin(P): Q = P.copy(); Q[:, 1] -= H0; return Q * S
meshes = {
    'gy_terrain':  (fin(TP), TN, TU, TI, 'terrain'),
    'gy_tombs':    (fin(tomb[0]), tomb[1], tomb[2], tomb[3], 'tombs'),
    'gy_trunk':    (fin(trunk[0]), trunk[1], trunk[2], trunk[3], 'trunk'),
    'gy_branches': (fin(branches[0]), branches[1], branches[2], branches[3], 'branches')}
tot = sum(len(m[3]) for m in meshes.values()); print('TOTAL %d triangles' % tot)
allm = np.concatenate([m[0] for m in meshes.values()]); print('final bbox (m) min', allm.min(0).round(2), 'max', allm.max(0).round(2))
for k, m in meshes.items(): print('  %-12s tris %6d  y %.2f..%.2f' % (k, len(m[3]), m[0][:, 1].min(), m[0][:, 1].max()))

# ------------------------------------------------------------------ trunk collision circles (ground level slice of the stems)
tp_ = meshes['gy_trunk'][0]; sl = tp_[(tp_[:, 1] > 0.15) & (tp_[:, 1] < 1.1)][:, [0, 2]]
circles = []
if len(sl):
    cell = np.floor(sl / 0.45).astype(int); keys, inv = np.unique(cell, axis=0, return_inverse=True); inv = inv.reshape(-1)
    for k in range(len(keys)):
        q = sl[inv == k]
        if len(q) < 12: continue
        c = q.mean(0); r = float(np.linalg.norm(q - c, axis=1).max()); circles.append({'x': round(float(c[0]), 2), 'z': round(float(c[1]), 2), 'r': round(max(0.18, min(r, 0.5)), 2)})
print('trunk collision circles (m, local to the map centre):', json.dumps(circles))

# ------------------------------------------------------------------ textures + GLB
def tex(img_index, cap, q=85):
    bv = J['bufferViews'][J['images'][img_index]['bufferView']]
    im = Image.open(io.BytesIO(B[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB')
    if max(im.size) > cap: im = im.resize((cap, cap), Image.LANCZOS)
    out = io.BytesIO(); im.save(out, 'JPEG', quality=q, optimize=True); return out.getvalue()
base_img = {}
for k, v in MAT.items():
    mi = next(i for i, m in enumerate(J['materials']) if m['name'] == v)
    base_img[k] = J['textures'][J['materials'][mi]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
bins = bytearray(); BV = []; AC = []
def add_bv(data, target=None):
    while len(bins) % 4: bins.append(0)
    BV.append({'buffer': 0, 'byteOffset': len(bins), 'byteLength': len(data), **({'target': target} if target else {})}); bins.extend(data); return len(BV) - 1
def add_acc(arr, ct, typ, target, mm=False):
    ac = {'bufferView': add_bv(arr.tobytes(), target), 'componentType': ct, 'count': int(len(arr)), 'type': typ}
    if mm: ac['min'] = arr.min(0).tolist(); ac['max'] = arr.max(0).tolist()
    AC.append(ac); return len(AC) - 1
images, textures, materials, gmeshes, nodes = [], [], [], [], []
for mi, (name, (P, N, U, I, key)) in enumerate(meshes.items()):
    data = tex(base_img[key], a.terrain_tex if key == 'terrain' else a.tex, 85)
    images.append({'bufferView': add_bv(data), 'mimeType': 'image/jpeg', 'name': key}); textures.append({'sampler': 0, 'source': mi})
    materials.append({'name': 'gy_' + key, 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': mi}, 'metallicFactor': 0.0, 'roughnessFactor': 1.0}})
    big = len(P) > 65535
    at = {'POSITION': add_acc(P.astype('<f4'), 5126, 'VEC3', 34962, True)}
    if not (a.no_branch_normals and key == 'branches'): at['NORMAL'] = add_acc(N.astype('<f4'), 5126, 'VEC3', 34962)
    at['TEXCOORD_0'] = add_acc(U.astype('<f4'), 5126, 'VEC2', 34962)
    ia = add_acc(I.reshape(-1).astype('<u4' if big else '<u2').reshape(-1, 1), 5125 if big else 5123, 'SCALAR', 34963)
    gmeshes.append({'name': name, 'primitives': [{'attributes': at, 'indices': ia, 'material': mi}]}); nodes.append({'name': name, 'mesh': mi})
doc = {'asset': {'version': '2.0', 'generator': 'tools/prep_graveyard.py', 'extras': {'source': 'GRAVEYARD (HIGH QUALITY) by lorem Models (https://sketchfab.com/Afthab333), CC-BY-4.0', 'scale': S, 'ground': H0}},
       'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': gmeshes, 'materials': materials, 'textures': textures, 'images': images,
       'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}], 'accessors': AC, 'bufferViews': BV, 'buffers': [{'byteLength': len(bins)}]}
j = json.dumps(doc, separators=(',', ':')).encode(); j += b' ' * ((4 - len(j) % 4) % 4)
while len(bins) % 4: bins.append(0)
body = struct.pack('<II', len(j), 0x4E4F534A) + j + struct.pack('<II', len(bins), 0x004E4942) + bytes(bins)
open(a.dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12 + len(body)) + body)
print('wrote %s  %.2f MB (source %.1f MB)' % (a.dst, (12 + len(body)) / 1e6, len(d) / 1e6))
json.dump({'scale': S, 'bbox_min': allm.min(0).round(3).tolist(), 'bbox_max': allm.max(0).round(3).tolist(), 'circles': circles, 'tris': tot, 'tombs': slabs}, open(a.dst + '.info.json', 'w'), indent=1)

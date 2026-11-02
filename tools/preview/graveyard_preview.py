#!/usr/bin/env python3
"""Offline check of assets/props/graveyard_map.glb (own software renderer, NOT the game, no lights/fog): top, side and eye-level views with the REAL base-colour textures.
  graveyard_preview.py assets/props/graveyard_map.glb out_prefix [--eye X Z YAWdeg]
Shows: orientation (y up), terrain meets y=0 at the border, tombs sit in the ground, tree stands on the terrain, no texture is missing (flat grey/black = missing)."""
import sys, json, struct, io, math
import numpy as np
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
eye = (0.0, 0.0, 0.0)
if '--eye' in sys.argv: k = sys.argv.index('--eye'); eye = tuple(float(v) for v in sys.argv[k + 1:k + 4])
d = open(src, 'rb').read(); _, _, L = struct.unpack('<III', d[:12]); o = 12
while o < L:
    cl, ct = struct.unpack('<II', d[o:o + 8]); c = d[o + 8:o + 8 + cl]
    if ct == 0x4E4F534A: J = json.loads(c)
    elif ct == 0x004E4942: B = c
    o += 8 + cl
DT = {5126: '<f4', 5123: '<u2', 5125: '<u4'}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}
def acc(i):
    ac = J['accessors'][i]; bv = J['bufferViews'][ac['bufferView']]; n = NC[ac['type']]
    return np.frombuffer(B, np.dtype(DT[ac['componentType']]), ac['count'] * n, bv.get('byteOffset', 0) + ac.get('byteOffset', 0)).reshape(ac['count'], n)
tris = []   # (world tri verts (n,3,3), colours (n,3), name)
for node in J['nodes']:
    m = J['meshes'][node['mesh']]; pr = m['primitives'][0]
    P = acc(pr['attributes']['POSITION']).astype(float); U = acc(pr['attributes']['TEXCOORD_0']).astype(float); I = acc(pr['indices']).reshape(-1, 3).astype(int)
    mat = J['materials'][pr['material']]; im = J['images'][J['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
    bv = J['bufferViews'][im['bufferView']]; tx = np.asarray(Image.open(io.BytesIO(B[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB').resize((256, 256)))
    uv = U[I].mean(1); u = np.mod(uv[:, 0], 1.0); v = np.mod(uv[:, 1], 1.0)
    col = tx[(v * 255).astype(int), (u * 255).astype(int)].astype(float)
    print('%-12s tris %6d  texture mean RGB %s' % (node['name'], len(I), tx.reshape(-1, 3).mean(0).round(0)))
    tris.append((P[I], col, node['name']))
def shade(T, col, light=(0.4, 0.8, 0.3)):
    n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    s = 0.45 + 0.55 * np.abs(n @ (np.array(light) / np.linalg.norm(light))); return (col * s[:, None]).clip(0, 255).astype(int)
def draw(proj, size, path, depth_fn, bg=(12, 14, 24)):
    items = []
    for T, col, nm in tris:
        cs = shade(T, col); dep = depth_fn(T.mean(1)); items.append((dep, T, cs))
    dep = np.concatenate([i[0] for i in items]); T = np.concatenate([i[1] for i in items]); cs = np.concatenate([i[2] for i in items])
    order = np.argsort(-dep); img = Image.new('RGB', size, bg); dr = ImageDraw.Draw(img)
    for k in order:
        p = proj(T[k])
        if p is None: continue
        dr.polygon(p, fill=tuple(cs[k]))
    img.save(path); print('wrote', path)
# top
def top(Tk): return [(450 + v[0] * 30, 450 + v[2] * 30) for v in Tk]
draw(top, (900, 900), out + '_top.png', lambda c: c[:, 1] * -1 + 0)
# side (looking along +z, x to the right, y up)
def side(Tk): return [(450 + v[0] * 30, 700 - v[1] * 30) for v in Tk]
draw(side, (900, 760), out + '_side.png', lambda c: -c[:, 2])
# eye level perspective (player eye 1.35 m above the ground at (x,z), yaw degrees: 0 = looking +z)
ex, ez, yaw = eye if any(eye) else (-9.0, -9.0, 45.0); yawr = math.radians(yaw); fwd = np.array([math.sin(yawr), 0, math.cos(yawr)]); right = np.array([math.cos(yawr), 0, -math.sin(yawr)])
hh = 1.35; f = 520
def persp(Tk):
    pts = []
    for v in Tk:
        r = np.array([v[0] - ex, v[1] - hh, v[2] - ez]); zc = r @ fwd
        if zc < 0.3: return None
        pts.append((450 + f * (r @ right) / zc, 330 - f * r[1] / zc))
    return pts
draw(persp, (900, 700), out + '_eye.png', lambda c: ((c[:, 0] - ex) * fwd[0] + (c[:, 2] - ez) * fwd[2]), bg=(30, 40, 70))

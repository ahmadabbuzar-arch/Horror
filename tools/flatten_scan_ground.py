#!/usr/bin/env python3
"""Flatten the ground of a photogrammetry scan so it lies on the game's flat y=0 ground (numpy + scipy).
  flatten_scan_ground.py in.glb out.glb [--cell 2.0] [--blur 2.0] [--pct 5] [--lift 0.0] [--yaw DEG]
The Cluny churchyard scan is a hillside: its west edge touches the ground but its east (gate) edge is ~2.3 m above it, so in the game the
scan floated in the air. We estimate a smooth ground surface h(x,z) (low envelope of the scan: per-cell low percentile -> grey erosion -> gaussian blur)
and subtract it from every vertex height: y' = y - h(x,z). Tombstones / mausoleum keep their shape (pure vertical shift by a smooth field),
normals are corrected with the shear's inverse-transpose. --yaw first turns the scan about the vertical axis through its bbox centre (three.js rotation.y convention).
Needs identity node transforms (run prep_scan_color.py first)."""
import json, struct, argparse, numpy as np
from scipy import ndimage as ndi
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--cell', type=float, default=2.0); ap.add_argument('--blur', type=float, default=2.0)
ap.add_argument('--pct', type=float, default=5.0); ap.add_argument('--lift', type=float, default=0.0); ap.add_argument('--yaw', type=float, default=0.0)
a = ap.parse_args()
d = open(a.src, 'rb').read(); L = struct.unpack('<I', d[8:12])[0]; o = 12
while o < L:
    cl, ct = struct.unpack('<II', d[o:o + 8]); c = d[o + 8:o + 8 + cl]
    if ct == 0x4E4F534A: J = json.loads(c)
    elif ct == 0x004E4942: B = bytearray(c)
    o += 8 + cl
for n in J['nodes']: assert not any(k in n for k in ('matrix', 'rotation', 'translation', 'scale')), 'node transform present: bake it first'
def view(i):
    ac = J['accessors'][i]; bv = J['bufferViews'][ac['bufferView']]; off = bv.get('byteOffset', 0) + ac.get('byteOffset', 0)
    assert ac['componentType'] == 5126 and not bv.get('byteStride')
    return ac, np.frombuffer(B, '<f4', ac['count'] * 3, off).reshape(-1, 3)   # writable view into B
prims = [(view(p['attributes']['POSITION']), view(p['attributes']['NORMAL'])) for m in J['meshes'] for p in m['primitives']]
P = np.vstack([p[0][1] for p in prims]).astype(np.float64)
if a.yaw:   # rotate about the vertical axis through the bbox centre (positions + normals, in place), then continue with the rotated data
    cx0, cz0 = (P[:, 0].min() + P[:, 0].max()) / 2, (P[:, 2].min() + P[:, 2].max()) / 2; th = np.radians(a.yaw); cs, sn = np.cos(th), np.sin(th)
    for (ac, pv), (_, nv) in prims:
        q = pv.astype(np.float64); u, w = q[:, 0] - cx0, q[:, 2] - cz0; q[:, 0] = cx0 + u * cs + w * sn; q[:, 2] = cz0 - u * sn + w * cs; pv[:] = q.astype(np.float32)
        m = nv.astype(np.float64); nu, nw = m[:, 0].copy(), m[:, 2].copy(); m[:, 0] = nu * cs + nw * sn; m[:, 2] = -nu * sn + nw * cs; nv[:] = m.astype(np.float32)
    P = np.vstack([p[0][1] for p in prims]).astype(np.float64)
x0, x1, z0, z1 = P[:, 0].min(), P[:, 0].max(), P[:, 2].min(), P[:, 2].max()
nx, nz = int(np.ceil((x1 - x0) / a.cell)) + 1, int(np.ceil((z1 - z0) / a.cell)) + 1
ix = np.clip(((P[:, 0] - x0) / a.cell).astype(int), 0, nx - 1); iz = np.clip(((P[:, 2] - z0) / a.cell).astype(int), 0, nz - 1)
G = np.full((nz, nx), np.nan); cnt = np.zeros((nz, nx), int)
order = np.lexsort((P[:, 1], ix + iz * nx)); key = (ix + iz * nx)[order]; ys = P[order, 1]
starts = np.r_[0, np.flatnonzero(np.diff(key)) + 1]; ends = np.r_[starts[1:], len(key)]
for s, e in zip(starts, ends):
    k = key[s]; cnt[k // nx, k % nx] = e - s
    if e - s >= 12: G[k // nx, k % nx] = np.percentile(ys[s:e], a.pct)
ok = ~np.isnan(G)
idx = ndi.distance_transform_edt(~ok, return_distances=False, return_indices=True)
G = G[tuple(idx)]                                   # empty cells take the nearest known ground height
G = ndi.grey_erosion(G, size=(3, 3), mode='nearest')   # ignore bumps (building plinths, tombstone bases)
G = ndi.gaussian_filter(G, a.blur, mode='nearest')
cx = x0 + (np.arange(nx) + 0.5) * a.cell; cz = z0 + (np.arange(nz) + 0.5) * a.cell
def h(x, z):  # bilinear sample (cell centres)
    return ndi.map_coordinates(G, [(z - cz[0]) / a.cell, (x - cx[0]) / a.cell], order=1, mode='nearest')
eps = 0.25
for (ac, pv), (_, nv) in prims:
    p = pv.astype(np.float64); H = h(p[:, 0], p[:, 2])
    hx = (h(p[:, 0] + eps, p[:, 2]) - h(p[:, 0] - eps, p[:, 2])) / (2 * eps); hz = (h(p[:, 0], p[:, 2] + eps) - h(p[:, 0], p[:, 2] - eps)) / (2 * eps)
    n = nv.astype(np.float64); n2 = np.c_[n[:, 0] + hx * n[:, 1], n[:, 1], n[:, 2] + hz * n[:, 1]]; n2 /= np.maximum(np.linalg.norm(n2, axis=1, keepdims=True), 1e-9)
    p[:, 1] = p[:, 1] - H + a.lift
    pv[:] = p.astype(np.float32); nv[:] = n2.astype(np.float32)
    ac['min'] = [float(v) for v in pv.min(0)]; ac['max'] = [float(v) for v in pv.max(0)]
J['buffers'][0]['byteLength'] = len(B)
js = json.dumps(J, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4); bb = bytes(B) + b'\0' * (-len(B) % 4)
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bb)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bb), 0x004E4942) + bb
open(a.dst, 'wb').write(out)
Q = np.vstack([p[0][1] for p in prims])
print('ground field range %.2f .. %.2f m (hill removed)' % (G.min(), G.max()))
print('after: y min %.2f max %.2f ; 5th pct %.2f, 50th %.2f' % (Q[:, 1].min(), Q[:, 1].max(), np.percentile(Q[:, 1], 5), np.percentile(Q[:, 1], 50)))

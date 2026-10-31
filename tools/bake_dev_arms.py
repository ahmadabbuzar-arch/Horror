#!/usr/bin/env python3
"""Dev is an UN-RIGGED mesh authored in a wide A-pose (arms ~45 deg from the body). A static mesh cannot be posed at
runtime, so the arms are rotated down once, offline, by moving the arm vertices (skin arm, sleeves, nails) about the shoulder
joint with a soft blend near the shoulder. Positions AND normals are rewritten; textures are untouched. Idempotent guard:
a marker in the glTF 'extras' stops it from being applied twice.
usage: python3 tools/bake_dev_arms.py assets/characters/dev.glb [--deg 25]
"""
import sys, json, struct, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from bake_poses import read, write, local_mat

DEG = 25.0
PIVOT = (14.0, 146.0)       # shoulder joint in the model's own world space (cm): (|x|, height)
BLEND = (18.0, 30.0)        # |x| range over which the rotation fades in (keeps the torso and armpit untouched)
MESHES = ('Skin_Arm', 'Henley', 'Nails')

def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def main(path, deg):
    js, rest = read(path)
    if (js.get('asset', {}).get('extras') or {}).get('p1_dev_arms_baked'):
        print('already baked'); return
    bn = bytearray(next(ch for ct, ch in rest if ct == 0x004E4942))
    par = {}
    for i, n in enumerate(js['nodes']):
        for c in n.get('children', []): par[c] = i
    def world(i):
        M = local_mat(js['nodes'][i])
        while i in par: i = par[i]; M = local_mat(js['nodes'][i]) @ M
        return M
    moved = {}
    for ni, n in enumerate(js['nodes']):
        if 'mesh' not in n or not any(k in n.get('name', '') for k in MESHES): continue
        M = world(ni); Mi = np.linalg.inv(M); Rn = np.linalg.inv(M[:3, :3]).T
        for pr in js['meshes'][n['mesh']]['primitives']:
            ap = js['accessors'][pr['attributes']['POSITION']]; bp = js['bufferViews'][ap['bufferView']]
            an = js['accessors'][pr['attributes']['NORMAL']]; bnv = js['bufferViews'][an['bufferView']]
            assert ap['componentType'] == 5126 and an['componentType'] == 5126, 'non-float vertex data not handled'
            def view(a, b):   # writable (count,3) float32 view honouring byteStride (interleaved buffers)
                return np.ndarray((a['count'], 3), '<f4', bn, b.get('byteOffset', 0) + a.get('byteOffset', 0), (b.get('byteStride') or 12, 4))
            vp, vn = view(ap, bp), view(an, bnv)
            P = vp.astype(float).copy(); Nn = vn.astype(float).copy()
            Pw = (M @ np.c_[P, np.ones(len(P))].T).T[:, :3]; Nw = Nn @ Rn.T
            ax = np.abs(Pw[:, 0]); w = smooth(BLEND[0], BLEND[1], ax)
            sgn = np.sign(Pw[:, 0]); th = -np.radians(deg) * w * sgn           # rotate about world Z, towards the body
            px = sgn * PIVOT[0]; dx = Pw[:, 0] - px; dy = Pw[:, 1] - PIVOT[1]
            c, s = np.cos(th), np.sin(th)
            Pw2 = Pw.copy(); Pw2[:, 0] = px + dx * c - dy * s; Pw2[:, 1] = PIVOT[1] + dx * s + dy * c
            Nw2 = Nw.copy(); Nw2[:, 0] = Nw[:, 0] * c - Nw[:, 1] * s; Nw2[:, 1] = Nw[:, 0] * s + Nw[:, 1] * c
            P2 = (Mi @ np.c_[Pw2, np.ones(len(P))].T).T[:, :3]; N2 = Nw2 @ np.linalg.inv(Rn.T).T
            N2 /= np.maximum(np.linalg.norm(N2, axis=1, keepdims=True), 1e-9)
            vp[:] = P2.astype('<f4'); vn[:] = N2.astype('<f4')
            ap['min'] = P2.min(0).tolist(); ap['max'] = P2.max(0).tolist()
            moved[n['name']] = int((w > 0.01).sum())
    js.setdefault('asset', {}).setdefault('extras', {})['p1_dev_arms_baked'] = deg
    rest = [(ct, bytes(bn) if ct == 0x004E4942 else ch) for ct, ch in rest]
    write(path, js, rest); print('arms lowered by', deg, 'deg; vertices touched:', moved)

if __name__ == '__main__':
    deg = float(sys.argv[sys.argv.index('--deg') + 1]) if '--deg' in sys.argv else DEG
    main(sys.argv[1], deg)

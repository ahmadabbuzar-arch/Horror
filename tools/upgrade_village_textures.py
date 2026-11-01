#!/usr/bin/env python3
"""Swap the 512 px textures of assets/models/village.glb for ambientCG (CC0) originals. Needs the *_4K-JPG.zip folders unzipped in TEXDIR (default /tmp/tex/<ID>/).
  upgrade_village_textures.py out.glb --color 1024 --normal 1024 --rough 512
Mapping (image index in village.glb -> ambientCG map) was verified by correlation with the old 512 images. glTF packing: normal = NormalGL; metal-rough = (255, rough, metal);
tinted variants (Planks023A black, Planks012 blue, Planks019 red) = affine colour fit old-natural -> old-variant, applied to the HD colour. Not touched: Cactus, Desert Floor, Wood026, wallpaper colour."""
import sys, os, io, json, struct, base64, argparse
import numpy as np
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('dst'); ap.add_argument('--color', type=int, default=1024); ap.add_argument('--normal', type=int, default=1024); ap.add_argument('--rough', type=int, default=512)
ap.add_argument('--src', default='assets/models/village.glb'); ap.add_argument('--texdir', default=os.environ.get('TEXDIR', '/tmp/tex'))
a = ap.parse_args()
d = open(a.src, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; J = json.loads(d[20:20 + L]); BL = struct.unpack('<I', d[20 + L:24 + L])[0]; BIN = bytearray(d[28 + L:28 + L + BL])
def raw(i):
    im = J['images'][i]
    if 'uri' in im: return base64.b64decode(im['uri'].split(',', 1)[1])
    bv = J['bufferViews'][im['bufferView']]; return bytes(BIN[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])
old = [Image.open(io.BytesIO(raw(i))).convert('RGB') for i in range(len(J['images']))]
def hd(mat, kind, longside, like):      # like = old image (aspect ratio)
    p = '%s/%s/%s_4K-JPG_%s.jpg' % (a.texdir, mat, mat, kind)
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGB'); w, h = like.size; s = longside / max(w, h); return im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
def enc(im, q, sub=0):
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True, subsampling=sub); return b.getvalue()
new = {}
# (material id, [normal idx, color idx, mr idx], mr_has_metal, color variants {idx: natural old-image idx or None})
SETS = [('Planks023A', 0, 1, 2, True, {30: 1}), ('Planks012', 15, 16, 17, True, {31: 16}), ('Planks019', 24, 25, 26, True, {}),
        ('Fabric019', 3, 4, 5, False, {}), ('PavingStones115B', 6, 7, 8, False, {}), ('Metal041C', 9, 10, 11, True, {}), ('Bricks096', 18, 19, 20, False, {}), ('Wallpaper001A', 27, None, 29, False, {})]
for mat, n, c, mr, has_metal, variants in SETS:
    nrm = hd(mat, 'NormalGL', a.normal, old[n]); 
    if nrm is not None: new[n] = enc(nrm, 93, 0)
    r = hd(mat, 'Roughness', a.rough, old[mr])
    if r is not None:
        g = np.array(r)[..., 0]; m = hd(mat, 'Metalness', a.rough, old[mr]) if has_metal else None
        B = np.array(m)[..., 0] if m is not None else (np.zeros_like(g) if has_metal else np.full_like(g, 255))
        new[mr] = enc(Image.fromarray(np.stack([np.full_like(g, 255), g, B], -1)), 92, 0)
    if c is None: continue
    col = hd(mat, 'Color', a.color, old[c]); 
    if col is None: continue
    nat = np.array(col)
    # Planks019 'Color_Red' (old idx 25) is itself a tinted image -> fit natural -> red
    srcs = {c: None}
    if mat == 'Planks019': srcs = {25: 'self'}
    for vi, ni in list(variants.items()):
        pass
    if mat == 'Planks019':
        nat512 = np.array(hd(mat, 'Color', 512, old[c]), float).reshape(-1, 3); t = np.array(old[25].resize((512, 512)) if old[25].size != (512, 512) else old[25], float).reshape(-1, 3)
        X, *_ = np.linalg.lstsq(np.c_[nat512, np.ones(len(nat512))], t, rcond=None)
        out = np.clip(np.c_[nat.reshape(-1, 3), np.ones(nat.shape[0] * nat.shape[1])] @ X, 0, 255).reshape(nat.shape).astype('u1'); new[25] = enc(Image.fromarray(out), 90, 0)
    else:
        new[c] = enc(col, 90, 0)
        for vi, ni in variants.items():
            n512 = np.array(hd(mat, 'Color', 512, old[ni]), float).reshape(-1, 3); t = np.array(old[vi], float).reshape(-1, 3)
            X, *_ = np.linalg.lstsq(np.c_[n512, np.ones(len(n512))], t, rcond=None)
            out = np.clip(np.c_[nat.reshape(-1, 3), np.ones(nat.shape[0] * nat.shape[1])] @ X, 0, 255).reshape(nat.shape).astype('u1'); new[vi] = enc(Image.fromarray(out), 90, 0)
BV = J['bufferViews']
for i, im in enumerate(J['images']):
    data = new.get(i) or raw(i); mt = 'image/jpeg' if data[:2] == b'\xff\xd8' else 'image/png'
    while len(BIN) % 4: BIN.append(0)
    BV.append({'buffer': 0, 'byteOffset': len(BIN), 'byteLength': len(data)}); BIN.extend(data)
    im.pop('uri', None); im['bufferView'] = len(BV) - 1; im['mimeType'] = mt
J['buffers'][0]['byteLength'] = len(BIN); J['buffers'][0].pop('uri', None)
js = json.dumps(J, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
while len(BIN) % 4: BIN.append(0)
body = struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(BIN), 0x004E4942) + bytes(BIN)
open(a.dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12 + len(body)) + body)
print('%s: %d textures upgraded, %.1f MB' % (a.dst, len(new), (12 + len(body)) / 1e6))

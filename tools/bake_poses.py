#!/usr/bin/env python3
"""Bake a natural standing pose into the rest pose of the rigged character GLBs (T-pose -> arms hanging).

Why offline: in a browser-less sandbox the runtime relaxArms() could not be verified, and the recording showed T-poses
anyway. Changing the joints' local rotations in the glTF JSON (binary data / inverse-bind matrices untouched) is
deterministic, can be rendered and checked with tools/preview, and is IDEMPOTENT (every bone is aimed at an absolute
world-space direction, so running it twice gives the same file).
usage: python3 tools/bake_poses.py assets/characters/kamla_devi.glb [more.glb ...]
"""
import json, struct, sys, os
import numpy as np

CHAINS = {  # file stem -> per side: (shoulder, upperarm, forearm, hand, hand-aim child regex)  ({s} = left/right token)
    'raghunath': dict(L=('mixamorig:LeftShoulder_08', 'mixamorig:LeftArm_09', 'mixamorig:LeftForeArm_010', 'mixamorig:LeftHand_011', 'LeftHandMiddle1'),
                      R=('mixamorig:RightShoulder_032', 'mixamorig:RightArm_033', 'mixamorig:RightForeArm_034', 'mixamorig:RightHand_035', 'RightHandMiddle1')),
    'kamla_devi': dict(L=('shoulder.l_0104', 'arm_stretch.l_0105', 'forearm_stretch.l_0106', 'hand.l_0107', 'middle1_base.l'),
                       R=('shoulder.r_081', 'arm_stretch.r_082', 'forearm_stretch.r_083', 'hand.r_084', 'middle1_base.r')),
    'shyamlal': dict(L=('L_shoulder_2_014', 'L_arm_2_015', 'L_elbow_2_016', 'L_wrist_2_017', 'L_middle1'),
                     R=('R_shoulder_2_039', 'R_arm_2_040', 'R_elbow_2_041', 'R_wrist_2_042', 'R_middle1')),
    'saaya': dict(L=('Shoulder_L_07', 'Arm_L_08', 'ForeArm_L_09', 'Hand_L_010', 'Middle1_L_017'),   # r4: new SAAYA model (Darkness of Eclipse ghost)
                        R=('Shoulder_R_027', 'Arm_R_028', 'ForeArm_R_029', 'Hand_R_030', 'Middle1_R_037')),
}
SHOULDER_DROP_DEG = 8.0     # clavicle slopes down
UPPER_OUT = 0.15            # sideways component of the upper-arm direction (unit vector is normalised afterwards)
UPPER_FWD = 0.05
FORE_OUT, FORE_FWD = 0.04, 0.34   # forearm: elbow slightly bent, hand a little in front of the hip
HAND_FWD = 0.20

def read(path):
    d = open(path, 'rb').read(); ln = struct.unpack('<I', d[8:12])[0]; o = 12; js = None; rest = []
    while o < ln:
        cl, ct = struct.unpack('<II', d[o:o + 8]); ch = d[o + 8:o + 8 + cl]; o += 8 + cl
        if ct == 0x4E4F534A: js = json.loads(ch)
        else: rest.append((ct, ch))
    return js, rest

def write(path, js, rest):
    j = json.dumps(js, separators=(',', ':')).encode()
    j += b' ' * ((4 - len(j) % 4) % 4)
    chunks = struct.pack('<II', len(j), 0x4E4F534A) + j
    for ct, ch in rest: chunks += struct.pack('<II', len(ch), ct) + ch
    open(path, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12 + len(chunks)) + chunks)

def q_to_R(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])

def R_to_q(R):
    t = np.trace(R)
    if t > 0:
        s = np.sqrt(t + 1) * 2; w = s / 4; x = (R[2, 1] - R[1, 2]) / s; y = (R[0, 2] - R[2, 0]) / s; z = (R[1, 0] - R[0, 1]) / s
    elif R[0, 0] > R[1, 1] and R[0, 0] > R[2, 2]:
        s = np.sqrt(1 + R[0, 0] - R[1, 1] - R[2, 2]) * 2; w = (R[2, 1] - R[1, 2]) / s; x = s / 4; y = (R[0, 1] + R[1, 0]) / s; z = (R[0, 2] + R[2, 0]) / s
    elif R[1, 1] > R[2, 2]:
        s = np.sqrt(1 + R[1, 1] - R[0, 0] - R[2, 2]) * 2; w = (R[0, 2] - R[2, 0]) / s; x = (R[0, 1] + R[1, 0]) / s; y = s / 4; z = (R[1, 2] + R[2, 1]) / s
    else:
        s = np.sqrt(1 + R[2, 2] - R[0, 0] - R[1, 1]) * 2; w = (R[1, 0] - R[0, 1]) / s; x = (R[0, 2] + R[2, 0]) / s; y = (R[1, 2] + R[2, 1]) / s; z = s / 4
    q = np.array([x, y, z, w]); return q / np.linalg.norm(q)

def local_mat(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    M = np.eye(4); s = np.array(n.get('scale', [1, 1, 1]))
    M[:3, :3] = q_to_R(n.get('rotation', [0, 0, 0, 1])) * s; M[:3, 3] = n.get('translation', [0, 0, 0]); return M

class Rig:
    def __init__(self, js):
        self.js = js; self.nodes = js['nodes']; self.par = {}
        for i, n in enumerate(self.nodes):
            for c in n.get('children', []): self.par[c] = i
        self.name = {n.get('name'): i for i, n in enumerate(self.nodes)}
        self.roots = js['scenes'][js.get('scene', 0)]['nodes']
        for n in self.nodes:    # matrix -> TRS so rotations can be edited
            if 'matrix' in n:
                M = local_mat(n); s = np.linalg.norm(M[:3, :3], axis=0); n['translation'] = M[:3, 3].tolist(); n['scale'] = s.tolist()
                n['rotation'] = R_to_q(M[:3, :3] / s).tolist(); del n['matrix']
        self.update()
    def update(self):
        self.W = {}
        def rec(i, P):
            self.W[i] = P @ local_mat(self.nodes[i])
            for c in self.nodes[i].get('children', []): rec(c, self.W[i])
        for r in self.roots: rec(r, np.eye(4))
    def pos(self, i): return self.W[i][:3, 3]
    def rot(self, i):
        M = self.W[i][:3, :3]; return M / np.linalg.norm(M, axis=0)
    def aim(self, bone, child, target):
        d = self.pos(child) - self.pos(bone); d /= np.linalg.norm(d); t = np.asarray(target, float); t /= np.linalg.norm(t)
        v = np.cross(d, t); c = float(np.dot(d, t))
        if np.linalg.norm(v) < 1e-9 and c > 0: return
        if c < -0.999999: raise RuntimeError('opposite directions')
        K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]]); R = np.eye(3) + K + K @ K / (1 + c)
        newW = R @ self.rot(bone); p = self.par.get(bone)
        Pw = self.rot(p) if p is not None else np.eye(3)
        self.nodes[bone]['rotation'] = R_to_q(Pw.T @ newW).tolist(); self.update()
    def kids(self, i, rx):
        import re
        return [c for c in self.nodes[i].get('children', []) if 'mesh' not in self.nodes[c] and re.search(rx, self.nodes[c].get('name', ''), re.I)]

def bake(path, stem):
    js, rest = read(path); rig = Rig(js); N = rig.name
    spec = CHAINS[stem]
    hips = next(i for k, i in N.items() if k and k.lower().startswith(('hips', 'mixamorig:hips', 'pelvis')) or (k and 'spine' in k.lower()))
    # forward direction = foot -> toe, in world space
    toe = next(i for k, i in N.items() if k and ('toe' in k.lower()) and not k.lower().endswith(('end', 'nub')))
    foot = rig.par[toe]; fwd = rig.pos(toe) - rig.pos(foot); fwd[1] = 0; fwd /= np.linalg.norm(fwd)
    up = np.array([0, 1, 0.]); right_of_model = np.cross(up, fwd)   # model's left-hand side when facing fwd (three.js: x = y cross z)
    report = {}
    for side in ('L', 'R'):
        sh, ua, fa, ha, hc = spec[side]
        sh_i, ua_i = N[sh], N[ua]
        fa_i = N[fa] if fa else rig.kids(ua_i, r'elbow|fore')[0]
        ha_i = N[ha] if ha else rig.kids(fa_i, r'wrist|hand')[0]
        sgn = 1.0 if np.dot(rig.pos(ua_i) - rig.pos(hips), right_of_model) > 0 else -1.0   # +1: on the model's +x-from-fwd side
        out = right_of_model * sgn
        # 1) clavicle slopes down
        dh = np.radians(SHOULDER_DROP_DEG); rig.aim(sh_i, ua_i, out * np.cos(dh) - up * np.sin(dh))
        # 2) upper arm hangs (slightly away from the body, slightly forward)
        rig.aim(ua_i, fa_i, -up + out * UPPER_OUT + fwd * UPPER_FWD)
        # 3) forearm: elbow slightly bent forward
        rig.aim(fa_i, ha_i, -up + out * FORE_OUT + fwd * FORE_FWD)
        # 4) hand continues the forearm, a little forward
        hk = rig.kids(ha_i, hc) or [c for c in rig.nodes[ha_i].get('children', []) if 'mesh' not in rig.nodes[c]]
        if hk: rig.aim(ha_i, hk[0], -up + out * 0.03 + fwd * HAND_FWD)
        report[side] = dict(upper_arm_dir=np.round((rig.pos(fa_i) - rig.pos(ua_i)) / np.linalg.norm(rig.pos(fa_i) - rig.pos(ua_i)), 3).tolist(),
                            fore_dir=np.round((rig.pos(ha_i) - rig.pos(fa_i)) / np.linalg.norm(rig.pos(ha_i) - rig.pos(fa_i)), 3).tolist())
    write(path, js, rest)
    return fwd, report

if __name__ == '__main__':
    for p in sys.argv[1:]:
        stem = os.path.splitext(os.path.basename(p))[0]
        if stem not in CHAINS: print('skip', p, '(no chain table / uses its own animation clip)'); continue
        fwd, rep = bake(p, stem); print(stem, 'forward', np.round(fwd, 2).tolist(), rep)

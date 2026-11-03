// offline logic test for js/p1-clinic.js with a mock THREE + fake asset manager (does NOT prove rendering)
const fs = require('fs');
class V3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } setScalar(s) { return this.set(s, s, s); } }
class Col { constructor(c) { this.r = this.g = this.b = 1; } setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; } clone() { return new Col(); } multiplyScalar() { return this; } }
class Obj {
  constructor() { this.position = new V3(); this.rotation = { order: 'XYZ', set(x, y, z) { this.x = x; this.y = y; this.z = z; }, x: 0, y: 0, z: 0 }; this.scale = new V3(1, 1, 1); this.children = []; this.parent = null; this.userData = {}; this.name = ''; this.visible = true; }
  add(c) { c.parent = this; this.children.push(c); return this; }
  remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; }
  traverse(f) { f(this); this.children.forEach(c => c.traverse(f)); }
  updateMatrixWorld() {}
  clone() { const o = new this.constructor(); o.name = this.name; o.isMesh = this.isMesh; o.material = this.material; o.geometry = this.geometry; o.position = new V3(this.position.x, this.position.y, this.position.z); this.children.forEach(c => o.add(c.clone())); return o; }
}
class Mesh extends Obj { constructor(g, m) { super(); this.isMesh = true; this.geometry = g; this.material = m; } }
class Mat { constructor(o) { Object.assign(this, o || {}); this.userData = {}; this.emissive = this.emissive || new Col(); } clone() { const m = new Mat(this); m.name = this.name; return m; } }
const THREE = { Group: Obj, Mesh, Vector3: V3, Color: Col, MeshStandardMaterial: Mat, MeshBasicMaterial: Mat,
  BoxGeometry: function () {}, PlaneGeometry: function () {}, CanvasTexture: function () { this.anisotropy = 1; },
  PointLight: class extends Obj { constructor(c, i, d, k) { super(); this.intensity = i; this.distance = d; } },
  sRGBEncoding: 1, AdditiveBlending: 2, DoubleSide: 2 };
global.THREE = THREE;
const ctx = new Proxy({}, { get: (t, k) => k === 'measureText' ? (s => ({ width: 60 })) : k === 'createLinearGradient' ? (() => ({ addColorStop() {} })) : (() => {}), set: () => true });
global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
global.window = { GQ: { id: 'high' } };
const boxes = {};   // measure(): fixed fake footprint around the model's holder position, keyed by url
const P1 = window.P1 = { status: {}, log() {}, warn: (...a) => console.log('WARN', ...a), config: { npcs: { arvind: {} } }, gy: 0,
  disposeMaterial() {}, assets: { n: 0, acquire(u) { this.n++; const scene = new Obj(); const m = new Mesh({}, new Mat({ name: /fluor/.test(u) ? 'Fluorescent tube switchable' : 'atlas' })); scene.add(m); return Promise.resolve({ scene }); }, release() { this.n--; } },
  measure(root) { return { min: { x: -0.4, y: 0, z: -0.4 }, max: { x: 0.4, y: 1, z: 0.4 }, getSize() { return new V3(0.8, 1, 0.8); } }; } };
eval(fs.readFileSync('js/p1-clinic.js', 'utf8'));

let ok = 0, bad = 0; const t = (n, c) => { if (c) ok++; else { bad++; console.log('FAIL', n); } };
const G = new Obj(); G.position.set(-0.17, 0.05, 16.9);
const door = { x: -0.17 - 4.10, z: 16.9 + 4.445 }, farDoor = { x: 5, z: 40 };
P1.startClinic({ scene: new Obj(), village: () => G, doors: [farDoor, door] });
t('door relabelled', Array.isArray(door.label) && !farDoor.label);
t('arvind rehomed (world = local + G)', Math.abs(P1.config.npcs.arvind.x - (-0.17 - 6.2)) < 1e-6 && Math.abs(P1.config.npcs.arvind.z - (16.9 + 5.5)) < 1e-6 && P1.config.npcs.arvind.snap === false);
const sg = P1.clinic.sign();
t('sign has 15 letters + cross', sg.letters.length === 16);
t('sign + point lights added to village group', G.children.length >= 3);
// simulate 60 s near the clinic: steady letters stay 1, flickering ones vary, weak ones mostly dark
const rec = sg.letters.map(() => ({ min: 9, max: -1, sum: 0 })); let n = 0;
const pos = new V3(2, 0, 22.5);
for (let i = 0; i < 60 * 30; i++) { P1.updateClinic(1 / 30, pos); sg.letters.forEach((L, k) => { const v = L.mat.opacity; const r = rec[k]; r.min = Math.min(r.min, v); r.max = Math.max(r.max, v); r.sum += v; }); n++; }
const modes = ['o'].concat(P1.clinic.cfg.sign.modes);
let steadyOk = true, flickOk = true, weakOk = true;
modes.forEach((m, k) => { const r = rec[k], avg = r.sum / n;
  if (m === 'o' && !(r.min === 1 && r.max === 1)) steadyOk = false;
  if (m === 'f' && !(r.min < 0.25 && r.max > 0.9 && avg > 0.5)) flickOk = false;
  if (m === 'w' && !(avg < 0.35 && r.max > 0.5)) weakOk = false; });
t('steady letters never change', steadyOk); t('flicker letters stutter but are mostly on', flickOk); t('weak letters mostly dark, blink sometimes', weakOk);
t('sign light follows brightness', sg.light.intensity > 0 && sg.light.intensity <= 1.0001);
// props load (async): status goes idle -> loading -> ready
t('state loading after first update', P1.clinic.state.status === 'loading' || P1.clinic.state.status === 'ready');
setTimeout(() => {
  t('props ready', P1.clinic.state.status === 'ready');
  t('colliders built for furniture', P1.clinic.state.boxes.length === 10);
  t('main tube material found', P1.clinic.state.tubes.main.length >= 1 && P1.clinic.state.tubes.dead.length >= 1);
  const p = { x: 0, z: 0 }; const b = P1.clinic.state.boxes[0]; p.x = (b.x0 + b.x1) / 2; p.z = (b.z0 + b.z1) / 2; P1.collideClinic(p);
  t('collision pushes player out of a box', p.x < b.x0 || p.x > b.x1 || p.z < b.z0 || p.z > b.z1);
  P1.gy = 2; const q = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }; P1.collideClinic(q); t('no furniture collision upstairs', q.x === (b.x0 + b.x1) / 2); P1.gy = 0;
  P1.updateClinic(0.03, new V3(80, 0, 90));
  t('unloads when far + lights off', P1.clinic.state.status === 'idle' && sg.light.intensity === 0 && P1.assets.n === 0);
  console.log(ok + ' pass, ' + bad + ' fail, ' + P1.status.clinic); process.exit(bad ? 1 : 0);
}, 50);

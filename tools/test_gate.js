// offline logic test for js/p1-gate.js with a mock THREE (does NOT prove rendering)
const fs = require('fs');
function Any() { return new Proxy(function () {}, { get: (t, k) => k === 'position' ? { set() {}, copy() {} } : k === 'rotation' ? {} : k === 'userData' ? (t._u = t._u || {}) : k === 'add' ? () => {} : k === 'translate' ? () => {} : k === 'makeTranslation' ? () => {} : () => {}, set: () => true }); }
const mk = () => { const o = { position: { set() {}, copy() {} }, rotation: {}, userData: {}, add() {}, translate() {}, makeTranslation() {}, setMatrixAt() {}, instanceMatrix: {}, updateMatrixWorld() {} }; return o; };
global.window = { P1: { status: {}, log() {}, warn() {} } };
global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }) }) };
global.THREE = new Proxy({}, { get: (t, k) => function () { return mk(); } });
THREE.RepeatWrapping = 1;
eval(fs.readFileSync('js/p1-gate.js', 'utf8'));
const P1 = window.P1; let doors = [];
P1.startGate({ scene: { add() {} }, addDoor: d => doors.push(d) });
let ok = 0, bad = 0; const t = (n, c) => { if (c) ok++; else { bad++; console.log('FAIL', n); } };
const cx = -26, cz = 38, H = 11.45, g = doors[0];
const hold = P1.gate.holder; hold.visible = true;
t('gate door registered', doors.length === 1 && g.piv.length === 2 && g.piv[0].userData.th < 0 && g.piv[1].userData.th > 0);
// closed gate blocks: walk from outside (east) towards inside through the gate centre
let p = { x: cx + H + 2, z: cz + 2.0 };
for (let i = 0; i < 100; i++) { p.x -= 0.09; P1.collideGate(p); }
t('closed gate blocks (x stays outside)', p.x > cx + H);
// open gate: passes
g.cur = 1; p = { x: cx + H + 2, z: cz + 2.0 };
for (let i = 0; i < 100; i++) { p.x -= 0.09; P1.collideGate(p); }
t('open gate lets player in', p.x < cx + H - 1);
// fence elsewhere blocks, all 4 sides, from outside and from inside
const tries = [[cx, cz - H - 2, 0, 1], [cx, cz + H + 2, 0, -1], [cx - H - 2, cz, 1, 0], [cx + H + 2, cz - 6, -1, 0]];
tries.forEach((s, i) => { p = { x: s[0], z: s[1] }; for (let k = 0; k < 120; k++) { p.x += s[2] * 0.09; p.z += s[3] * 0.09; P1.collideGate(p); }
  const inside = Math.abs(p.x - cx) < H && Math.abs(p.z - cz) < H; t('outside->inside blocked side ' + i, !inside); });
const ins = [[cx, cz, 0, -1], [cx, cz, 0, 1], [cx, cz, -1, 0], [cx, cz - 6, 1, 0]];
ins.forEach((s, i) => { p = { x: s[0], z: s[1] }; for (let k = 0; k < 250; k++) { p.x += s[2] * 0.09; p.z += s[3] * 0.09; P1.collideGate(p); }
  const inside = Math.abs(p.x - cx) < H + 0.01 && Math.abs(p.z - cz) < H + 0.01; t('inside->outside blocked side ' + i, inside); });
g.cur = 0;
console.log(ok + ' pass, ' + bad + ' fail, ' + window.P1.status.gate); process.exit(bad ? 1 : 0);

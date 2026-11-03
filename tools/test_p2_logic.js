/* Part 2 offline logic test: fake DOM + fake THREE + fake P1. Walks the WHOLE mission chain through the real engine code.  node tools/test_p2_logic.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
function el() { const e = { style: {}, children: [], className: '', textContent: '', _l: {}, appendChild(c) { this.children.push(c); c.parentNode = this; return c; }, insertBefore(c) { this.children.push(c); return c; }, contains() { return false; }, addEventListener(t, f) { this._l[t] = f; }, setAttribute() {}, getContext() { const g = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeText() {}, fillText() {} }; return g; } };
  Object.defineProperty(e, 'innerHTML', { set(v) { this.children = []; this.textContent = ''; }, get() { return ''; } }); return e; }
const ids = {}; const doc = { head: el(), body: el(), createElement: () => el(), createTextNode: t => ({ t }), getElementById: id => ids[id] || null, addEventListener() {}, pointerLockElement: null };
doc.body.appendChild = function (c) { if (c.id) ids[c.id] = c; return c; };
ids.hud = el();
const V = function () { this.x = this.y = this.z = 0; }; V.prototype.set = function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; };
const mesh = function () { return { position: { set() {}, y: 0 }, rotation: {}, scale: { set() {} }, add() {}, geometry: { dispose() {} }, material: { dispose() {} }, visible: true, traverse(f) { f(this); } }; };
const grp = function () { return Object.assign(mesh(), { position: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } } }); };
const THREE = { Vector3: V, Group: grp, Mesh: mesh, Sprite: mesh, SpriteMaterial: function () { return { dispose() {} }; }, CanvasTexture: function () {}, AdditiveBlending: 1,
  BoxGeometry: function () { return { dispose() {} }; }, CylinderGeometry: function () { return {}; }, ConeGeometry: function () { return {}; }, TorusGeometry: function () { return {}; }, SphereGeometry: function () { return {}; },
  MeshStandardMaterial: function () { return { dispose() {} }; }, MeshBasicMaterial: function () { return { dispose() {} }; } };
const sandbox = { window: null, document: doc, THREE, navigator: {}, location: { search: '' }, localStorage: (function () { const m = {}; return { getItem: k => m[k] || null, setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } }; })(),
  setTimeout: f => 0, addEventListener() {}, console };
sandbox.window = sandbox; sandbox.self = sandbox;
const slots = {}; ['raghunath', 'kamla', 'arvind', 'shyamlal', 'chotu', 'dev'].forEach((id, i) => { slots[id] = { cfg: { id, label: id[0].toUpperCase() + id.slice(1), height: 1.7 }, status: 'ready', holder: grp(), px: i * 10, pz: 0, py: 0, yaw: 0 }; slots[id].holder.rotation = { y: 0 }; });
sandbox.P1 = { gy: 0, log() {}, characters: { get: id => slots[id] }, clinic: { world: { x: -12, z: 22 } } };
vm.createContext(sandbox);
['p2-config.js', 'p2-story.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), sandbox, { filename: f }));
const P2 = sandbox.P2, C = P2.config, S = P2.state, TT = P2._test;
const world = { scene: { add() {}, remove() {} }, cam: { getWorldDirection(v) { v.set(0, 0, -1); } }, clear: () => true, ground: () => 0 };
P2.start(world);

// --- config sanity
ok(C.quests.length === 7, '7 missions');
const names = C.quests.map(q => q.npc); ok(JSON.stringify(names) === JSON.stringify(['raghunath', 'kamla', 'arvind', 'shyamlal', 'chotu', null, 'dev']), 'chain order / NPC owners');
C.quests.forEach(q => q.stages.forEach(s => { if (s.type === 'collect') s.items.forEach(i => ok(C.items[i], 'item defined: ' + i)); if (s.type === 'talk') ok(s.lines && s.lines.length, q.id + ' talk lines'); }));
Object.keys(C.items).forEach(k => { const it = C.items[k]; ok(it.read && it.read.length, k + ' read lines'); ok(typeof it.x === 'number' || it.near, k + ' position'); });
['raghunath', 'kamla', 'arvind', 'shyamlal', 'chotu', 'dev'].forEach(id => ok(TT.npcLines(id).lines.length, id + ' has dialogue'));

// helper: run a dialogue to its end through the real advance() (finish typing, then next line)
function finishDialogue() { let n = 0; while (TT.dlg() && n++ < 60) TT.advance(); ok(!TT.dlg(), 'dialogue closed'); }
function talk(id) { const r = TT.npcLines(id); TT.openDialogue(r.lines, r.nm, r.advance ? () => TT.completeStage() : null, slots[id]); ok(P2.locked, 'player locked in dialogue'); return r; }
function collect(ids) { ids.forEach(i => { TT.syncItems(); ok(TT.items[i], 'item spawned: ' + i); TT.pickItem(i); finishDialogue(); }); }

ok(S.qi === 0 && TT.objectiveText().indexOf('Raghunath') >= 0, 'starts with Raghunath');
// locked NPCs only give "not yet" lines
ok(TT.npcLines('kamla').lines === C.quests[1].locked, 'Kamla locked at start');
// typing effect: first advance only completes the text
TT.openDialogue(['abcdef'], 'X', null); P2.update(0.05, { x: 0, z: 0 }); ok(TT.ui().text.textContent.length < 6 && TT.ui().text.textContent.length > 0, 'typing effect partial'); TT.advance(); ok(TT.ui().text.textContent === 'abcdef', 'tap finishes typing'); TT.advance(); ok(!TT.dlg() && !P2.locked, 'closes + unlocks');

// 1 Raghunath
talk('raghunath'); finishDialogue(); ok(S.qi === 0 && S.st === 1, 'toolbox stage'); collect(['toolbox']); ok(S.st === 2, 'return stage');
ok(TT.npcLines('raghunath').advance, 'Raghunath wants the toolbox back'); talk('raghunath'); finishDialogue(); ok(S.qi === 1, 'Kamla unlocked');
// 2 Kamla: needs ALL 3 letters
talk('kamla'); finishDialogue(); TT.syncItems(); ok(Object.keys(TT.items).length === 3, '3 letters spawned');
collect(['letter1', 'letter2']); ok(S.st === 1 && TT.objectiveText().indexOf('(2/3)') > 0, 'counter 2/3'); collect(['letter3']); ok(S.st === 2, 'letters done');
talk('kamla'); finishDialogue(); ok(S.qi === 2, 'Arvind unlocked');
// 3 Arvind
talk('arvind'); finishDialogue(); collect(['register']); talk('arvind'); finishDialogue(); ok(S.qi === 3, 'Shyamlal unlocked');
// 4 Shyamlal: lantern -> tower reach -> talk
talk('shyamlal'); finishDialogue(); collect(['lantern']); ok(C.quests[3].stages[S.st].type === 'reach', 'tower stage');
sandbox.P1.gy = 0; ok(!TT.reached('tower', { x: 13, z: 67 }), 'tower not reached on the ground'); sandbox.P1.gy = 8.8; ok(!TT.reached('tower', { x: 30, z: 67 }), 'far from tower'); ok(TT.reached('tower', { x: 13, z: 66 }), 'tower reached on deck');
P2.update(0.3, { x: 13, z: 66 }); ok(C.quests[3].stages[S.st].type === 'talk', 'tower completes stage'); sandbox.P1.gy = 0;
talk('shyamlal'); finishDialogue(); ok(S.qi === 4, 'Chotu unlocked');
// 5 Chotu
talk('chotu'); finishDialogue(); collect(['drawing']); talk('chotu'); finishDialogue(); ok(S.qi === 5, 'Graveyard mission active');
// 6 Graveyard (no NPC)
ok(C.quests[5].stages[0].type === 'reach' && !TT.reached('graveyard', { x: -10, z: 38 }), 'outside the fence'); ok(TT.reached('graveyard', { x: -26, z: 38 }), 'inside the fence');
P2.update(0.3, { x: -26, z: 38 }); ok(S.st === 1, 'entered graveyard'); collect(['hidden_grave']); ok(S.st === 2, 'grave found'); collect(['name_stone1', 'name_stone2']); ok(S.qi === 5, 'needs all 3 name stones'); collect(['name_stone3']);
finishDialogue(); ok(S.qi === 6, 'Dev unlocked'); ok(S.names.length >= 6, 'names collected: ' + S.names.length);
// 7 Dev
talk('dev'); finishDialogue(); collect(['diary1', 'diary2', 'diary3']); ok(C.quests[6].stages[S.st].items[0] === 'mohan_coat', 'investigate stage'); collect(['mohan_coat']); talk('dev'); finishDialogue();
ok(S.qi === 7 && TT.objectiveText() === '', 'ALL 7 missions complete');
ok(TT.npcLines('raghunath').lines === C.quests[0].done, 'done NPCs repeat their after-lines');
// save / load round trip
const saved = sandbox.localStorage.getItem('lv_p2_v1'); ok(saved && JSON.parse(saved).qi === 7, 'progress saved');
S.qi = 0; TT.load(); ok(S.qi === 7, 'progress restored');
// out of order: an NPC for a later mission can never advance the chain
S.qi = 2; S.st = 0; ok(!TT.npcLines('dev').advance && !TT.npcLines('chotu').advance, 'later NPCs cannot skip ahead'); ok(!TT.npcLines('raghunath').advance, 'finished NPC does not re-advance');
// no forbidden systems
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'p2-story.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'js', 'p2-config.js'), 'utf8');
ok(!/\bAudio\b|speechSynthesis|new Audio|AudioContext/.test(src), 'no audio in Part 2'); ok(!/inventory|tunnel/i.test(src.replace(/no inventory|NO audio|Not in this part[^\n]*|tunnel, inventory[^\n]*/gi, '')), 'no inventory/tunnel code');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);

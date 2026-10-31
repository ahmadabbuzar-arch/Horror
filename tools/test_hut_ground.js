// node tools/test_hut_ground.js — runs the REAL js/p1-ground.js on the REAL cabin vertex heights (exported from hut.glb by numpy)
global.window = {}; require('../js/p1-ground.js'); const P1 = window.P1;
const d = require('./hut_cabin_world_y.json');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + m); };
const lowest = Math.min.apply(null, d.groups.map(g => g.reduce((a, b) => Math.min(a, b), Infinity)));
const base = P1.baseLevel(d.groups);
console.log('cabin lowest vertex (old pivot):', lowest.toFixed(4), ' robust base level (new):', base.toFixed(4));
const S = 3.6, sink = 0.03, ground = 0;
const scaled = (y, pivot) => pivot + (y - pivot) * S;
// OLD: scale about the lowest vertex, no shift
const oldBaseAfter = scaled(base, lowest);
// NEW: scale about the base level, then shift so base = ground - sink
const shift = P1.settleShift(base, ground, sink), newBaseAfter = scaled(base, base) + shift;
console.log('OLD wall-base height above terrain after 3.6x scale: ' + oldBaseAfter.toFixed(3) + ' m  (the visible gap)');
console.log('NEW wall-base height above terrain: ' + newBaseAfter.toFixed(3) + ' m (target ' + (ground - sink) + ')');
ok(oldBaseAfter > 0.25 && oldBaseAfter < 0.45, 'old placement really floated ~0.34 m (matches the recording)');
ok(Math.abs(newBaseAfter - (ground - sink)) < 1e-9, 'new placement puts the base plane exactly at ground - sink');
ok(Math.abs(base - lowest) > 0.1, 'robust base differs from the buried outlier (' + (base - lowest).toFixed(3) + ' m above it)');
// every mesh that is part of the base cluster must end up within a few cm of the terrain
const meshFloor = d.groups.map(g => Math.min.apply(null, g));
const wallFloors = d.names.map((n, i) => ({ n, f: meshFloor[i] })).filter(o => Math.abs(o.f - base) < 0.03);
wallFloors.forEach(o => ok(Math.abs(scaled(o.f, base) + shift - (ground - sink)) < 0.06, o.n + ' lowest point ends ' + (scaled(o.f, base) + shift).toFixed(3) + ' m vs terrain 0 (embedded <= 6 cm)'));
const buried = d.names.map((n, i) => ({ n, f: meshFloor[i] })).filter(o => o.f < base - 0.03);
buried.forEach(o => console.log('  info  ' + o.n + ' lowest vertex ends ' + (scaled(o.f, base) + shift).toFixed(3) + ' m below/above terrain (buried part, hidden under the ground)'));
const deepest = Math.min.apply(null, d.groups.map(g => scaled(g.reduce((a, b) => Math.min(a, b), Infinity), base) + shift));
ok(deepest > -0.75, 'deepest buried vertex is ' + deepest.toFixed(3) + ' m below terrain (no big hole / nothing pushed far into the ground)');
// robustness
ok(P1.baseLevel([[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]) === 0, 'single flat mesh -> its own floor');
ok(P1.baseLevel([]) === 0, 'empty -> 0');
const flat = Array.from({ length: 50 }, () => 1);
ok(Math.abs(P1.baseLevel([flat, flat, flat, flat.concat([-5])]) - 1) < 1e-9, 'one stray low vertex is ignored');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);

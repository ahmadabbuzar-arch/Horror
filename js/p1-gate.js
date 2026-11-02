/* THE LAST VILLAGE — r30: graveyard boundary (iron fence + stone pillars on ALL FOUR sides) and an OPENABLE two-leaf gate on the east side (village side).
 * Everything is built from code (no extra GLB): InstancedMesh for the bars (a handful of draw calls), simple wall collision, gate uses the game's own
 * door system (button / E key) via world.addDoor — same {cur,t,x,z,piv:[pivot]} object the hut doors use. Wrapped by p1-main's guard.
 * Tune everything in CFG below. NOT tested in a browser (no Three.js in the build sandbox). */
(function () {
  'use strict';
  const P1 = window.P1, T = THREE;

  const CFG = {
    cx: -26, cz: 38,          // graveyard map centre (same as `graveyard` in p1-config.js)
    half: 11.45,              // fence is a square of +-half metres around the centre (terrain edge is 11.63, tombs reach 11.05)
    gateZ: 2.0,               // gate centre along the EAST side (local z; 0 = centre of the map). Chosen where no tomb is close to the fence.
    gateHalf: 1.5,            // gate post centres are gateZ +- gateHalf  -> inner opening 2.5 m
    height: 1.75,             // fence bar height (m)
    pillarH: 2.05, gatePillarH: 2.45,
    maxSeg: 4.2,              // max distance between two pillars
    openDeg: 100,             // how far the gate leaves swing (inwards, into the graveyard)
    playerR: 0.38,            // body radius for the fence collision
    showRadius: 140           // fence is hidden further away than this (fog hides it anyway)
  };

  let holder = null, gate = null, boxes = [], gateBox = null, world = null;

  /* ---------- materials ---------- */
  function stoneTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); g.fillStyle = '#6b6a66'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1400; i++) {
      const v = 70 + Math.random() * 70 | 0; g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v - 4) + ',0.45)';
      g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 4, 1 + Math.random() * 3);
    }
    g.strokeStyle = 'rgba(25,25,22,.55)'; g.lineWidth = 2;               // mortar lines (stone blocks)
    for (let y = 0; y <= 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
    for (let r = 0; r < 4; r++) for (let x = (r % 2) * 32; x < 128; x += 64) { g.beginPath(); g.moveTo(x, r * 32); g.lineTo(x, r * 32 + 32); g.stroke(); }
    for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(38,70,34,' + (0.12 + Math.random() * 0.25) + ')'; g.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 7, 2 + Math.random() * 5); }   // moss
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 2; return t;
  }
  function mats() {
    const tex = stoneTex();
    return {
      stone: new T.MeshStandardMaterial({ map: tex, color: 0x9a9a94, roughness: 1, metalness: 0 }),
      iron: new T.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.85, metalness: 0 }),   // metalness 0: without an environment map metal renders black in three.js
      rust: new T.MeshStandardMaterial({ color: 0x4a3426, roughness: 1, metalness: 0 })
    };
  }

  /* ---------- helpers ---------- */
  function box(w, h, d, m, x, y, z, parent) { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; }

  function pillar(x, z, h, M, parent) {
    const g = new T.Group(); g.position.set(x, 0, z);
    box(0.62, 0.35, 0.62, M.stone, 0, 0.0, 0, g);                       // plinth (goes 0.17 m below ground, hides terrain bumps)
    const bodyH = h - 0.5;
    box(0.46, bodyH, 0.46, M.stone, 0, 0.17 + bodyH / 2 - 0.02, 0, g);  // shaft
    box(0.6, 0.12, 0.6, M.stone, 0, h - 0.30, 0, g);                    // cap slab
    const top = new T.Mesh(new T.ConeGeometry(0.34, 0.26, 4), M.stone); // pyramid top
    top.position.set(0, h - 0.11, 0); top.rotation.y = Math.PI / 4; g.add(top);
    parent.add(g);
  }

  // one fence run between two pillar centres (a -> b, axis-aligned). Collects bar positions for instancing.
  function run(a, b, M, parent, bars, tips) {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
    const inner = len - 0.5;                         // minus the two pillar half-widths
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, alongX = Math.abs(dx) > Math.abs(dz);
    // rails (top, bottom, and a low one near the ground)
    [[CFG.height - 0.12, 0.05], [0.28, 0.05], [0.9, 0.035]].forEach(function (r) {
      const w = alongX ? inner : r[1], d = alongX ? r[1] : inner;
      box(w, r[1], d, M.iron, mx, r[0], mz, parent);
    });
    const n = Math.floor(inner / 0.15);
    for (let i = 0; i <= n; i++) {
      const t = -inner / 2 + inner * i / n;
      bars.push(mx + ux * t, mz + uz * t);
    }
  }

  function pillarsAlong(a, b) {                       // pillar centres from a to b (inclusive), spaced <= maxSeg
    const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / CFG.maxSeg)), out = [];
    for (let i = 0; i <= n; i++) out.push({ x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n });
    return out;
  }

  /* ---------- the gate leaf (hinge at local origin, extends along +z * s) ---------- */
  function leaf(s, W, M) {
    const g = new T.Group(), H = CFG.height + 0.05, yTop = H - 0.1;
    box(0.07, H, 0.07, M.iron, 0, H / 2, 0, g);                         // hinge stile
    box(0.07, H, 0.07, M.iron, 0, H / 2, s * W, g);                     // latch stile
    [yTop, 0.9, 0.22].forEach(function (y) { box(0.05, 0.06, W, M.iron, 0, y, s * W / 2, g); });
    const nb = Math.round(W / 0.13);
    for (let i = 1; i < nb; i++) {
      const z = s * W * i / nb; box(0.025, H - 0.1, 0.025, M.iron, 0, (H - 0.1) / 2 + 0.05, z, g);
      const tip = new T.Mesh(new T.ConeGeometry(0.03, 0.12, 4), M.iron); tip.position.set(0, H + 0.0, z); g.add(tip);
    }
    const ring = new T.Mesh(new T.TorusGeometry(0.2, 0.018, 6, 20), M.iron);   // decorative ring in the middle of the leaf
    ring.rotation.y = Math.PI / 2; ring.position.set(0, 1.28, s * W / 2); g.add(ring);
    const ring2 = new T.Mesh(new T.TorusGeometry(0.1, 0.014, 6, 16), M.rust); ring2.rotation.y = Math.PI / 2; ring2.position.copy(ring.position); g.add(ring2);
    return g;
  }

  /* ---------- build ---------- */
  P1.startGate = function (w) {
    world = w;
    const M = mats(), H = CFG.half;
    holder = new T.Group(); holder.position.set(CFG.cx, 0, CFG.cz);
    const bars = [], tips = [];                                           // flat lists of (x,z) in local metres, instanced below
    const gz0 = CFG.gateZ - CFG.gateHalf, gz1 = CFG.gateZ + CFG.gateHalf;

    // corner pillars + the four sides. East side (x = +H) is split by the gate.
    const sides = [
      [{ x: -H, z: -H }, { x: H, z: -H }],            // north (z -)
      [{ x: -H, z: H }, { x: H, z: H }],              // south (z +)
      [{ x: -H, z: -H }, { x: -H, z: H }],            // west  (x -)
      [{ x: H, z: -H }, { x: H, z: gz0 }],            // east, south of the gate (z -H .. gz0)
      [{ x: H, z: gz1 }, { x: H, z: H }]              // east, north of the gate (gz1 .. H)
    ];
    const seen = {};
    sides.forEach(function (sd) {
      const ps = pillarsAlong(sd[0], sd[1]);
      ps.forEach(function (p, i) {
        const key = p.x.toFixed(2) + ',' + p.z.toFixed(2);
        if (!seen[key]) { seen[key] = 1; const gatePost = Math.abs(p.x - H) < 0.01 && (Math.abs(p.z - gz0) < 0.01 || Math.abs(p.z - gz1) < 0.01); pillar(p.x, p.z, gatePost ? CFG.gatePillarH : CFG.pillarH, M, holder); }
        if (i > 0) run(ps[i - 1], p, M, holder, bars, tips);
      });
    });

    // bars: ONE InstancedMesh (+ one for the spear tips)
    const bg = new T.CylinderGeometry(0.013, 0.013, CFG.height, 5); bg.translate(0, CFG.height / 2, 0);
    const tg = new T.ConeGeometry(0.03, 0.12, 4); tg.translate(0, CFG.height + 0.04, 0);
    const n = bars.length / 2, im = new T.InstancedMesh(bg, M.iron, n), it = new T.InstancedMesh(tg, M.iron, n), m4 = new T.Matrix4();
    for (let i = 0; i < n; i++) { m4.makeTranslation(bars[i * 2], 0, bars[i * 2 + 1]); im.setMatrixAt(i, m4); it.setMatrixAt(i, m4); }
    im.instanceMatrix.needsUpdate = it.instanceMatrix.needsUpdate = true; im.frustumCulled = it.frustumCulled = false;
    holder.add(im); holder.add(it);

    // gate: two leaves, hinged on the two tall gate pillars, swinging INTO the graveyard
    const inner = CFG.gateHalf - 0.25, W = inner;                         // each leaf covers from its post face to the centre line
    const pvA = new T.Group(), pvB = new T.Group();
    pvA.position.set(H, 0, gz0 + 0.25); pvA.add(leaf(+1, W - 0.02, M));   // south leaf, extends +z
    pvB.position.set(H, 0, gz1 - 0.25); pvB.add(leaf(-1, W - 0.02, M));   // north leaf, extends -z
    const th = CFG.openDeg * Math.PI / 180;
    pvA.userData.th = -th; pvB.userData.th = +th;                         // rotation.y = cur * th  (cur 0 -> 1)
    holder.add(pvA); holder.add(pvB);
    box(0.05, 0.05, 0.12, M.iron, H, 0.05, CFG.gateZ, holder);            // tiny stop bar on the ground (looks like a latch plate)

    world.scene.add(holder); holder.updateMatrixWorld(true);

    // collision boxes (WORLD coordinates): {x0,x1,z0,z1}; thin walls, expanded by the player radius when tested
    const t = 0.12, X0 = CFG.cx - H, X1 = CFG.cx + H, Z0 = CFG.cz - H, Z1 = CFG.cz + H, gw0 = CFG.cz + gz0, gw1 = CFG.cz + gz1;
    boxes = [
      { x0: X0 - t, x1: X1 + t, z0: Z0 - t, z1: Z0 + t },     // north
      { x0: X0 - t, x1: X1 + t, z0: Z1 - t, z1: Z1 + t },     // south
      { x0: X0 - t, x1: X0 + t, z0: Z0 - t, z1: Z1 + t },     // west
      { x0: X1 - t, x1: X1 + t, z0: Z0 - t, z1: gw0 },        // east (south part)
      { x0: X1 - t, x1: X1 + t, z0: gw1, z1: Z1 + t },        // east (north part)
      { x0: X1 - 0.3, x1: X1 + 0.3, z0: gw0 - 0.3, z1: gw0 + 0.3 }, { x0: X1 - 0.3, x1: X1 + 0.3, z0: gw1 - 0.3, z1: gw1 + 0.3 }   // gate pillars
    ];
    gateBox = { x0: X1 - t, x1: X1 + t, z0: gw0, z1: gw1 };  // blocks the opening while the gate is (mostly) closed

    // hook into the game's door system (button 🚪 / E key); `label` is read by index.html showDoor()
    gate = { cur: 0, t: 0, x: X1, z: CFG.cz + CFG.gateZ, piv: [pvA, pvB], label: ['⛩️ Gate kholo', '⛩️ Gate band karo'] };
    w.addDoor(gate);
    P1.gate = { cfg: CFG, door: gate, holder: holder };
    P1.status.gate = 'ready (' + n + ' bars)';
    P1.log('graveyard fence + gate built: ' + n + ' bars, ' + boxes.length + ' wall boxes');
  };

  P1.updateGate = function (dt, pos) {
    if (!holder) return;
    holder.visible = Math.hypot(pos.x - CFG.cx, pos.z - CFG.cz) < CFG.showRadius;
  };

  P1.collideGate = function (pos, rad) {
    if (!holder || !holder.visible) return;
    if (Math.abs(pos.x - CFG.cx) > CFG.half + 3 || Math.abs(pos.z - CFG.cz) > CFG.half + 3) return;   // far from the fence: nothing to do
    if ((P1.gy || 0) > 1) return;
    const r = rad || CFG.playerR, list = gate && gate.cur < 0.55 ? boxes.concat([gateBox]) : boxes;
    for (let i = 0; i < list.length; i++) {
      const b = list[i], x0 = b.x0 - r, x1 = b.x1 + r, z0 = b.z0 - r, z1 = b.z1 + r;
      if (pos.x > x0 && pos.x < x1 && pos.z > z0 && pos.z < z1) {
        const dl = pos.x - x0, dr = x1 - pos.x, dn = pos.z - z0, ds = z1 - pos.z, m = Math.min(dl, dr, dn, ds);
        if (m === dl) pos.x = x0; else if (m === dr) pos.x = x1; else if (m === dn) pos.z = z0; else pos.z = z1;
      }
    }
  };
})();

/* THE LAST VILLAGE — Phase 1 village props (r5): extra buildings/wrecks around the original village, distance-streamed,
 * with simple collision, plus extra forest cloned from the hut model's own trees. Everything is wrapped by p1-main's guard. */
(function () {
  'use strict';
  const P1 = window.P1, T = THREE;
  const entries = [];
  let world = null, C = null, busy = false;
  const rc = new T.Raycaster();
  const DEG = Math.PI / 180;
  const DIRS = [];
  for (let i = 0; i < 8; i++) DIRS.push(new T.Vector3(Math.sin(i * Math.PI / 4), 0, Math.cos(i * Math.PI / 4)));

  function mkEntry(c) {
    return { c: c, id: c.id, status: 'idle', holder: null, meshes: [], floors: [], box: null, loadedAt: 0 };
  }

  /* ---------- build one loaded prop ---------- */
  function build(e, gltf) {
    const c = e.c, model = gltf.scene;
    // materials: darken baked-light scans, hide fully transparent helper meshes
    model.traverse(function (o) {
      if (!o.isMesh) return;
      const ms = [].concat(o.material);
      let hide = true;
      ms.forEach(function (m) {
        if (!m) return;
        m.side = T.DoubleSide;     // glTF default is single-sided: scans / interiors lose walls and ground when seen from behind (same fix the game applies to the hut)
        m.needsUpdate = true;
        if (m.color && c.tint != null) m.color.multiplyScalar(c.tint);
        if (m.map && m.map.anisotropy !== undefined) m.map.anisotropy = 2;
        if (!(m.transparent && m.opacity < 0.05)) hide = false;
      });
      if (hide) o.visible = false;
    });
    const box0 = P1.measure(model), sz = box0.getSize(new T.Vector3());
    const s = c.lengthM ? c.lengthM / Math.max(sz.x, sz.z) : (c.scale || 1);
    const inner = new T.Group(); inner.add(model);
    // baseY (model units) = level that must touch the ground; default = lowest vertex. The farmstead scan is a terrain chunk whose lowest point is 1.6 m below the house floor.
    model.position.set(-(box0.min.x + box0.max.x) / 2, -(c.baseY != null ? c.baseY : box0.min.y), -(box0.min.z + box0.max.z) / 2);
    inner.scale.setScalar(s);
    if (c.tilt) { inner.rotation.x = c.tilt[0] * DEG; inner.rotation.z = c.tilt[1] * DEG; }
    const holder = new T.Group(); holder.add(inner);
    holder.position.set(c.x, -(c.sink || 0), c.z); holder.rotation.y = (c.yaw || 0) * DEG;
    world.scene.add(holder); holder.updateMatrixWorld(true);
    e.holder = holder; e.scale = s;
    e.meshes = []; e.floors = [];
    const wb = new T.Box3(), tmp = new T.Box3();
    model.traverse(function (o) {
      if (!o.isMesh || !o.visible) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      wb.union(tmp);
      if (c.climb) e.floors.push(o);     // r8: stairs / platforms the player can stand on (see P1.propFloors)
      if (c.walls) {
        const d = tmp.getSize(new T.Vector3());
        if (d.y < 1.2 && Math.max(d.x, d.z) > 6) return;     // flat ground-like mesh: not a wall
        e.meshes.push(o);
      }
    });
    e.box = wb.clone().expandByScalar(1.2);
    e.info = { height: +(wb.max.y - wb.min.y).toFixed(1), scale: +s.toFixed(4), x: c.x, z: c.z, meshes: e.meshes.length };
    P1.info['prop:' + e.id] = { height: e.info.height, scale: e.info.scale, spawn: { x: c.x, z: c.z } };
  }

  function unload(e, why) {
    if (e.holder) { world.scene.remove(e.holder); e.holder = null; }   // geometry/materials are freed by the asset manager
    P1.assets.release(e.c.url);
    e.meshes = []; e.floors = []; e.box = null; e.status = 'idle';
    P1.status['prop:' + e.id] = 'idle (' + why + ')';
  }

  function load(e) {
    e.status = 'loading'; busy = true; P1.status['prop:' + e.id] = 'loading';
    P1.assets.acquire(e.c.url).then(function (g) {
      busy = false;
      if (e.status !== 'loading') { P1.assets.release(e.c.url); return; }
      try { build(e, g); e.status = 'ready'; P1.status['prop:' + e.id] = 'ready'; }
      catch (err) { e.status = 'error'; P1.status['prop:' + e.id] = 'error: ' + err.message; P1.warn('prop ' + e.id + ' build failed', err); P1.assets.release(e.c.url); }
    }).catch(function (err) {
      busy = false; e.status = 'error'; P1.status['prop:' + e.id] = 'error: ' + (err && err.message); P1.warn('prop ' + e.id + ' load failed', err);
    });
  }

  /* ---------- forest: clones of the hut model's own trees ---------- */
  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function scatterTrees() {
    const F = C.forest; if (!F || !F.enabled) return;
    const root = world.root && world.root(); if (!root) { P1.warn('forest: no root'); return; }
    root.updateMatrixWorld(true);
    const src = [];
    root.traverse(function (o) {
      if (!/^Arbol/i.test(o.name || '')) return;
      let hasMesh = false; o.traverse(function (m) { if (m.isMesh) hasMesh = true; });
      if (!hasMesh) return;
      const b = new T.Box3().setFromObject(o), sz = b.getSize(new T.Vector3());
      if (sz.y < 5 || sz.x > 40) return;
      let trunk = null; o.traverse(function (m) { if (!trunk && m.isMesh) trunk = m; });
      const tb = new T.Box3().setFromObject(trunk), tc = tb.getCenter(new T.Vector3());
      src.push({ o: o, cx: tc.x, cz: tc.z, r: Math.max(0.45, Math.min(1.4, 0.35 * Math.max(tb.getSize(new T.Vector3()).x, tb.getSize(new T.Vector3()).z))), ymin: b.min.y });
    });
    if (!src.length) { P1.warn('forest: no tree nodes found (name /^Arbol/)'); return; }
    const R = rng(F.seed), placed = [];
    const taken = (world.trees || []).map(function (t) { return { x: t.x, z: t.z }; });
    const circles = entries.map(function (e) { return { x: e.c.x, z: e.c.z, r: (e.c.footprint || 6) + F.propMargin }; });
    const inRect = function (x, z, r) { return x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]; };
    function ok(x, z, interior) {
      if (!interior && inRect(x, z, F.open)) return false;
      for (const k of (F.keepOut || [])) if (inRect(x, z, k)) return false;
      if (world.cc && Math.hypot(x - world.cc.x, z - world.cc.z) < F.hutRadius) return false;
      for (const c of circles) if (Math.hypot(x - c.x, z - c.z) < c.r) return false;
      for (const p of placed) if (Math.hypot(x - p.x, z - p.z) < F.minGap) return false;
      for (const p of taken) if (Math.hypot(x - p.x, z - p.z) < 2.5) return false;
      return true;
    }
    function plant(x, z) {
      const s = src[Math.floor(R() * src.length)], sc = F.scale[0] + R() * (F.scale[1] - F.scale[0]);
      const c = s.o.clone(true); c.matrixAutoUpdate = false;
      c.matrix.copy(s.o.matrixWorld); c.matrix.premultiply(new T.Matrix4().makeTranslation(-s.cx, -s.ymin * 0, -s.cz));
      const w = new T.Group(); w.position.set(x, 0, z); w.rotation.y = R() * Math.PI * 2; w.scale.setScalar(sc); w.add(c);
      world.scene.add(w); w.updateMatrixWorld(true);
      placed.push({ x: x, z: z });
      if (world.trees) world.trees.push({ g: w, x: x, z: z, r: s.r * sc });
    }
    let n = 0, tries = 0;
    while (n < F.count && tries++ < F.count * 60) {
      const x = F.area[0] + R() * (F.area[2] - F.area[0]), z = F.area[1] + R() * (F.area[3] - F.area[1]);
      if (ok(x, z, false)) { plant(x, z); n++; }
    }
    let m = 0; tries = 0;
    while (m < (F.interior || 0) && tries++ < 600) {
      const x = F.open[0] + R() * (F.open[2] - F.open[0]), z = F.open[1] + R() * (F.open[3] - F.open[1]);
      if (ok(x, z, true) && Math.hypot(x - 3, 0) > 0 && !(x > -1 && x < 7)) { plant(x, z); m++; }   // keep the road strip clear
    }
    P1.info.forest = { height: 0, scale: 1, sources: src.length, planted: n + m };
    P1.status.forest = 'ready (' + (n + m) + ' trees from ' + src.length + ' sources)';
    P1.log('forest: ' + (n + m) + ' trees planted from ' + src.length + ' source trees');
  }

  /* ---------- public ---------- */
  P1.startProps = function (w) {
    world = w; C = P1.config.village; if (!C) return;
    (C.props || []).concat(C.wrecks || []).forEach(function (c) { entries.push(mkEntry(c)); P1.status['prop:' + c.id] = 'idle'; });
    try { scatterTrees(); } catch (e) { P1.warn('forest failed', e); }
    P1.props = { list: function () { return entries; } };
  };

  P1.updateProps = function (dt, pos) {
    if (!C) return;
    let nearest = null, nd = 1e9;
    for (const e of entries) {
      const d = Math.hypot(pos.x - e.c.x, pos.z - e.c.z);
      if (P1.info['prop:' + e.id]) P1.info['prop:' + e.id].dist = Math.round(d);
      if (e.status === 'ready' && d > C.unloadRadius) unload(e, 'far');
      else if (e.status === 'idle' && d < C.loadRadius && d < nd) { nd = d; nearest = e; }
    }
    if (nearest && !busy) load(nearest);
  };

  /* r8: meshes the player may stand on (tower stairs + platform). index.html adds them to its downward floor ray. */
  P1.propFloors = function (pos) {
    const out = [];
    for (const e of entries) {
      if (e.status !== 'ready' || !e.holder || !e.floors || !e.floors.length || !e.box) continue;
      if (pos.x < e.box.min.x || pos.x > e.box.max.x || pos.z < e.box.min.z || pos.z > e.box.max.z) continue;
      for (const m of e.floors) out.push(m);
    }
    return out;
  };

  const _o = new T.Vector3();
  P1.collideProps = function (pos, rad) {
    if (!C) return;
    for (const e of entries) {
      if (e.status !== 'ready' || !e.holder) continue;
      const c = e.c, r = rad || 0.35, yaw = (c.yaw || 0) * DEG, cs = Math.cos(yaw), sn = Math.sin(yaw);
      if (Math.abs(pos.x - c.x) > 40 || Math.abs(pos.z - c.z) > 40) continue;
      // local frame of the prop (Ry(yaw): world = (lx*cs + lz*sn, -lx*sn + lz*cs))
      const dx = pos.x - c.x, dz = pos.z - c.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      let px = lx, pz = lz, hit = false;
      if (c.box) {
        const b = c.box, ex = b.hx + r, ez = b.hz + r, ax = lx - (b.cx || 0), az = lz - (b.cz || 0);
        if (Math.abs(ax) < ex && Math.abs(az) < ez) {
          if (ex - Math.abs(ax) < ez - Math.abs(az)) px = (b.cx || 0) + Math.sign(ax || 1) * ex; else pz = (b.cz || 0) + Math.sign(az || 1) * ez;
          hit = true;
        }
      }
      if (c.circles) for (const k of c.circles) {
        const ax = px - k.x, az = pz - k.z, d = Math.hypot(ax, az), m = k.r + r;
        if (d < m && d > 1e-4) { px = k.x + ax / d * m; pz = k.z + az / d * m; hit = true; }
      }
      if (hit) { pos.x = c.x + px * cs + pz * sn; pos.z = c.z - px * sn + pz * cs; }
      if (c.walls && e.meshes.length && e.box && e.box.containsPoint(_o.set(pos.x, 1, pos.z))) {
        const R = c.wallR || 0.5;   // r8: per-prop body radius for the wall rays
        const gy = P1.gy || 0;   // r8: rays start at the player's CURRENT floor height (on the tower stairs the old fixed 0.55 m / 1.3 m rays hit the next steps and blocked the climb)
        for (const y of [gy + 0.55, gy + 1.3]) for (const d of DIRS) {
          rc.set(_o.set(pos.x, y, pos.z), d); rc.far = R;
          const h = rc.intersectObjects(e.meshes, false)[0];
          if (h) { const push = R - h.distance; pos.x -= d.x * push; pos.z -= d.z * push; }
        }
      }
    }
  };
})();

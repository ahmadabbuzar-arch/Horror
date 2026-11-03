/* THE LAST VILLAGE — r31: "DR. ARVIND CLINIC"
 * The two-storey wooden house in the middle of the village road (village.glb: 3rd house from the first, the one with the veranda,
 * 1 door + 1 lower window on the road side) becomes an old abandoned clinic:
 *   1. SIGN BOARD on the veranda roof: "DR. ARVIND CLINIC" + cross. Every letter is its own light: some stay lit, some flicker (lop-jhup), two are nearly dead.
 *   2. LIGHTS: green sign glow on the road (point light, follows the flicker), a flickering fluorescent tube inside + one broken tube, matching room light.
 *   3. HOSPITAL PROPS inside (assets/props/clinic/*.glb from the Abandoned Hospital pack): desk + chair, exam bed, surgical lamp, trolley with instruments,
 *      medicine cabinet, filing cabinet, sink, clock, visitor chair, bin ... (streamed: loaded when the player is within loadRadius, freed beyond unloadRadius).
 *   4. DR. ARVIND is moved inside the clinic (P1.config.npcs.arvind) and faces the door. Kamla Devi (who used to stand in front of this house) is in p1-config.js.
 * r32: the clinic house was made 1.3x bigger IN PLAN (x and z; height unchanged) by editing its 14 nodes in assets/models/village.glb (see docs/CHANGES_r32.md); every position below is the r31 one moved into the bigger room.
 * Everything is attached to the village group (village-local coordinates, metres) so it can never drift from the house.
 * Village-local -> world:  world.x = local.x + G.position.x,  world.z = local.z + G.position.z,  floor y = 0 (local).
 * NOT tested in a browser (no Three.js in the build sandbox) — all tunables are in CFG.  Wrapped by p1-main's guard. */
(function () {
  'use strict';
  const P1 = window.P1, T = THREE, DEG = Math.PI / 180;

  /* ===================================================================================================
   * CFG — village-local metres.  House (village.glb, r32 = 1.3x bigger in plan): interior x -8.30..-4.165, z 3.43..9.42 (4.1 x 6.0 m, was 3.2 x 4.6), ceiling 1.89 (LOW: nothing taller than 1.85),
   * road side = +X (east wall at x = -4.1, door at z 3.93..4.96, lower window z 7.43..8.46), stairs along the west wall (x < -7.2, z 3.35..6.35) -> keep that corner free.
   * Item frame: x,z = footprint centre, y = height above floor, yaw in degrees (0 = front faces +Z, 90 = front faces +X (road), 180 = faces -Z, 270 = faces -X).
   * kids = small props placed in the PARENT's own frame (x/z = along its width/depth, y = height above the floor).
   * ================================================================================================= */
  const CFG = {
    loadRadius: 45, unloadRadius: 75, animRadius: 70,
    door: { x: -4.10, z: 4.445 },              // clinic door (village-local) — Dr. Arvind looks at it   (r32: house is 1.3x bigger in plan)
    doctor: { x: -6.2, z: 5.5 },               // where Dr. Arvind stands
    playerR: 0.30,                             // body radius for the furniture collision

    sign: {
      x: -2.32, y: 2.34, z: 6.425,             // centre of the board (stands on the veranda roof, roof top = 2.0; r32: roof front edge is now x = -2.11)
      w: 4.3, h: 0.74, text: 'DR. ARVIND CLINIC',
      // one code per visible letter (spaces skipped) in order  D R . A R V I N D | C L I N I C
      //   o = steady lit     f = flicker (lop-jhup: stable, then a burst of stutters, sometimes a short blackout)     w = weak / nearly dead (mostly dark, blinks now and then)
      modes: ['o', 'f', 'o', 'o', 'o', 'f', 'o', 'w', 'o', 'o', 'f', 'o', 'o', 'w', 'o'],
      cross: 'o',
      color: 0x8dffd2,                         // sickly green-white neon
      lightColor: 0x6dffb8, lightI: 1.0, lightDist: 8
    },
    room: { color: 0xc9ecdc, intensity: 1.15, dist: 7.0, x: -6.23, y: 1.62, z: 7.0 },   // interior light (follows the main tube)

    items: [
      // ---- doctor's corner (west wall, north) ----
      { id: 'desk', url: 'assets/props/clinic/office_desk.glb', x: -7.90, z: 8.06, yaw: 90, col: 0.02, kids: [
        { url: 'assets/props/clinic/telephone.glb', x: 0.42, y: 0.79, z: 0.02, yaw: -25 },
        { url: 'assets/props/clinic/clipboard.glb', x: -0.12, y: 0.79, z: 0.10, yaw: 12 },
        { url: 'assets/props/clinic/medical_folder.glb', x: -0.50, y: 0.79, z: -0.06, yaw: -8 },
        { url: 'assets/props/clinic/stethoscope.glb', x: 0.12, y: 0.79, z: -0.14, yaw: 70, fit: 0.30 },
        { url: 'assets/props/clinic/medicine_bottle.glb', x: 0.63, y: 0.79, z: 0.18, yaw: 0 }
      ] },
      { id: 'chair', url: 'assets/props/clinic/swivel_chair.glb', x: -7.04, z: 8.13, yaw: 250, col: 0.06 },
      // ---- north wall (west -> east) ----
      { id: 'medcab', url: 'assets/props/clinic/medicine_cabinet.glb', x: -7.92, z: 9.18, yaw: 180, col: 0.02 },
      { id: 'filing', url: 'assets/props/clinic/filing_cabinet.glb', x: -7.27, z: 9.09, yaw: 180, col: 0.02, kids: [
        { url: 'assets/props/clinic/first_aid_box.glb', x: -0.04, y: 1.32, z: 0.0, yaw: 14 },
        { url: 'assets/props/clinic/bandage_roll.glb', x: 0.14, y: 1.32, z: -0.08, yaw: 40 }
      ] },
      { id: 'sink', url: 'assets/props/clinic/wall_sink.glb', x: -6.62, z: 9.15, yaw: 180, col: 0.02 },
      { id: 'clock', url: 'assets/props/clinic/wall_clock.glb', x: -5.50, y: 1.20, z: 9.40, yaw: 180, scale: 0.6 },
      { id: 'bin', url: 'assets/props/clinic/trash_bin.glb', x: -4.44, z: 9.19, yaw: 180, col: 0.03 },
      // ---- treatment area (east side, under the window) ----
      { id: 'bed', url: 'assets/props/clinic/exam_bed.glb', x: -4.60, z: 7.55, yaw: 0, col: 0.02 },
      { id: 'lamp', url: 'assets/props/clinic/surgical_lamp.glb', x: -5.40, z: 7.93, yaw: 0, scale: 0.88, col: 0.10 },
      { id: 'trolley', url: 'assets/props/clinic/surgical_trolley.glb', x: -5.52, z: 6.95, yaw: 90, col: 0.02, kids: [
        { url: 'assets/props/clinic/instrument_tray.glb', x: 0.0, y: 0.98, z: 0.0, yaw: 0 },
        { url: 'assets/props/clinic/kidney_dish.glb', x: -0.14, y: 1.04, z: 0.0, yaw: 90 },
        { url: 'assets/props/clinic/scalpel.glb', x: 0.08, y: 1.04, z: 0.04, yaw: 30 },
        { url: 'assets/props/clinic/forceps.glb', x: 0.14, y: 1.04, z: -0.06, yaw: -50 },
        { url: 'assets/props/clinic/syringe.glb', x: -0.02, y: 1.04, z: -0.09, yaw: 80 }
      ] },
      // ---- waiting chair next to the door ----
      { id: 'vchair', url: 'assets/props/clinic/visitor_chair.glb', x: -4.47, z: 5.55, yaw: 270, col: 0.04 },
      // ---- ceiling tubes: 'tube' = main (flickers), 'dead' = broken one hanging crooked ----
      { id: 'tube', url: 'assets/props/clinic/fluorescent_light.glb', x: -6.23, y: 1.89, z: 7.1, yaw: 0, own: 'tube' },
      { id: 'tube2', url: 'assets/props/clinic/fluorescent_light.glb', x: -6.23, y: 1.89, z: 5.25, yaw: 0, roll: 11, own: 'dead' }
    ]
  };

  /* ---------- state ---------- */
  let world = null, G = null, WX = 0, WZ = 0, CX = 0, CZ = 0;            // CX/CZ = clinic centre in world metres
  const st = { status: 'idle', urls: [], grp: null, boxes: [], own: [], tubes: { main: [], dead: [] } };
  let sign = null, roomLight = null, mainFx = null, deadFx = null;

  /* ---------- flicker state machine: 'o' steady, 'f' lop-jhup flicker, 'w' nearly dead ---------- */
  function mkFx(mode, speed) { return { mode: mode, v: mode === 'w' ? 0.05 : 1, ph: mode === 'w' ? 'off' : 'on', t: 0.3 + Math.random() * 2.5, n: 0, sp: speed || 1 }; }
  function stepFx(L, dt) {
    if (L.mode === 'o') { L.v = 1; return L.v; }
    L.t -= dt;
    if (L.t > 0) return L.v;
    const r = Math.random();
    if (L.ph === 'on') {                      // stable -> start a stutter burst
      L.ph = 'burst'; L.n = L.mode === 'f' ? 3 + ((Math.random() * 5) | 0) : 2 + ((Math.random() * 3) | 0);
      L.v = 0.05 + r * 0.1; L.t = (0.03 + Math.random() * 0.09) / L.sp;
    } else if (L.ph === 'burst') {            // alternate low / high flashes
      L.n--;
      if (L.n > 0) { L.v = (L.n % 2) ? 0.04 + r * 0.14 : 0.55 + r * 0.45; L.t = (0.03 + Math.random() * 0.11) / L.sp; }
      else if (L.mode === 'f') {
        if (r < 0.35) { L.ph = 'off'; L.v = 0.03; L.t = (0.35 + Math.random() * 0.9) / L.sp; }   // short blackout
        else { L.ph = 'on'; L.v = 1; L.t = (0.9 + Math.random() * 3.6) / L.sp; }
      } else { L.ph = 'off'; L.v = 0.04; L.t = 1.5 + Math.random() * 4.5; }                      // weak: back to dark
    } else {                                  // 'off'
      if (L.mode === 'f') { L.ph = 'burst'; L.n = 2 + ((Math.random() * 2) | 0); L.v = 0.9; L.t = 0.05 / L.sp; }
      else { L.ph = 'burst'; L.n = 2 + ((Math.random() * 3) | 0); L.v = 0.7 + r * 0.3; L.t = 0.06 + Math.random() * 0.1; }
    }
    return L.v;
  }

  /* ---------- helpers ---------- */
  function box(w, h, d, m, x, y, z, parent) { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; }
  function findVillageGroup(scene) {          // fallback if index.html did not hand us the village group
    let hit = null;
    scene.traverse(function (o) { if (!hit && o.isMesh && /^Cube\.?146$/.test(o.name || '')) hit = o; });
    return hit && hit.parent && hit.parent.parent ? hit.parent.parent : null;
  }

  /* =====================================================================================================
   * 1. SIGN BOARD
   * ===================================================================================================== */
  function buildSign() {
    const S = CFG.sign, CW = 1024, CH = Math.round(CW * S.h / S.w), pxm = S.w / CW;
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
    const g = cv.getContext('2d');
    // --- old painted wood ---
    const rows = 4, ph = CH / rows;
    for (let r = 0; r < rows; r++) {
      const v = 36 + ((r * 37) % 14);
      g.fillStyle = 'rgb(' + (v + 8) + ',' + (v + 2) + ',' + (v - 4) + ')'; g.fillRect(0, r * ph, CW, ph);
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, r * ph, CW, 2);
    }
    for (let i = 0; i < 280; i++) {
      g.fillStyle = Math.random() < 0.6 ? 'rgba(0,0,0,.16)' : 'rgba(95,84,66,.10)';
      g.fillRect(Math.random() * CW, Math.random() * CH, 20 + Math.random() * 140, 1 + Math.random() * 1.6);
    }
    const gr = g.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.5)');
    g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(58,70,52,' + (0.10 + Math.random() * 0.18) + ')'; g.fillRect(Math.random() * CW, Math.random() * CH, 6 + Math.random() * 40, 4 + Math.random() * 18); }   // moss / damp
    g.strokeStyle = 'rgba(150,138,116,.22)'; g.lineWidth = 5; g.strokeRect(9, 9, CW - 18, CH - 18);
    g.fillStyle = 'rgba(20,18,16,.9)';
    [[20, 20], [CW - 20, 20], [20, CH - 20], [CW - 20, CH - 20]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 5, 0, 6.2832); g.fill(); });

    // --- layout: cross emblem on the left, text on the right ---
    const font = function (px) { return 'bold ' + px + 'px Georgia,"Times New Roman",serif'; };
    const chars = S.text.split(''), gap = 9, x0 = 232, availW = CW - x0 - 46;
    let fs = 118; g.font = font(fs);
    const meas = function () { g.font = font(fs); return chars.map(function (c) { return g.measureText(c).width; }); };
    let ws = meas(), total = ws.reduce(function (a, b) { return a + b; }, 0) + gap * (chars.length - 1);
    if (total > availW) { fs = Math.floor(fs * availW / total); ws = meas(); total = ws.reduce(function (a, b) { return a + b; }, 0) + gap * (chars.length - 1); }
    let cx = x0 + (availW - total) / 2;
    const glyphs = [];
    chars.forEach(function (c, i) { if (c !== ' ') glyphs.push({ ch: c, cx: cx + ws[i] / 2, w: ws[i] }); cx += ws[i] + gap; });
    const crossGlyph = { ch: '+', cx: 118, w: 92, cross: true };

    // faded paint of every glyph on the board (visible when its light is off)
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(fs);
    glyphs.forEach(function (q) {
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(q.ch, q.cx, CH / 2 + 2);
      g.fillStyle = 'rgba(118,138,128,.20)'; g.fillText(q.ch, q.cx, CH / 2 + 2);
    });
    drawPlus(g, crossGlyph.cx, CH / 2, 84, 26, 'rgba(118,138,128,.22)', 0);

    // --- board + frame ---
    const tex = new T.CanvasTexture(cv); tex.anisotropy = 4; tex.encoding = T.sRGBEncoding;
    const mSide = new T.MeshStandardMaterial({ color: 0x1c1814, roughness: 1, metalness: 0 });
    const mFront = new T.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
    const holder = new T.Group(); holder.name = 'clinic_sign';
    holder.position.set(S.x, S.y, S.z); holder.rotation.y = Math.PI / 2;        // local +Z = world +X (faces the road); local +X = viewer's right
    const bd = new T.Mesh(new T.BoxGeometry(S.w, S.h, 0.07), [mSide, mSide, mSide, mSide, mFront, mSide]); holder.add(bd);
    const fr = new T.MeshStandardMaterial({ color: 0x14110e, roughness: 1, metalness: 0 });
    box(S.w + 0.1, 0.06, 0.1, fr, 0, S.h / 2 + 0.01, 0.01, holder); box(S.w + 0.1, 0.06, 0.1, fr, 0, -S.h / 2 - 0.01, 0.01, holder);
    box(0.06, S.h + 0.1, 0.1, fr, -S.w / 2 - 0.01, 0, 0.01, holder); box(0.06, S.h + 0.1, 0.1, fr, S.w / 2 + 0.01, 0, 0.01, holder);
    [-0.4 * S.w, 0, 0.4 * S.w].forEach(function (bx) {                                      // back braces down to the veranda roof
      const br = box(0.05, 0.46, 0.05, fr, bx, -S.h / 2 - 0.12, -0.17, holder); br.rotation.x = -0.62;
    });

    // --- per-letter neon (additive, own brightness each) ---
    const color = new T.Color(S.color), letters = [], gcache = {};
    function glyphTex(q) {
      const key = q.ch + (q.cross ? 'x' : '');
      if (gcache[key]) return gcache[key];
      const pad = 18, gw = Math.ceil(q.w + pad * 2), gh = Math.ceil((q.cross ? 100 : fs * 1.25) + pad * 2);
      const c = document.createElement('canvas'); c.width = gw; c.height = gh;
      const x = c.getContext('2d');
      if (q.cross) { drawPlus(x, gw / 2, gh / 2, 84, 26, '#ffffff', 18); }
      else {
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font(fs);
        x.shadowColor = '#ffffff'; x.shadowBlur = 16; x.fillStyle = '#ffffff';
        x.fillText(q.ch, gw / 2, gh / 2 + 2); x.fillText(q.ch, gw / 2, gh / 2 + 2);
        x.shadowBlur = 0; x.fillText(q.ch, gw / 2, gh / 2 + 2);
      }
      const t = new T.CanvasTexture(c); t.anisotropy = 2;
      return (gcache[key] = { tex: t, gw: gw, gh: gh });
    }
    function addLetter(q, mode) {
      const gt = glyphTex(q);
      const m = new T.MeshBasicMaterial({ map: gt.tex, color: color.clone(), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const p = new T.Mesh(new T.PlaneGeometry(gt.gw * pxm, gt.gh * pxm), m);
      p.position.set((q.cx - CW / 2) * pxm, -2 * pxm * (q.cross ? 0 : 1), 0.036 + 0.004); p.renderOrder = 6;
      holder.add(p);
      letters.push({ mat: m, fx: mkFx(mode, 1) });
    }
    addLetter(crossGlyph, S.cross || 'o');
    glyphs.forEach(function (q, i) { addLetter(q, S.modes[i] || 'o'); });
    G.add(holder);
    sign = { holder: holder, letters: letters, avg: 1, light: null };

    // light thrown on the veranda + road (skipped on Low graphics: every extra light costs every pixel)
    if (!(window.GQ && window.GQ.id === 'low')) {
      const pl = new T.PointLight(S.lightColor, 0, S.lightDist, 2);
      pl.position.set(S.x + 1.4, S.y - 0.15, S.z); G.add(pl); sign.light = pl;
    }
  }
  function drawPlus(c, x, y, len, thick, fill, blur) {
    c.save(); c.fillStyle = fill; if (blur) { c.shadowColor = '#ffffff'; c.shadowBlur = blur; }
    const r = function (w, h) { const rx = x - w / 2, ry = y - h / 2; c.beginPath(); if (c.roundRect) c.roundRect(rx, ry, w, h, 5); else c.rect(rx, ry, w, h); c.fill(); };
    r(len, thick); r(thick, len); if (blur) { r(len, thick); r(thick, len); }
    c.restore();
  }
  function stepSign(dt) {
    let sum = 0;
    for (const L of sign.letters) { const v = stepFx(L.fx, dt); L.mat.opacity = v; sum += v; }
    sign.avg = sum / sign.letters.length;
    if (sign.light) sign.light.intensity = CFG.sign.lightI * (0.12 + 0.88 * sign.avg);
  }

  /* =====================================================================================================
   * 2. ROOM LIGHT (flickers together with the main tube)
   * ===================================================================================================== */
  function buildRoomLight() {
    mainFx = mkFx('f', 1.15); deadFx = mkFx('w', 1);
    if (window.GQ && window.GQ.id === 'low') return;
    const R = CFG.room;
    roomLight = new T.PointLight(R.color, 0, R.dist, 2); roomLight.position.set(R.x, R.y, R.z); G.add(roomLight);
  }
  function setTube(list, v) { for (const m of list) if (m.emissive) m.emissive.setRGB(0.80 * v, 0.96 * v, 0.88 * v); }
  function stepRoom(dt) {
    const v = stepFx(mainFx, dt), d = stepFx(deadFx, dt);
    setTube(st.tubes.main, v); setTube(st.tubes.dead, d * 0.7);
    if (roomLight) roomLight.intensity = CFG.room.intensity * (0.05 + 0.95 * v) + 0.15 * d;
  }

  /* =====================================================================================================
   * 3. PROPS (streamed)
   * ===================================================================================================== */
  function allUrls() {
    const s = {};
    CFG.items.forEach(function (it) { s[it.url] = 1; (it.kids || []).forEach(function (k) { s[k.url] = 1; }); });
    return Object.keys(s);
  }
  function tintOnce(gl) {          // night look: darken + dust, once per material, every material double-sided (thin props: paper, film)
    gl.scene.traverse(function (o) {
      if (!o.isMesh) return;
      [].concat(o.material).forEach(function (m) {
        if (!m) return;
        m.side = T.DoubleSide;
        if (m.transparent) m.depthWrite = false;
        if (m.color && !(m.userData && m.userData._clTint)) { m.color.multiplyScalar(0.82); m.userData = m.userData || {}; m.userData._clTint = 1; }
        if (m.map && m.map.anisotropy !== undefined) m.map.anisotropy = Math.max(m.map.anisotropy, 2);
      });
    });
  }
  function instance(o, map) {
    const gl = map[o.url]; if (!gl) return null;
    const m = gl.scene.clone(true);
    if (o.own) m.traverse(function (x) { if (!x.isMesh) return; x.material = Array.isArray(x.material) ? x.material.map(function (q) { const c = q.clone(); st.own.push(c); return c; }) : (function (q) { const c = q.clone(); st.own.push(c); return c; })(x.material); });
    let s = o.scale || 1;
    const inner = new T.Group(); inner.add(m);
    if (o.fit) {
      const b = P1.measure(m), sz = b.getSize(new T.Vector3()), L = Math.max(sz.x, sz.y, sz.z) || 1;
      s = o.fit / L; m.updateMatrixWorld(true);
      const b2 = P1.measure(m); m.position.set(-(b2.min.x + b2.max.x) / 2, -b2.min.y, -(b2.min.z + b2.max.z) / 2);   // centre on x/z, lowest point on y = 0
    }
    inner.scale.setScalar(s);
    const h = new T.Group(); h.add(inner);
    h.position.set(o.x || 0, o.y || 0, o.z || 0);
    h.rotation.order = 'YXZ'; h.rotation.set((o.pitch || 0) * DEG, (o.yaw || 0) * DEG, (o.roll || 0) * DEG);
    h.userData.model = m;
    return h;
  }
  function collectTube(h, which) {
    h.userData.model.traverse(function (x) {
      if (!x.isMesh) return;
      [].concat(x.material).forEach(function (m) { if (m && /tube/i.test(m.name || '')) { st.tubes[which].push(m); m.emissive = m.emissive || new T.Color(0); } });
    });
  }
  function build(map) {
    const grp = new T.Group(); grp.name = 'clinic_props'; G.add(grp);
    for (const u in map) tintOnce(map[u]);
    st.boxes = []; st.own = []; st.tubes = { main: [], dead: [] };
    CFG.items.forEach(function (it) {
      const h = instance(it, map); if (!h) { P1.warn('clinic: missing model for ' + it.id); return; }
      grp.add(h);
      if (it.own) collectTube(h, it.own === 'dead' ? 'dead' : 'main');
      if (it.col != null) {                       // furniture footprint (world AABB of the main model only, before the small props are added)
        G.updateMatrixWorld(true);
        const b = P1.measure(h.userData.model), k = it.col;
        st.boxes.push({ id: it.id, x0: b.min.x + k, x1: b.max.x - k, z0: b.min.z + k, z1: b.max.z - k });
      }
      (it.kids || []).forEach(function (k) { const c = instance(k, map); if (c) h.add(c); });
    });
    st.grp = grp;
    G.updateMatrixWorld(true);
  }
  function startLoad() {
    st.status = 'loading'; P1.status.clinic = 'loading';
    st.urls = allUrls();
    const jobs = st.urls.map(function (u) { return P1.assets.acquire(u).then(function (g) { return { u: u, g: g }; }, function (e) { P1.warn('clinic: ' + (e && e.message)); return { u: u, g: null }; }); });
    Promise.all(jobs).then(function (res) {
      const ok = res.filter(function (r) { return r.g; });
      if (st.status !== 'loading') { ok.forEach(function (r) { P1.assets.release(r.u); }); return; }     // player walked away while loading
      st.urls = ok.map(function (r) { return r.u; });
      const map = {}; ok.forEach(function (r) { map[r.u] = r.g; });
      try { build(map); st.status = 'ready'; P1.status.clinic = 'ready (' + ok.length + '/' + res.length + ' models, ' + st.boxes.length + ' colliders)'; }
      catch (e) { st.status = 'error'; P1.status.clinic = 'error: ' + e.message; P1.warn('clinic build failed', e); st.urls.forEach(function (u) { P1.assets.release(u); }); st.urls = []; }
    });
  }
  function unload(why) {
    if (st.grp) { G.remove(st.grp); st.grp = null; }
    st.own.forEach(function (m) { P1.disposeMaterial(m); }); st.own = [];
    st.urls.forEach(function (u) { P1.assets.release(u); }); st.urls = [];
    st.boxes = []; st.tubes = { main: [], dead: [] };
    st.status = 'idle'; P1.status.clinic = 'idle (' + why + ')';
  }

  /* =====================================================================================================
   * public
   * ===================================================================================================== */
  // called BEFORE P1.startCharacters (it re-homes Dr. Arvind inside the clinic)
  P1.startClinic = function (w) {
    world = w;
    G = (w.village && w.village()) || findVillageGroup(w.scene);
    if (!G) { P1.warn('clinic: village group not found -> clinic skipped'); P1.status.clinic = 'error: village group not found'; return; }
    G.updateMatrixWorld(true);
    WX = G.position.x; WZ = G.position.z;
    CX = WX - 6.23; CZ = WZ + 6.425;
    buildSign(); buildRoomLight();
    // r32b: self-check — the clinic house must be the BIGGER one (Cube.146 is ~4.4 m wide in x now, 3.4 m in r31). If not, the browser/CDN served an old village.glb.
    try {
      let hs = null; G.traverse(function (o) { if (!hs && o.isMesh && /^Cube\.?146$/.test(o.name || '')) hs = o; });
      if (hs && T.Box3) { const sz = new T.Box3().setFromObject(hs).getSize(new T.Vector3()); P1.status.clinicHouse = sz.x.toFixed(2) + ' x ' + sz.z.toFixed(2) + ' m';
        if (sz.x < 3.9) { P1.warn('clinic house is the OLD size (' + sz.x.toFixed(2) + ' m) -> runtime enlarge did not run'); if (w.notify) w.notify('⚠ Clinic ghar purana size dikh raha hai — part A index.html upload karo + hard refresh'); } }
    } catch (e) { P1.warn('clinic size check failed', e); }

    // Dr. Arvind stands inside, looking at the door
    const npcs = P1.config && P1.config.npcs;
    if (npcs) {
      npcs.arvind = { place: 'Dr. Arvind Clinic (inside)', anchor: 'world', x: WX + CFG.doctor.x, z: WZ + CFG.doctor.z, face: { point: [WX + CFG.door.x, WZ + CFG.door.z] }, snap: false };
    }
    // nicer button text on the clinic door
    let best = null, bd = 1.6;
    (w.doors || []).forEach(function (d) { const q = Math.hypot(d.x - (WX + CFG.door.x), d.z - (WZ + CFG.door.z)); if (q < bd) { bd = q; best = d; } });
    if (best) best.label = ['🏥 Clinic ka darwaza kholo', '🏥 Clinic ka darwaza band karo'];
    P1.status.clinic = 'idle';
    P1.clinic = { cfg: CFG, state: st, sign: function () { return sign; }, world: { x: CX, z: CZ } };
    P1.log('clinic ready at world (' + CX.toFixed(1) + ', ' + CZ.toFixed(1) + '), door button ' + (best ? 'relabelled' : 'NOT found'));
  };

  P1.updateClinic = function (dt, pos) {
    if (!G || !sign) return;
    const d = Math.hypot(pos.x - CX, pos.z - CZ);
    if (st.status === 'ready' && d > CFG.unloadRadius) unload('far');
    else if (st.status === 'idle' && d < CFG.loadRadius) startLoad();
    if (d < CFG.animRadius) { stepSign(dt); stepRoom(dt); }
    else {                                                       // far away: lights off (intensity 0 — never toggle .visible, that recompiles every shader)
      if (sign.light) sign.light.intensity = 0;
      if (roomLight) roomLight.intensity = 0;
    }
  };

  P1.collideClinic = function (pos, rad) {
    if (!st.boxes.length) return;
    if ((P1.gy || 0) > 1.2) return;                              // upstairs
    const r = rad || CFG.playerR;
    for (const b of st.boxes) {
      if (pos.x > b.x0 - r && pos.x < b.x1 + r && pos.z > b.z0 - r && pos.z < b.z1 + r) {
        const a = pos.x - (b.x0 - r), c = (b.x1 + r) - pos.x, d = pos.z - (b.z0 - r), e = (b.z1 + r) - pos.z, m = Math.min(a, c, d, e);
        if (m === a) pos.x = b.x0 - r; else if (m === c) pos.x = b.x1 + r; else if (m === d) pos.z = b.z0 - r; else pos.z = b.z1 + r;
      }
    }
  };
})();

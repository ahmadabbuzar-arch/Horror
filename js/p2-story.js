/* THE LAST VILLAGE — PART 2 ENGINE: interactive NPCs, on-screen subtitle dialogue (name + typing effect + Continue button, NO audio),
 * connected missions + quest list.  Data (dialogue, missions, item positions) lives in js/p2-config.js.
 * Loaded after p1-clinic.js; driven by js/p1-main.js (P2.start / P2.update inside the P1 guard).
 * It never moves or edits any NPC / building / map object: it only adds small quest items, UI, and turns an NPC's head-to-toe towards the player
 * while talking (restored afterwards).  Not in this part: tunnel, inventory, car repair, SAAYA AI, endings.
 * Unit-tested offline with tools/test_p2_logic.js (fake DOM); NOT run in a real browser (no Three.js in the build sandbox). */
(function () {
  'use strict';
  const P2 = (window.P2 = window.P2 || {});
  const P1 = window.P1 || {};
  const T = window.THREE;
  const CFG = P2.config;
  const QS = (typeof location !== 'undefined' ? location.search : '');
  const TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const NPC_IDS = ['raghunath', 'kamla', 'arvind', 'shyamlal', 'chotu', 'dev'];
  const SAVE_KEY = 'lv_p2_v1';
  const Q = CFG.quests;

  /* ------------------------------------------------------------------ state */
  // qi = index of the active mission (Q.length = all done), st = stage index inside it, got = collected item ids, names = forgotten names found
  const S = { qi: 0, st: 0, got: {}, names: [] };
  P2.state = S;
  P2.locked = false;               // true while a dialogue / the quest list is open -> index.html freezes walking
  let world = null, ui = null, dlg = null, logOpen = false, toastT = 0, started = false;
  let target = null, lastPrompt = '', reachT = 0, time = 0;
  let itemsSynced = false;
  const items = {};                // itemId -> { def, x, z, y, group, glow, revealed, bobT }
  const turning = [];              // slots that are rotating towards the player / back to their spawn yaw
  const markers = new Map();       // slot -> { holder, sprite }

  /* ------------------------------------------------------------------ save / load */
  function save() {
    if (!CFG.save) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ qi: S.qi, st: S.st, got: S.got, names: S.names })); } catch (e) {}
  }
  function load() {
    if (/[?&]newgame\b/.test(QS)) { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} return; }
    if (!CFG.save) return;
    try {
      const j = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!j || typeof j.qi !== 'number' || j.qi < 0 || j.qi > Q.length) return;
      S.qi = j.qi | 0; S.st = Math.max(0, j.st | 0); S.got = (j.got && typeof j.got === 'object') ? j.got : {};
      S.names = Array.isArray(j.names) ? j.names.filter(function (n) { return typeof n === 'string'; }) : [];
      if (S.qi < Q.length && S.st >= Q[S.qi].stages.length) { S.st = 0; }
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ quest helpers */
  const questIndexOfNpc = function (id) { for (let i = 0; i < Q.length; i++) if (Q[i].npc === id) return i; return -1; };
  const curQuest = function () { return S.qi < Q.length ? Q[S.qi] : null; };
  const curStage = function () { const q = curQuest(); return q ? q.stages[S.st] : null; };
  const gotCount = function (ids) { let n = 0; ids.forEach(function (i) { if (S.got[i]) n++; }); return n; };
  const stripCount = function (t) { return String(t).replace(/\s*\(\d+\/\d+\)\s*$/, ''); };
  function objectiveText() {
    const q = curQuest(), s = curStage();
    if (!q || !s) return '';
    let t = stripCount(s.obj);
    if (s.type === 'collect' && s.items.length > 1) t += ' (' + gotCount(s.items) + '/' + s.items.length + ')';
    return t;
  }
  function toast(t) {
    if (!ui) return;
    ui.toast.textContent = t; ui.toast.style.opacity = '1'; toastT = 4.2;
  }
  function completeQuest() {
    const q = curQuest(); if (!q) return;
    const after = q.onDone;
    toast('✔ Mission poora: ' + q.title);
    startQuestDeferred(S.qi + 1);
    if (after) openDialogue([after], null, null);
  }
  function startQuestDeferred(i) { S.qi = i; S.st = 0; setTimeout(function () { if (i < Q.length) toast('📜 Naya mission: ' + Q[i].title); else toast('🏁 Part 2 ke saare missions poore!'); }, 2600); }
  function completeStage() {
    const q = curQuest(); if (!q) return;
    S.st++;
    if (S.st >= q.stages.length) completeQuest();
    else toast('➡ ' + objectiveText());
    save(); syncItems(); refreshUI();
  }

  /* ------------------------------------------------------------------ DOM / UI */
  function css() {
    const el = document.createElement('style');
    el.textContent =
      '#p2d{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 8px);width:min(760px,94vw);box-sizing:border-box;z-index:15;display:none;background:rgba(6,8,14,.88);border:1px solid rgba(255,255,255,.22);border-radius:14px;padding:8px 14px 10px;box-shadow:0 4px 18px rgba(0,0,0,.6);pointer-events:auto}' +
      '#p2n{font-weight:700;font-size:13px;letter-spacing:.4px;color:#f0a24a;margin-bottom:2px;min-height:15px}' +
      '#p2x{font-size:15px;line-height:1.38;min-height:2.76em;max-height:34vh;overflow:hidden;text-shadow:0 1px 3px #000;white-space:pre-wrap}' +
      '#p2x.nar{font-style:italic;opacity:.92}' +
      '#p2c{display:block;margin:6px 0 0 auto;background:#d9822b;color:#150b02;border:0;font-weight:700;font-size:14px;padding:7px 18px;border-radius:999px}' +
      '#p2i{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 104px);z-index:10;display:none;background:rgba(240,162,74,.95);color:#150b02;border:0;font-weight:700;font-size:14px;padding:8px 16px;border-radius:999px;box-shadow:0 2px 10px rgba(0,0,0,.5);max-width:90vw}' +
      '#p2q{position:fixed;left:10px;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:9;max-width:min(46vw,330px);font-size:12px;line-height:1.35;background:rgba(6,8,14,.55);border-left:3px solid #d9822b;padding:5px 9px;border-radius:0 8px 8px 0;pointer-events:none;display:none;text-shadow:0 1px 2px #000}' +
      '#p2q b{display:block;font-size:12px;color:#f0a24a}' +
      '#p2t{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 46px);transform:translateX(-50%);z-index:14;font-size:13px;font-weight:600;background:rgba(6,8,14,.82);border:1px solid rgba(240,162,74,.6);padding:6px 14px;border-radius:999px;opacity:0;transition:opacity .4s;pointer-events:none;max-width:90vw;text-align:center}' +
      '#p2b{width:36px;height:36px;padding:0!important;font-size:16px!important;border-radius:50%!important}' +
      '#p2l{position:fixed;inset:0;z-index:16;display:none;align-items:center;justify-content:center;background:rgba(3,4,8,.82);padding:env(safe-area-inset-top,0px) 12px env(safe-area-inset-bottom,0px)}' +
      '#p2l .pn{width:min(560px,96vw);max-height:92vh;overflow:auto;background:rgba(10,12,20,.96);border:1px solid rgba(255,255,255,.25);border-radius:14px;padding:12px 16px;box-sizing:border-box}' +
      '#p2l h2{margin:0 0 6px;font-size:17px}#p2l .qi{padding:5px 0;border-top:1px solid rgba(255,255,255,.1);font-size:13px;line-height:1.35}' +
      '#p2l .qi.done{opacity:.55}#p2l .qi.lock{opacity:.4}#p2l .qi.act{background:rgba(217,130,43,.12)}#p2l .qo{font-size:12px;opacity:.85;margin-left:20px}' +
      '#p2l .nm{margin-top:8px;font-size:12px;opacity:.85}#p2l button{margin-top:8px}';
    document.head.appendChild(el);
  }
  function mk(tag, id, parent) { const e = document.createElement(tag); if (id) e.id = id; (parent || document.body).appendChild(e); return e; }
  function buildUI() {
    css();
    ui = {};
    ui.box = mk('div', 'p2d'); ui.name = mk('div', 'p2n', ui.box); ui.text = mk('div', 'p2x', ui.box); ui.cont = mk('button', 'p2c', ui.box);
    ui.prompt = mk('button', 'p2i'); ui.track = mk('div', 'p2q'); ui.toast = mk('div', 'p2t'); ui.panel = mk('div', 'p2l');
    ui.cont.textContent = 'Continue ▶' + (TOUCH ? '' : '  (Space)');
    ui.cont.onclick = function (e) { e.stopPropagation(); advance(); };
    ui.box.addEventListener('click', function (e) { if (e.target !== ui.cont) advance(); });   // tap anywhere on the subtitle box: finish typing / next line
    ui.prompt.onclick = function () { act(); };
    ui.panel.addEventListener('click', function (e) { if (e.target === ui.panel) toggleLog(false); });
    const hud = document.getElementById('hud');
    if (hud) { const b = document.createElement('button'); b.id = 'p2b'; b.setAttribute('aria-label', 'Missions'); b.textContent = '📜'; b.onclick = function () { toggleLog(); }; hud.insertBefore(b, hud.firstChild); ui.logBtn = b; }
    // clicks while the mouse is pointer-locked (PC) land on the canvas: use them to advance the dialogue
    document.addEventListener('click', function (e) { if (dlg && document.pointerLockElement && !ui.box.contains(e.target)) advance(); });
    // capture phase + stopPropagation: while talking / when a talk-or-pickup prompt is up, E must NOT also open a door
    addEventListener('keydown', function (e) {
      const k = (e.key || '').toLowerCase();
      if (dlg) {
        if (k === 'enter' || k === ' ' || k === 'e') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) advance(); }
        return;
      }
      if (k === 'j') { e.stopPropagation(); if (!e.repeat) toggleLog(); return; }
      if (logOpen) { if (k === 'escape') toggleLog(false); return; }
      if (k === 'e' && target && started) { e.stopPropagation(); if (!e.repeat) act(); }
    }, true);
  }

  /* ------------------------------------------------------------------ tracker + quest list */
  function refreshUI() {
    if (!ui) return;
    const q = curQuest();
    ui.track.innerHTML = '';
    if (q) { const b = document.createElement('b'); b.textContent = '📜 ' + q.title; ui.track.appendChild(b); ui.track.appendChild(document.createTextNode(objectiveText())); }
    else { ui.track.textContent = '🏁 Part 2: saare missions poore'; }
    if (logOpen) renderLog();
  }
  function renderLog() {
    const p = ui.panel; p.innerHTML = '';
    const card = document.createElement('div'); card.className = 'pn'; p.appendChild(card);
    const h = document.createElement('h2'); h.textContent = '📜 Missions'; card.appendChild(h);
    Q.forEach(function (q, i) {
      const d = document.createElement('div'); const done = i < S.qi, act = i === S.qi;
      d.className = 'qi ' + (done ? 'done' : act ? 'act' : 'lock');
      d.textContent = (done ? '✔ ' : act ? '▶ ' : '🔒 ') + q.title;
      card.appendChild(d);
      const o = document.createElement('div'); o.className = 'qo';
      o.textContent = done ? 'Poora hua' : act ? objectiveText() : 'Pichla mission poora karo';
      d.appendChild(o);
    });
    if (S.names.length) { const n = document.createElement('div'); n.className = 'nm'; n.textContent = '🪦 Bhule hue naam: ' + S.names.join(' · '); card.appendChild(n); }
    const hint = document.createElement('div'); hint.className = 'nm'; hint.textContent = 'Mission list kholne/band karne ke liye 📜 ' + (TOUCH ? '' : 'ya J dabao'); card.appendChild(hint);
    const c = document.createElement('button'); c.textContent = 'Band karo ✕'; c.onclick = function () { toggleLog(false); }; card.appendChild(c);
  }
  function toggleLog(v) {
    if (dlg) return;
    logOpen = v === undefined ? !logOpen : !!v;
    ui.panel.style.display = logOpen ? 'flex' : 'none';
    if (logOpen) renderLog();
    P2.locked = logOpen || !!dlg;
  }

  /* ------------------------------------------------------------------ dialogue (subtitles: name + typing + Continue; no audio) */
  function norm(line, defName) {
    if (Array.isArray(line)) return [line[0] == null ? defName : line[0], String(line[1])];
    return [defName, String(line)];
  }
  function openDialogue(lines, defName, onEnd, slot) {
    if (!ui || !lines || !lines.length) { if (onEnd) onEnd(); return; }
    if (dlg) { dlg.queue = (dlg.queue || []); dlg.queue.push({ lines: lines, defName: defName, onEnd: onEnd, slot: slot }); return; }
    dlg = { lines: lines.map(function (l) { return norm(l, defName == null ? '' : defName); }), i: 0, onEnd: onEnd, slot: slot || null, shown: 0, full: '', done: false, queue: [] };
    logOpen = false; ui.panel.style.display = 'none';
    P2.locked = true; ui.box.style.display = 'block'; ui.prompt.style.display = 'none'; lastPrompt = '';
    if (slot) faceStart(slot);
    showLine();
  }
  function showLine() {
    const l = dlg.lines[dlg.i];
    dlg.full = l[1]; dlg.shown = 0; dlg.done = false;
    ui.name.textContent = l[0] || '';
    ui.text.className = l[0] ? '' : 'nar';
    ui.text.textContent = '';
  }
  function advance() {
    if (!dlg) return;
    if (!dlg.done) { dlg.shown = dlg.full.length; dlg.done = true; ui.text.textContent = dlg.full; return; }   // 1st tap = finish typing
    dlg.i++;
    if (dlg.i < dlg.lines.length) { showLine(); return; }
    const d = dlg; dlg = null;
    ui.box.style.display = 'none'; P2.locked = false;
    if (d.slot) faceEnd(d.slot);
    try { if (d.onEnd) d.onEnd(); } catch (e) { console.error('[P2] dialogue end', e); }
    if (!dlg && d.queue && d.queue.length) { const n = d.queue.shift(); openDialogue(n.lines, n.defName, n.onEnd, n.slot); if (dlg) dlg.queue = d.queue; }
  }
  P2.say = openDialogue;   // P2.say(lines, speakerName, onEnd) — usable by later parts
  function typeTick(dt) {
    if (!dlg || dlg.done) return;
    dlg.shown += CFG.typeSpeed * dt;
    const n = Math.min(dlg.full.length, Math.floor(dlg.shown));
    ui.text.textContent = dlg.full.slice(0, n);
    if (n >= dlg.full.length) dlg.done = true;
  }

  /* ------------------------------------------------------------------ NPC talk */
  const slotOf = function (id) { return (P1.characters && P1.characters.get) ? P1.characters.get(id) : null; };
  const label = function (slot) { return slot.cfg.label; };
  function npcLines(id) {
    const qi = questIndexOfNpc(id), slot = slotOf(id);
    const nm = slot ? label(slot) : id;
    if (qi < 0) return { lines: (CFG.chatter[id] || ['…']).slice(0, 1), nm: nm };
    const q = Q[qi];
    if (qi < S.qi) return { lines: q.done, nm: nm };
    if (qi > S.qi) return { lines: q.locked, nm: nm };
    const s = curStage();
    if (s.type === 'talk' && s.npc === id) return { lines: s.lines, nm: nm, advance: true };
    return { lines: s.remind || ['Abhi kaam baaki hai. Mission list (📜) dekho.'], nm: nm };
  }
  function talkTo(id) {
    const slot = slotOf(id); if (!slot) return;
    const r = npcLines(id);
    openDialogue(r.lines, r.nm, r.advance ? function () { completeStage(); } : null, slot);
  }
  // NPC turns towards the player while talking, and back to its own spawn direction afterwards
  function faceStart(slot) {
    slot._p2want = 'player'; if (turning.indexOf(slot) < 0) turning.push(slot);
  }
  function faceEnd(slot) { slot._p2want = 'home'; if (turning.indexOf(slot) < 0) turning.push(slot); }
  function stepTurning(dt, pos) {
    for (let i = turning.length - 1; i >= 0; i--) {
      const s = turning[i];
      if (!s.holder) { turning.splice(i, 1); continue; }
      const want = s._p2want === 'player' ? Math.atan2(pos.x - s.px, pos.z - s.pz) : s.yaw;
      let d = want - s.holder.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      const m = Math.min(1, dt * 6);
      s.holder.rotation.y += d * m;
      if (Math.abs(d) < 0.01 && s._p2want === 'home') { s.holder.rotation.y = s.yaw; turning.splice(i, 1); }
    }
  }

  /* ------------------------------------------------------------------ quest items (procedural meshes, built only while their stage is active) */
  let glowTex = null;
  function glowTexture() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowTex = new T.CanvasTexture(c); return glowTex;
  }
  const std = function (col, rough) { return new T.MeshStandardMaterial({ color: col, roughness: rough == null ? 0.95 : rough, metalness: 0 }); };
  function bx(g, w, h, d, m, x, y, z) { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; }
  const MODELS = {
    toolbox: function (g) { bx(g, 0.5, 0.26, 0.24, std(0x7a1f14), 0, 0.13, 0); bx(g, 0.52, 0.04, 0.26, std(0x3a2a22), 0, 0.27, 0); bx(g, 0.3, 0.03, 0.03, std(0x222222), 0, 0.33, 0); bx(g, 0.03, 0.08, 0.03, std(0x222222), -0.15, 0.30, 0); bx(g, 0.03, 0.08, 0.03, std(0x222222), 0.15, 0.30, 0); g.rotation.y = 0.6; return { glow: 0xff8844, h: 0.4 }; },
    letter: function (g) { const o = bx(g, 0.26, 0.012, 0.34, std(0xd8c9a0), 0, 0.012, 0); o.rotation.y = 0.5; bx(g, 0.05, 0.016, 0.05, std(0x8a1c1c), 0.0, 0.02, 0.0).rotation.y = 0.5; g.rotation.z = 0.04; return { glow: 0xfff2c0, h: 0.1 }; },
    register: function (g) { bx(g, 0.34, 0.07, 0.46, std(0x23402b), 0, 0.035, 0); bx(g, 0.31, 0.05, 0.43, std(0xcfc6a8), 0.015, 0.035, 0); bx(g, 0.035, 0.075, 0.46, std(0x111111), -0.16, 0.037, 0); g.rotation.y = -0.4; return { glow: 0x9fe8b0, h: 0.15 }; },
    lantern: function (g) { const m = std(0x3a2d20, 0.8); const base = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.05, 8), m); base.position.y = 0.025; g.add(base);
      const gl = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.25, 8), new T.MeshBasicMaterial({ color: 0xffb347 })); gl.position.y = 0.175; g.add(gl);
      const top = new T.Mesh(new T.ConeGeometry(0.12, 0.09, 8), m); top.position.y = 0.345; g.add(top);
      const hd = new T.Mesh(new T.TorusGeometry(0.08, 0.008, 5, 12, Math.PI), m); hd.position.y = 0.39; g.add(hd); return { glow: 0xffc060, h: 0.3, strong: true }; },
    drawing: function (g) { bx(g, 0.3, 0.03, 0.4, std(0x2f6fb5), 0, 0.02, 0); bx(g, 0.26, 0.032, 0.05, std(0xe4b43a), 0, 0.02, 0.1); bx(g, 0.28, 0.02, 0.38, std(0xe8e2cf), 0.01, 0.012, 0); g.rotation.y = 0.9; return { glow: 0x9fd0ff, h: 0.12 }; },
    diary: function (g) { bx(g, 0.2, 0.012, 0.28, std(0xc9b27c), 0, 0.012, 0).rotation.y = 0.3; bx(g, 0.16, 0.014, 0.01, std(0x3a2a18), 0, 0.016, 0.04).rotation.y = 0.3; return { glow: 0xffe9a8, h: 0.1 }; },
    coat: function (g) { const m = std(0x3a342b); bx(g, 0.9, 0.08, 0.6, m, 0, 0.04, 0); bx(g, 0.5, 0.07, 0.2, m, -0.55, 0.04, 0.12).rotation.y = 0.5; bx(g, 0.5, 0.07, 0.2, m, 0.52, 0.04, -0.14).rotation.y = -0.4; g.rotation.y = 1.1; return { glow: 0xb0b0c0, h: 0.2 }; },
    grave: function (g) { const mound = new T.Mesh(new T.SphereGeometry(0.8, 10, 6), std(0x2b2a22, 1)); mound.scale.set(1.2, 0.22, 0.7); mound.position.y = 0.04; g.add(mound);
      bx(g, 0.34, 0.4, 0.09, std(0x6a6862), 0, 0.2, -0.55).rotation.z = 0.12; bx(g, 0.05, 0.4, 0.05, std(0x1c1a17), 0.0, 0.3, 0.45); bx(g, 0.25, 0.05, 0.05, std(0x1c1a17), 0.0, 0.4, 0.45); return { glow: 0x8899ff, h: 0.3, reveal: 7 }; },
    stone: function (g) { const o = bx(g, 0.38, 0.5, 0.1, std(0x6f6d68), 0, 0.2, 0); o.rotation.z = (Math.random() - 0.5) * 0.2; bx(g, 0.36, 0.04, 0.11, std(0x2f4a2a), 0, 0.46, 0).rotation.z = o.rotation.z; return { glow: 0x88aaff, h: 0.35 }; }
  };
  function resolvePos(def) {
    let x = def.x, z = def.z;
    if (def.near === 'clinic') { const c = P1.clinic && P1.clinic.world; if (c) { x = c.x + def.dx; z = c.z + def.dz; } else { x = -12.3 + def.dx; z = 22.6 + def.dz; } }
    else if (def.near === 'graveyard') { const g = CFG.places.graveyard; x = g.cx + def.dx; z = g.cz + def.dz; }
    if (def.snap && world && world.clear) {
      const rings = [0, 1.0, 1.8, 2.6, 3.4];
      outer: for (let r = 0; r < rings.length; r++) {
        const cnt = r === 0 ? 1 : 8;
        for (let k = 0; k < cnt; k++) { const a = k / cnt * 6.2832, xx = x + Math.cos(a) * rings[r], zz = z + Math.sin(a) * rings[r]; if (world.clear(xx, zz, 0.45)) { x = xx; z = zz; break outer; } }
      }
    }
    return { x: x, z: z };
  }
  function spawnItem(id) {
    if (items[id] || !world || !T) return;
    const def = CFG.items[id]; if (!def) return;
    const p = resolvePos(def), g = new T.Group(), mi = MODELS[def.model](g);
    const y = def.near === 'graveyard' ? 0.1 : (world.ground ? world.ground(p.x, p.z) : 0);
    g.position.set(p.x, y, p.z);
    const sm = new T.SpriteMaterial({ map: glowTexture(), color: mi.glow, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.5 });
    const sp = new T.Sprite(sm); sp.scale.set(mi.strong ? 1.5 : 1.1, mi.strong ? 1.5 : 1.1, 1); sp.position.y = mi.h + 0.1; g.add(sp);
    world.scene.add(g);
    const reveal = mi.reveal || 0;
    items[id] = { id: id, def: def, x: p.x, z: p.z, y: y, group: g, glow: sp, revealR: reveal, revealed: !reveal, t: Math.random() * 6 };
    g.visible = !reveal;
  }
  function removeItem(id) {
    const it = items[id]; if (!it) return;
    world.scene.remove(it.group);
    it.group.traverse(function (o) { try { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); } catch (e) {} });   // the shared glow texture is NOT disposed (Material.dispose never touches maps)
    delete items[id];
  }
  function syncItems() {
    if (!world) return;
    const s = curStage(), want = {};
    if (s && s.type === 'collect') s.items.forEach(function (i) { if (!S.got[i]) want[i] = 1; });
    Object.keys(items).forEach(function (i) { if (!want[i]) removeItem(i); });
    Object.keys(want).forEach(spawnItem);
  }
  function pickItem(id) {
    const it = items[id]; if (!it) return;
    const def = it.def;
    openDialogue(def.read, def.speaker || '', function () {
      S.got[id] = true;
      if (def.name && S.names.indexOf(def.name) < 0) { S.names.push(def.name); }
      removeItem(id);
      const s = curStage();
      if (s && s.type === 'collect') {
        if (gotCount(s.items) >= s.items.length) completeStage();
        else { toast('✔ ' + gotCount(s.items) + '/' + s.items.length + ' mil gaye'); save(); refreshUI(); }
      }
    }, null);
  }

  /* ------------------------------------------------------------------ interaction target (nearest talkable NPC or pickup) */
  const _d = T ? new T.Vector3() : null;
  function findTarget(pos) {
    let best = null, bd = 1e9;
    if (!world || dlg || logOpen) return null;
    if (P1.drive && P1.drive.active) return null;
    _d.set(0, 0, -1); try { world.cam.getWorldDirection(_d); } catch (e) {}
    const fx = _d.x, fz = _d.z, fl = Math.hypot(fx, fz) || 1;
    const facing = function (x, z, dist) { if (dist < CFG.talkNear) return true; return ((x - pos.x) * fx + (z - pos.z) * fz) / (dist * fl) > CFG.talkCone; };
    NPC_IDS.forEach(function (id) {
      const s = slotOf(id); if (!s || s.status !== 'ready' || !s.holder) return;
      const d = Math.hypot(pos.x - s.px, pos.z - s.pz);
      if (d < CFG.talkDist && d < bd && facing(s.px, s.pz, d) && Math.abs((P1.gy || 0) - s.py) < 1.6) { bd = d; best = { kind: 'npc', id: id, slot: s }; }
    });
    Object.keys(items).forEach(function (id) {
      const it = items[id]; if (!it.revealed) return;
      const d = Math.hypot(pos.x - it.x, pos.z - it.z);
      if (d < CFG.pickDist && d < bd - 0.2 && Math.abs((P1.gy || 0) - it.y) < 1.8) { bd = d; best = { kind: 'item', id: id }; }
    });
    return best;
  }
  function act() {
    if (!target || dlg) return;
    const t = target; target = null;
    if (t.kind === 'npc') talkTo(t.id); else pickItem(t.id);
  }
  function promptText(t) {
    if (!t) return '';
    const k = TOUCH ? '' : ' (E)';
    if (t.kind === 'npc') return '💬 ' + label(t.slot) + ' se baat karo' + k;
    return items[t.id].def.verb + k;
  }

  /* ------------------------------------------------------------------ "!" markers above NPCs who are waiting for the player */
  function markerTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = '#150b02'; g.fillStyle = '#f0b24a';
    g.strokeText('!', 32, 34); g.fillText('!', 32, 34); return new T.CanvasTexture(c);
  }
  function updateMarkers() {
    const s = curStage(), want = (s && s.type === 'talk') ? s.npc : null;
    NPC_IDS.forEach(function (id) {
      const slot = slotOf(id); if (!slot) return;
      let m = markers.get(slot);
      if (m && m.holder !== slot.holder) { markers.delete(slot); m = null; }          // the NPC was unloaded / reloaded: its old sprite went with the holder
      if (!slot.holder) return;
      if (!m) {
        const sp = new T.Sprite(new T.SpriteMaterial({ map: markerTexture(), transparent: true, depthTest: false, fog: false }));
        sp.scale.set(0.34, 0.34, 1); sp.renderOrder = 20; sp.position.y = (slot.cfg.height || 1.7) + 0.4; slot.holder.add(sp);
        m = { holder: slot.holder, sprite: sp }; markers.set(slot, m);
      }
      m.sprite.visible = (id === want) && !dlg;
      if (m.sprite.visible) m.sprite.position.y = (slot.cfg.height || 1.7) + 0.4 + Math.sin(time * 3) * 0.04;
    });
  }

  /* ------------------------------------------------------------------ place checks + frame update */
  function reached(where, pos) {
    const pl = CFG.places[where]; if (!pl) return false;
    if (where === 'tower') return Math.hypot(pos.x - pl.x, pos.z - pl.z) <= pl.r && (P1.gy || 0) >= pl.minY;
    if (where === 'graveyard') return Math.abs(pos.x - pl.cx) < pl.half && Math.abs(pos.z - pl.cz) < pl.half;
    return false;
  }
  P2.start = function (w) {
    world = w; load();
    const jm = (QS.match(/[?&]mission=(\d+)/) || [])[1];     // QA: ?mission=3 jumps to the 4th mission
    if (jm != null) { S.qi = Math.min(Q.length, +jm); S.st = 0; S.got = {}; }
    buildUI(); started = true; refreshUI(); syncItems();
    if (P1.log) P1.log('Part 2 ready: mission ' + (S.qi + 1) + '/' + Q.length + ', stage ' + S.st);
  };
  P2.update = function (dt, pos) {
    if (!started) return;
    time += dt;
    ui.track.style.display = 'block';
    typeTick(dt);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) ui.toast.style.opacity = '0'; }
    stepTurning(dt, pos);
    if (!itemsSynced) { itemsSynced = true; syncItems(); }
    // pickups: glow pulse + reveal of hidden ones
    for (const id in items) {
      const it = items[id]; it.t += dt;
      if (!it.revealed && Math.hypot(pos.x - it.x, pos.z - it.z) < it.revealR) { it.revealed = true; it.group.visible = true; }
      it.glow.material.opacity = 0.42 + 0.2 * Math.sin(it.t * 2.2);
    }
    updateMarkers();
    target = findTarget(pos);
    const txt = promptText(target);
    if (txt !== lastPrompt) { lastPrompt = txt; ui.prompt.textContent = txt; ui.prompt.style.display = txt ? 'block' : 'none'; }
    reachT -= dt;
    if (reachT <= 0) {
      reachT = 0.25;
      const s = curStage();
      if (s && s.type === 'reach' && !dlg && reached(s.where, pos)) completeStage();
    }
  };
  P2.collide = function () {};   // quest items are walk-through

  // QA / later parts: jump to a mission (0..6) — P2.jump(3)
  P2.jump = function (qi, st) { S.qi = Math.max(0, Math.min(Q.length, qi | 0)); S.st = st | 0; S.got = {}; save(); syncItems(); refreshUI(); };
  P2._test = { npcLines: npcLines, completeStage: completeStage, advance: advance, openDialogue: openDialogue, objectiveText: objectiveText, pickItem: pickItem, syncItems: syncItems, items: items, S: S,
    setWorld: function (w) { world = w; }, buildUI: buildUI, findTarget: findTarget, reached: reached, ui: function () { return ui; }, dlg: function () { return dlg; }, load: load };
})();

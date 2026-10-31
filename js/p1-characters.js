/* THE LAST VILLAGE — Phase 1 characters (Three.js r128). Depends on p1-core.js + p1-config.js.
 * Seven characters, each streamed in/out by distance, normalised to a human height, grounded,
 * given a cheap blob shadow and procedural idle movement. Spawn points and looks come from P1.config.
 * No gameplay, AI or dialogue here. UNTESTED in a browser. */
(function () {
  'use strict';
  const P1 = window.P1;
  const T = THREE;
  const AXIS_Y = new T.Vector3(0, 1, 0);

  // fixed roster: which file is which character (everything tunable lives in p1-config.js)
  const ROSTER = [
    { id: 'raghunath', label: 'Raghunath',  url: 'assets/characters/raghunath.glb' },
    { id: 'kamla',     label: 'Kamla Devi', url: 'assets/characters/kamla_devi.glb' },
    { id: 'arvind',    label: 'Dr. Arvind', url: 'assets/characters/dr_arvind.glb' },
    { id: 'shyamlal',  label: 'Shyamlal',   url: 'assets/characters/shyamlal.glb' },
    { id: 'chotu',     label: 'Chotu',      url: 'assets/characters/chotu.glb' },
    { id: 'dev',       label: 'Dev',        url: 'assets/characters/dev.glb' },
    { id: 'saaya',     label: 'SAAYA',      url: 'assets/characters/saaya.glb' }
  ];
  const ANCHORS = ['world', 'hut', 'spawn', 'village', 'entry', 'door'];

  const slots = [];
  let world = null, time = 0, tickT = 0;
  const shadowTime = { value: 0 }; // shared uniform driving SAAYA's rim pulse

  /* ------------------------------------------------------------------ config validation */
  P1.validateConfig = function () {
    const bad = [], C = P1.config;
    if (!C) return ['P1.config missing (js/p1-config.js not loaded)'];
    const rx = function (where, v) { try { P1.rx(v); } catch (e) { bad.push(where + ': invalid regex ' + v); } };
    ROSTER.forEach(function (r) {
      const n = C.npcs && C.npcs[r.id], a = C.appearance && C.appearance[r.id];
      if (!n) bad.push(r.id + ': no entry in P1.config.npcs');
      else {
        if (ANCHORS.indexOf(n.anchor) < 0) bad.push(r.id + ': unknown anchor "' + n.anchor + '"');
        if (typeof n.x !== 'number' || typeof n.z !== 'number') bad.push(r.id + ': x/z must be numbers');
        if (n.face && !(n.face.to || n.face.point || n.face.yaw != null)) bad.push(r.id + ': face needs to / point / yaw');
        if (n.face && n.face.to && ANCHORS.indexOf(n.face.to) < 0) bad.push(r.id + ': face.to "' + n.face.to + '" unknown');
      }
      if (!a) bad.push(r.id + ': no entry in P1.config.appearance');
      else {
        if (!(a.height > 0.5 && a.height < 3)) bad.push(r.id + ': height ' + a.height + ' outside 0.5..3 m');
        rx(r.id + '.hide', a.hide); rx(r.id + '.headParts', a.headParts);
        (a.materials || []).forEach(function (m, i) { rx(r.id + '.materials[' + i + '].mesh', m.mesh); rx(r.id + '.materials[' + i + '].mat', m.mat); });
      }
    });
    return bad;
  };

  /* ------------------------------------------------------------------ rig helpers */
  const isLeft = function (n) { return /left|(^|[\s_.:\-])l([\s_.:\-]|$)/.test(n); };
  const isRight = function (n) { return /right|(^|[\s_.:\-])r([\s_.:\-]|$)/.test(n); };
  const depthOf = function (b) { let d = 0; for (let p = b.parent; p; p = p.parent) d++; return d; };
  function findDesc(root, re) {
    const q = root.children.slice();
    while (q.length) { const o = q.shift(); if (o.isBone && re.test(o.name)) return o; q.push.apply(q, o.children); }
    return null;
  }
  function collectBones(model) {
    const bones = []; model.traverse(function (o) { if (o.isBone) bones.push(o); });
    const find = function (re, ex) { return bones.find(function (b) { return re.test(b.name) && !(ex && ex.test(b.name)); }); };
    const rig = { bones: bones, arms: {} };
    rig.head = find(/head/i, /top|end|nub/i);
    const necks = bones.filter(function (b) { return /neck/i.test(b.name); }).sort(function (a, b) { return depthOf(a) - depthOf(b); });
    rig.neck = necks[0] || null;
    const spines = bones.filter(function (b) { return /spine|chest/i.test(b.name) && !/twist/i.test(b.name); }).sort(function (a, b) { return depthOf(b) - depthOf(a); });
    rig.chest = spines[0] || null;
    rig.hips = find(/hips|pelvis/i) || find(/hip/i);
    if (!rig.hips && spines.length) { const lo = spines[spines.length - 1]; if (lo.parent && lo.parent.isBone) rig.hips = lo.parent; }
    ['l', 'r'].forEach(function (s) {
      const test = s === 'l' ? isLeft : isRight;
      const c = bones.filter(function (b) {
        const n = b.name.toLowerCase();
        return test(n) && /arm/.test(n) && !/fore|shoulder|hand|twist|roll|clav|elbow/.test(n);
      }).sort(function (a, b) { return depthOf(a) - depthOf(b); });
      rig.arms[s] = c[0] || null;
    });
    const foot = bones.find(function (b) { const n = b.name.toLowerCase(); return /foot|ankle/.test(n) && !/twist/.test(n) && isLeft(n); }) ||
                 bones.find(function (b) { return /foot|ankle/i.test(b.name) && !/twist/i.test(b.name); });
    rig.foot = foot || null;
    rig.toe = foot ? findDesc(foot, /toe/i) : null;
    return rig;
  }

  const _a = new T.Vector3(), _b = new T.Vector3(), _q = new T.Quaternion(), _wq = new T.Quaternion(), _pq = new T.Quaternion();

  // Rotate the model so hips->head points up and the feet point along +Z. Records what it did.
  function orient(fix, rig, info) {
    fix.updateMatrixWorld(true);
    rig.hips.getWorldPosition(_a); rig.head.getWorldPosition(_b);
    const up = _b.sub(_a).normalize();
    const q = new T.Quaternion().setFromUnitVectors(up, AXIS_Y);
    if (q.angleTo(new T.Quaternion()) > 0.02) { fix.quaternion.copy(q); info.upFixDeg = +(q.angleTo(new T.Quaternion()) * 57.2958).toFixed(1); }
    fix.updateMatrixWorld(true);
    if (rig.foot && rig.toe) {
      rig.foot.getWorldPosition(_a); rig.toe.getWorldPosition(_b);
      const f = _b.sub(_a); f.y = 0;
      if (f.lengthSq() > 1e-10) {
        const yaw = Math.atan2(f.x, f.z);
        fix.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(AXIS_Y, -yaw));
        info.faceFixDeg = +(-yaw * 57.2958).toFixed(1);
      }
    } else info.faceFix = 'none (no foot/toe bones: assumed +Z)';
    fix.updateMatrixWorld(true);
  }

  // Aim `bone` so the vector bone->child points along `target` (world space, convention-independent).
  function aim(bone, child, target) {
    bone.getWorldPosition(_a); child.getWorldPosition(_b);
    const d = _b.sub(_a).normalize();
    _q.setFromUnitVectors(d, target);
    bone.getWorldQuaternion(_wq);
    _wq.premultiply(_q);
    if (bone.parent) { bone.parent.getWorldQuaternion(_pq); _pq.invert(); _wq.premultiply(_pq); }
    bone.quaternion.copy(_wq);
    bone.updateMatrixWorld(true);
  }
  // T-pose / A-pose rigs: let the arms hang. Skipped when the arms already hang down.
  function relaxArms(rig, model, info) {
    model.updateMatrixWorld(true);
    let done = 0;
    ['l', 'r'].forEach(function (s) {
      const up = rig.arms[s]; if (!up) return;
      const fore = up.children.find(function (c) { return c.isBone && /fore|elbow/i.test(c.name); }) || up.children.find(function (c) { return c.isBone; });
      if (!fore) return;
      up.getWorldPosition(_a); fore.getWorldPosition(_b);
      const d = _b.clone().sub(_a).normalize();
      if (d.y < -0.8) return; // already hanging
      const t1 = new T.Vector3(d.x, 0, d.z); if (t1.lengthSq() < 1e-6) t1.set(s === 'l' ? 1 : -1, 0, 0);
      t1.normalize().multiplyScalar(0.2).add(new T.Vector3(0, -1, 0)).normalize();
      aim(up, fore, t1);
      const hand = fore.children.find(function (c) { return c.isBone; });
      if (hand) aim(fore, hand, new T.Vector3(t1.x * 0.3, -1, 0.22).normalize());
      done++;
    });
    info.armsRelaxed = done;
  }

  /* ------------------------------------------------------------------ materials (all driven by P1.config.appearance) */
  const _c = new T.Color();
  function colorOf(m) { return (m.color && m.color.isColor) ? m.color : (m.uniforms && m.uniforms.diffuse && m.uniforms.diffuse.value); }
  function mapOf(m) { return (m.uniforms && m.uniforms.map && m.uniforms.map.value) || m.map || null; }
  function setMap(m, t) { if (m.uniforms && m.uniforms.map) m.uniforms.map.value = t; if (m.map !== undefined) m.map = t; }
  function applyRule(m, r, cache) {
    const col = colorOf(m);
    if (r.color != null && col && col.isColor) col.set(r.color);
    if (r.tint && col && col.isColor) col.multiply(_c.setRGB(r.tint[0], r.tint[1], r.tint[2]));
    if (r.set) {
      for (const k in r.set) {
        const v = r.set[k];
        if (k === 'emissive') { if (m.emissive) m.emissive.set(v); }
        else if (k === 'side') m.side = v === 'double' ? T.DoubleSide : v === 'back' ? T.BackSide : T.FrontSide;
        else if (k in m) m[k] = v;
      }
    }
    if (r.grade) { const mp = mapOf(m); if (mp) setMap(m, P1.gradeTexture(mp, r.grade, cache)); }
  }
  function applyAppearance(model, cfg) {
    const rules = cfg.rules; if (!rules.length) return;
    const uses = new Map(), cache = new Map();
    model.traverse(function (o) { if (o.isMesh) [].concat(o.material).forEach(function (m) { uses.set(m, (uses.get(m) || 0) + 1); }); });
    model.traverse(function (o) {
      if (!o.isMesh) return;
      const mats = [].concat(o.material);
      const matched = rules.filter(function (r) {
        return (!r.mesh || r.mesh.test(o.name)) && (!r.mat || mats.some(function (m) { return r.mat.test(m.name || ''); }));
      });
      if (!matched.length) return;
      const out = mats.map(function (m) {
        let mm = m;
        if (uses.get(m) > 1) { try { mm = m.clone(); } catch (e) { mm = m; } }
        matched.forEach(function (r) { applyRule(mm, r, cache); });
        return mm;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
  }
  // KHR_materials_unlit (MeshBasicMaterial) ignores the torch and moon: swap for a lit standard material.
  function convertUnlit(model) {
    model.traverse(function (o) {
      if (!o.isMesh) return;
      const out = [].concat(o.material).map(function (m) {
        if (!m.isMeshBasicMaterial) return m;
        const n = new T.MeshStandardMaterial({ map: m.map, color: m.color.clone(), roughness: 0.92, metalness: 0, side: m.side, alphaTest: m.alphaTest });
        n.skinning = !!o.isSkinnedMesh; m.dispose(); return n;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
  }

  /* SAAYA: dark glossy Phong body + view-dependent rim glow injected into the emissive term.
   * Under the torch the body lights up (diffuse + sheen); with no light the rim still outlines the figure. */
  function shadowPhong(S, color, map, alphaTest) {
    const m = new T.MeshPhongMaterial({ color: color, specular: S.specular, shininess: S.shininess, emissive: S.emissive, side: T.DoubleSide });
    if (map) m.map = map;
    if (alphaTest) m.alphaTest = alphaTest;
    m.skinning = true;
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uRim = { value: new T.Color(S.rimColor) };
      sh.uniforms.uRimPow = { value: S.rimPower };
      sh.uniforms.uRimStr = { value: S.rimStrength };
      sh.uniforms.uPulse = { value: S.rimPulse };
      sh.uniforms.uTime = shadowTime;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uRim; uniform float uRimPow; uniform float uRimStr; uniform float uPulse; uniform float uTime;')
        .replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n' +
          '  float p1Rim = pow( 1.0 - clamp( dot( normalize( normal ), normalize( vViewPosition ) ), 0.0, 1.0 ), uRimPow );\n' +
          '  totalEmissiveRadiance += uRim * p1Rim * uRimStr * ( 1.0 + uPulse * sin( uTime * 1.7 ) );');
      if (sh.fragmentShader.indexOf('p1Rim') < 0 && !shadowPhong.warned) { shadowPhong.warned = true; P1.warn('SAAYA rim-glow injection did not apply (shader chunk names differ from r128?) — she will be torch-lit only'); }
    };
    m.customProgramCacheKey = function () { return 'p1-shadow-entity'; };
    return m;
  }
  function makeShadowEntity(model) {
    const S = P1.config.saaya, body = shadowPhong(S, S.bodyColor), eyes = [];
    model.traverse(function (o) {
      if (!o.isMesh) return;
      const out = [].concat(o.material).map(function (m) {
        if (S.eyeMat && m.name === S.eyeMat) {
          const e = new T.MeshBasicMaterial({ map: m.map, color: S.eyeColor }); e.skinning = !!o.isSkinnedMesh;
          e.color.multiplyScalar(S.eyeDim == null ? 1 : S.eyeDim); e.userData.eyeBase = e.color.clone(); eyes.push(e); return e;
        }
        if (m.transparent || m.alphaTest > 0) return shadowPhong(S, S.hairColor, m.map, 0.4);   // hair / lashes: keep the cut-out, make it black
        return body;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    return eyes;
  }

  /* ------------------------------------------------------------------ idle */
  function axesFor(node, holder) {
    holder.getWorldQuaternion(_wq);
    const pq = new T.Quaternion(); if (node.parent) node.parent.getWorldQuaternion(pq); pq.invert();
    const f = function (x, y, z) { return new T.Vector3(x, y, z).applyQuaternion(_wq).applyQuaternion(pq).normalize(); };
    return { x: f(1, 0, 0), y: f(0, 1, 0), z: f(0, 0, 1) };
  }
  function boneIdle(b, holder) {
    if (!b) return null;
    return { node: b, base: b.quaternion.clone(), baseScale: b.scale.clone(), ax: axesFor(b, holder) };
  }
  const _q1 = new T.Quaternion(), _q2 = new T.Quaternion(), _q3 = new T.Quaternion();
  function rot(b, pitch, yaw, roll) {
    _q1.setFromAxisAngle(b.ax.x, pitch); _q2.setFromAxisAngle(b.ax.y, yaw); _q3.setFromAxisAngle(b.ax.z, roll);
    b.node.quaternion.copy(b.base).premultiply(_q3).premultiply(_q1).premultiply(_q2);
  }
  function setupIdle(slot, rig, model, fix, holder) {
    const cfg = slot.cfg;
    slot.idle = { mode: 'none' };
    if (cfg.anim) return; // the supplied animation provides the motion
    if (rig.bones.length && (rig.chest || rig.head)) {
      holder.updateMatrixWorld(true);
      slot.idle = { mode: 'bones', chest: boneIdle(rig.chest, holder), neck: boneIdle(rig.neck, holder), head: boneIdle(rig.head, holder),
                    hips: boneIdle(rig.hips, holder), armL: boneIdle(rig.arms.l, holder), armR: boneIdle(rig.arms.r, holder) };
      return;
    }
    // static (un-rigged) mesh: breathing by scaling about the feet + weight shift; head turn only if the head is a separate mesh
    slot.idle = { mode: 'static', pivot: null };
    if (cfg.headParts) {
      const parts = []; let headMesh = null;
      model.traverse(function (o) { if (o.isMesh && cfg.headParts.test(o.name)) { parts.push(o); if (/Skin_Head/.test(o.name)) headMesh = o; } });
      if (headMesh) {
        const hb = new T.Box3().setFromObject(headMesh), sz = hb.getSize(new T.Vector3()), c = hb.getCenter(new T.Vector3());
        const world3 = new T.Vector3(c.x, hb.min.y + sz.y * 0.18, c.z);
        const pivot = new T.Group(); fix.add(pivot); pivot.position.copy(fix.worldToLocal(world3)); pivot.updateMatrixWorld(true);
        parts.forEach(function (p) { pivot.attach(p); });   // NOTE: these leave `model`'s subtree -> unload() disposes the whole holder
        slot.idle.pivot = pivot;
      }
    }
  }
  function idleUpdate(slot, t) {
    const idle = slot.idle; if (!idle || idle.mode === 'none') return;
    const k = slot.cfg.idleRate || 1, tt = t * k + slot.phase, eerie = slot.cfg.shadow ? 2.2 : 1;
    const br = Math.sin(tt * 1.45);                                           // ~4.3 s breath
    const sw = Math.sin(tt * 0.37) * 0.6 + Math.sin(tt * 0.91 + 1.3) * 0.4;    // slow look left/right
    const nod = Math.sin(tt * 0.53 + 0.7), tilt = Math.sin(tt * 0.29);
    const shift = Math.sin(tt * 0.21) * 0.7 + Math.sin(tt * 0.57 + 2.0) * 0.3;   // weight shift from foot to foot (~30 s)
    const glance = Math.max(0, Math.sin(tt * 0.13 + 1.0)) ** 6;                  // occasional longer look to the side
    if (idle.mode === 'bones') {
      if (idle.hips) rot(idle.hips, 0.006 * br, 0.03 * shift, 0.028 * shift);
      if (idle.chest) { rot(idle.chest, 0.02 * br, 0.03 * Math.sin(tt * 0.31) - 0.02 * shift, -0.02 * shift); idle.chest.node.scale.copy(idle.chest.baseScale).multiplyScalar(1 + 0.008 * br); }
      if (idle.neck) rot(idle.neck, 0.02 * nod, 0.07 * sw + 0.12 * glance, 0.02 * tilt * eerie);
      if (idle.head) rot(idle.head, 0.035 * nod, 0.10 * sw + 0.18 * glance, 0.03 * tilt * eerie);
      if (idle.armL) rot(idle.armL, 0.05 * Math.sin(tt * 0.9) + 0.02 * br, 0, 0.03 * Math.sin(tt * 0.45) + 0.02 * shift);
      if (idle.armR) rot(idle.armR, -0.05 * Math.sin(tt * 0.9 + 0.8) + 0.02 * br, 0, -0.03 * Math.sin(tt * 0.45 + 1.1) + 0.02 * shift);
    } else {
      slot.sway.scale.set(1 - 0.003 * br, 1 + 0.006 * br, 1 - 0.003 * br);
      slot.sway.rotation.z = 0.014 * shift + 0.004 * Math.sin(tt * 0.31);
      slot.sway.rotation.x = 0.006 * Math.sin(tt * 0.23 + 0.5);
      slot.sway.rotation.y = 0.025 * Math.sin(tt * 0.17);
      if (idle.pivot) { idle.pivot.rotation.y = 0.12 * sw + 0.2 * glance; idle.pivot.rotation.x = 0.04 * nod; }
    }
    if (slot.eyeMats) {   // SAAYA: dim eyes that flicker slowly and now and then nearly go out
      const S = P1.config.saaya, f = 1 - (S.eyeFlicker || 0) * (0.5 + 0.5 * Math.sin(tt * 2.3) * Math.sin(tt * 0.77 + 1.0));
      for (let i = 0; i < slot.eyeMats.length; i++) { const e = slot.eyeMats[i]; e.color.copy(e.userData.eyeBase).multiplyScalar(f); }
    }
  }

  /* ------------------------------------------------------------------ build / unload */
  function build(slot, gltf) {
    const cfg = slot.cfg, model = gltf.scene, info = { spawn: slot.spawnInfo };
    const holder = new T.Group(), sway = new T.Group(), fix = new T.Group();
    holder.add(sway); sway.add(fix); fix.add(model);
    try {
      model.traverse(function (o) {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = false;
        if (o.isSkinnedMesh) o.frustumCulled = false;
        if (cfg.hide && cfg.hide.test(o.name)) o.visible = false;
      });
      holder.updateMatrixWorld(true);
      const rig = collectBones(model);
      info.bones = rig.bones.length;
      if (rig.hips && rig.head) orient(fix, rig, info); else if (rig.bones.length) info.faceFix = 'none (hips/head bones not found)';
      if (cfg.unlit) convertUnlit(model);
      let eyeMats = null;
      if (cfg.shadow && !P1.config.saaya.ownLook) eyeMats = makeShadowEntity(model); else applyAppearance(model, cfg);   // r4: ownLook = keep the new SAAYA model's own textures
      if (cfg.relax && rig.bones.length && !cfg.anim) relaxArms(rig, model, info);
      if (cfg.shadow && P1.config.saaya.stretch) { const st = P1.config.saaya.stretch; sway.scale.set(st[0], st[1], st[2]); }

      let box = P1.measure(model);
      const sx = sway.scale.x || 1, sy = sway.scale.y || 1, sz = sway.scale.z || 1;
      const h0 = (box.max.y - box.min.y) / sy;
      if (!(h0 > 0) || !isFinite(h0)) throw new Error('model has empty bounds');
      const s = cfg.height / h0;
      fix.scale.setScalar(s); holder.updateMatrixWorld(true);
      box = P1.measure(model);
      // box is in world space with sway's stretch applied -> convert back to fix-local metres
      fix.position.set(-(box.min.x + box.max.x) / 2 / sx, -box.min.y / sy, -(box.min.z + box.max.z) / 2 / sz);
      holder.position.set(slot.px, slot.py, slot.pz); holder.rotation.y = slot.yaw;
      const r = 0.42 * (cfg.height / 1.7) + 0.08;
      holder.add(P1.blobShadow(r * 2, r * 2));
      world.scene.add(holder); holder.updateMatrixWorld(true);

      slot.holder = holder; slot.sway = sway; slot.fix = fix; slot.model = model; slot.url = cfg.url;
      slot.phase = Math.random() * 6.28; slot.eyeMats = eyeMats;
      setupIdle(slot, rig, model, fix, holder);

      if (cfg.anim) {
        const clip = gltf.animations.find(function (c) { return c.name === cfg.anim; });
        if (clip) { slot.mixer = new T.AnimationMixer(model); slot.mixer.clipAction(clip).play(); slot.mixer.setTime(Math.random() * clip.duration); }
        else P1.warn(cfg.id + ': clip "' + cfg.anim + '" not found; standing still');
      }
      slot.clips = gltf.animations;           // kept for later phases (walk etc.); NOT played in Phase 1
      info.scale = +s.toFixed(4); info.height = +cfg.height.toFixed(2); info.idle = slot.idle.mode + (cfg.anim && slot.mixer ? '+clip' : '');
      P1.info[cfg.id] = info;
    } catch (e) {            // never leave a half-built holder in the scene
      if (holder.parent) holder.parent.remove(holder);
      P1.dispose(holder); slot.holder = slot.model = slot.mixer = slot.idle = slot.sway = slot.fix = null;
      throw e;
    }
  }

  function unload(slot, why) {
    if (slot.status === 'loading') { slot.cancel = true; return; }
    if (slot.holder) {
      world.scene.remove(slot.holder);
      if (slot.mixer) { slot.mixer.stopAllAction(); slot.mixer.uncacheRoot(slot.model); }
      P1.dispose(slot.holder);   // whole holder, not just gltf.scene: re-parented parts (Dev's head) and cloned/graded materials live outside it
    }
    if (slot.url) P1.assets.release(slot.url);
    slot.holder = slot.model = slot.mixer = slot.idle = slot.sway = slot.fix = slot.eyeMats = null; slot.url = null;
    slot.status = 'idle'; P1.status[slot.cfg.id] = 'idle'; if (why) P1.log('unloaded ' + slot.cfg.id + ' (' + why + ')');
  }

  function fail(slot, e) {
    slot.status = 'error'; P1.status[slot.cfg.id] = 'error: ' + e.message;
    console.error('[P1] ' + slot.cfg.id, e);
    if (world && world.notify) world.notify('⚠ ' + slot.cfg.label + ' load nahi hua (console dekho)');
  }
  function load(slot) {
    slot.status = 'loading'; P1.status[slot.cfg.id] = 'loading'; slot.cancel = false;
    P1.assets.acquire(slot.cfg.url).then(function (g) {
      if (slot.cancel) { P1.assets.release(slot.cfg.url); slot.status = 'idle'; P1.status[slot.cfg.id] = 'idle'; slot.cancel = false; return; }
      try { build(slot, g); slot.status = 'ready'; P1.status[slot.cfg.id] = 'ready'; P1.log('ready ' + slot.cfg.id, P1.info[slot.cfg.id]); }
      catch (e) { P1.assets.release(slot.cfg.url); fail(slot, e); }
    }).catch(function (e) { fail(slot, e); });   // download/parse failure: the manager already dropped the cache entry
  }

  /* ------------------------------------------------------------------ placement (from P1.config.npcs) */
  function anchorXZ(name, spec) {
    const w = world;
    switch (name) {
      case 'world': return { x: 0, z: 0 };
      case 'hut': return { x: w.cc.x, z: w.cc.z };
      case 'spawn': return { x: w.spawn.x, z: w.spawn.z };
      case 'village': { const b = w.villageBox && w.villageBox(); if (b) return { x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2 }; break; }
      case 'entry': { const d = w.doors && w.doors[0]; if (d) return { x: d.x + 2.2, z: d.z }; break; }
      case 'door': { const d = w.doors && w.doors[(spec && spec.door) | 0]; if (d) return { x: d.x, z: d.z }; break; }
    }
    return null;
  }
  function faceTarget(slot, face) {
    face = face || { to: 'spawn' };
    if (face.yaw != null) return { yaw: face.yaw * Math.PI / 180 };
    let t = null;
    if (face.point) t = { x: face.point[0], z: face.point[1] };
    else if (face.to) t = anchorXZ(face.to, face);
    if (!t) t = anchorXZ('spawn');
    return { yaw: Math.atan2(t.x - slot.px, t.z - slot.pz) };
  }
  function placeSlot(slot) {
    const C = P1.config, pc = C.placement, id = slot.cfg.id, cc = world.cc, sp = world.spawn;
    if (P1.cfg.gallery) {
      const g = pc.gallery, i = slots.indexOf(slot);
      slot.px = cc.x + g.dx + i * g.step; slot.pz = cc.z + g.dz; slot.py = 0; slot.yaw = Math.atan2(sp.x - slot.px, sp.z - slot.pz);
      slot.spawnInfo = { anchor: 'gallery', x: +slot.px.toFixed(1), z: +slot.pz.toFixed(1) };
      slot.placed = true; return;
    }
    const n = C.npcs[id];
    let base = anchorXZ(n.anchor, n), anchorUsed = n.anchor;
    if (!base) { P1.warn(id + ': anchor "' + n.anchor + '" unavailable (village doors/box not found) -> using the hut-relative fallback'); base = { x: cc.x + 8, z: cc.z + 28 }; anchorUsed = n.anchor + '->fallback'; }
    const x0 = base.x + n.x, z0 = base.z + n.z;
    let best = null, tries = 0, snapped = false;
    if (n.snap === false) best = { x: x0, z: z0 };
    else {
      outer: for (let ri = 0; ri < pc.searchRings.length; ri++) {
        const cnt = ri === 0 ? 1 : 8;
        for (let k = 0; k < cnt; k++) {
          const a = k / cnt * 6.2832, x = x0 + Math.cos(a) * pc.searchRings[ri], z = z0 + Math.sin(a) * pc.searchRings[ri]; tries++;
          if (!world.clear(x, z, pc.clearRadius)) continue;
          if (slots.some(function (o) { return o !== slot && o.placed && P1.distXZ(o.px, o.pz, x, z) < pc.minSpacing; })) continue;
          if (P1.distXZ(x, z, sp.x, sp.z) < pc.minFromSpawn) continue;
          best = { x: x, z: z }; snapped = ri > 0; break outer;
        }
      }
      if (!best) { best = { x: x0, z: z0 }; P1.warn(id + ': no clear spot within ' + pc.searchRings[pc.searchRings.length - 1] + ' m of the target; using the target as-is'); }
    }
    slot.px = best.x; slot.pz = best.z; slot.py = world.ground(best.x, best.z);
    if (n.snap === false && !world.clear(best.x, best.z, pc.clearRadius)) P1.warn(id + ': exact spawn (' + best.x.toFixed(1) + ', ' + best.z.toFixed(1) + ') looks blocked (snap:false -> not moved)');
    const f = faceTarget(slot, n.face); slot.yaw = f.yaw;
    slot.spawnInfo = { anchor: anchorUsed, x: +slot.px.toFixed(1), z: +slot.pz.toFixed(1), yawDeg: Math.round(f.yaw * 57.2958), snapped: snapped, tried: tries };
    slot.placed = true;
    P1.log('spawn ' + id, slot.spawnInfo);
    if (P1.cfg.spawns) {
      addMarker(slot);
      if (id === 'saaya') (C.saayaEncounters || []).slice(1).forEach(function (e, i) {
        addMarker({ px: e.x, pz: e.z, py: world.ground(e.x, e.z), yaw: e.face && e.face.yaw != null ? e.face.yaw * Math.PI / 180 : 0 }, 6 + i);
      });
    }
  }
  // ?spawns: a coloured pole (spawn point) with a cone pointing where the NPC will face
  let mk = null;
  function addMarker(slot, idx) {
    if (!mk) mk = { pole: new T.CylinderGeometry(0.05, 0.05, 2.2, 6), cone: new T.ConeGeometry(0.18, 0.5, 8).rotateX(Math.PI / 2) };
    const col = new T.Color().setHSL((idx != null ? idx : slots.indexOf(slot)) / 10, 0.9, 0.55);
    const g = new T.Group(), m = new T.MeshBasicMaterial({ color: col, fog: false });
    const pole = new T.Mesh(mk.pole, m); pole.position.y = 1.1; g.add(pole);
    const cone = new T.Mesh(mk.cone, m); cone.position.set(0, 1.9, 0.35); g.add(cone);
    g.position.set(slot.px, slot.py, slot.pz); g.rotation.y = slot.yaw;
    world.scene.add(g); slot.marker = g;   // debug-only helper, shared geometry, lives for the whole session
  }

  /* ------------------------------------------------------------------ public API */
  P1.characters = {
    list: function () { return slots; },
    get: function (id) { return slots.find(function (s) { return s.cfg.id === id; }); },
    // later phases: move / re-face a character
    teleport: function (id, x, z, yawDeg) {
      const s = this.get(id); if (!s) return; s.px = x; s.pz = z; s.py = world.ground(x, z); if (yawDeg != null) s.yaw = yawDeg * Math.PI / 180;
      if (s.holder) { s.holder.position.set(s.px, s.py, s.pz); s.holder.rotation.y = s.yaw; }
      if (s.marker) { s.marker.position.set(s.px, s.py, s.pz); s.marker.rotation.y = s.yaw; }
    },
    unloadAll: function () { slots.forEach(function (s) { if (s.status === 'ready') unload(s, 'unloadAll'); else if (s.status === 'loading') s.cancel = true; }); }
  };

  P1.startCharacters = function (w) {
    world = w;
    const problems = P1.validateConfig();
    problems.forEach(function (p) { P1.warn('config: ' + p); });
    ROSTER.forEach(function (r) {
      const a = (P1.config.appearance || {})[r.id] || {};
      const cfg = Object.assign({}, a, { id: r.id, label: r.label, url: r.url,
        height: a.height > 0 ? a.height : 1.7, hide: P1.rx(a.hide), headParts: P1.rx(a.headParts),
        rules: (a.materials || []).map(function (m) { return Object.assign({}, m, { mesh: P1.rx(m.mesh), mat: P1.rx(m.mat) }); }) });
      slots.push({ cfg: cfg, status: 'idle', placed: false });
      P1.status[r.id] = 'idle';
    });
    return problems;
  };

  P1.updateCharacters = function (dt, pos) {
    if (!world) return;
    time += dt; tickT -= dt; shadowTime.value = time;
    if (tickT <= 0) {
      tickT = 0.35;
      // one placement search per tick keeps the frame time flat
      const un = slots.find(function (s) { return !s.placed; });
      if (un) { placeSlot(un); }
      else {
        let loading = 0, ready = [];
        slots.forEach(function (s) {
          s.d = P1.distXZ(pos.x, pos.z, s.px, s.pz);
          if (P1.info[s.cfg.id]) P1.info[s.cfg.id].dist = Math.round(s.d);
          if (s.status === 'loading') loading++;
          if (s.status === 'ready') ready.push(s);
        });
        if (!P1.cfg.gallery) ready.forEach(function (s) { if (s.d > P1.cfg.unloadRadius) unload(s, 'far away'); });
        ready = ready.filter(function (s) { return s.status === 'ready'; });
        if (!loading) {
          const cand = slots.filter(function (s) { return s.status === 'idle' && (P1.cfg.gallery || s.d < P1.cfg.loadRadius); })
                            .sort(function (a, b) { return a.d - b.d; })[0];
          if (cand) {
            if (!P1.cfg.gallery && ready.length >= P1.cfg.maxResident) {
              const far = ready.sort(function (a, b) { return b.d - a.d; })[0];
              if (far.d > cand.d) { unload(far, 'memory cap'); load(cand); }
            } else load(cand);
          }
        }
      }
    }
    const r2 = P1.cfg.idleRadius * P1.cfg.idleRadius;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]; if (s.status !== 'ready' || !s.holder) continue;
      const dx = pos.x - s.px, dz = pos.z - s.pz;
      if (dx * dx + dz * dz > r2) continue;
      if (s.mixer) s.mixer.update(dt);
      idleUpdate(s, time);
    }
  };

  // circle colliders, same push-out idea as the game's tree collision
  P1.collideCharacters = function (pos) {
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]; if (s.status !== 'ready') continue;
      const dx = pos.x - s.px, dz = pos.z - s.pz, d = Math.hypot(dx, dz), m = 0.38 + 0.35;
      if (d < m && d > 1e-4) { pos.x = s.px + dx / d * m; pos.z = s.pz + dz / d * m; }
    }
  };
})();

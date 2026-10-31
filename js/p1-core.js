/* THE LAST VILLAGE — Phase 1 core (Three.js r128, classic script, no modules).
 * Config, asset manager (de-duplicated, sequential loading, reference-counted disposal),
 * cheap blob shadows and measuring helpers. Safe to load even if later modules fail. */
(function () {
  'use strict';
  const P1 = (window.P1 = window.P1 || {});
  const QS = location.search;

  P1.VERSION = 'phase1-r3-corrections-untested';
  P1.cfg = {
    loadRadius: 30,        // metres: start loading a character when the player is this close
    unloadRadius: 46,      // metres: dispose a character when the player is farther than this
    maxResident: 4,        // never keep more than this many characters in memory at once
    idleRadius: 22,        // procedural idle / mixer only runs inside this distance
    maxConcurrentLoads: 1, // GLB parsing is sequential so phones never decode several heavy files at once
    debug: /[?&]debug\b/.test(QS),
    gallery: /[?&]gallery\b/.test(QS),   // QA mode: line every character up near the spawn point
    spawns: /[?&]spawns\b/.test(QS),     // QA mode: draw a coloured pole + facing cone at every NPC spawn point
    car: {
      url: 'assets/vehicles/sedan.glb',
      lengthM: 4.6,          // real sedan length used to normalise the model
      dx: 3.4, dz: 10.2,     // offset from the hut centre (cc) -> inside the cleared area near the spawn point
      yaw: 2.2,              // radians, rotation about Y (model front is +Z)
      hoodDeg: 12,           // hood popped open by the crash (0 = closed)
      ajarFront: 0.3,        // front door on the -X side left ajar (0 closed .. 1 fully open)
      doorOpenDeg: 55,
      straightenWheels: true,    // re-aim every tyre's axle along the car's own axle (front-right wheel is yawed ~25 deg in the source)
      restoreMissingWheel: true, // the source has NO front-left tyre: clone the rear-left one into that corner
      showBrakeDisc: true,       // keep the lone brake disc from the source, moved onto the restored wheel's axle
      lights: /[?&]carlights\b/.test(QS)  // OFF by default: lamp positions are estimated, not verified
    }
  };

  P1.log = function () { console.log.apply(console, ['[P1]'].concat([].slice.call(arguments))); };
  P1.warn = function () { console.warn.apply(console, ['[P1]'].concat([].slice.call(arguments))); };
  P1.status = {}; // id -> 'idle' | 'loading' | 'ready' | 'error: ...'
  P1.info = {};   // id -> diagnostics (height, scale, bones, ...)

  /* ---------- disposal ---------- */
  function disposeMaterial(m) {
    if (!m) return;
    for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
    if (m.uniforms) for (const k in m.uniforms) { const u = m.uniforms[k]; const v = u && u.value; if (v && v.isTexture) v.dispose(); }
    if (m.dispose) m.dispose();
  }
  P1.disposeMaterial = disposeMaterial;
  P1.dispose = function (root) {
    root.traverse(function (o) {
      if (o.userData && o.userData.isShadow) return; // shared geometry/material
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(disposeMaterial);
      if (o.isSkinnedMesh && o.skeleton && o.skeleton.dispose) o.skeleton.dispose();
    });
  };

  /* ---------- asset manager: one load per URL, sequential queue, refcounted release ---------- */
  const cache = new Map(), queue = [];
  let active = 0;
  function loader() { return P1._gl || (P1._gl = new THREE.GLTFLoader()); }
  function pump() { while (active < P1.cfg.maxConcurrentLoads && queue.length) queue.shift()(); }
  P1.assets = {
    acquire: function (url) {
      let e = cache.get(url);
      if (!e) {
        e = { refs: 0, gltf: null, promise: null };
        cache.set(url, e);
        const entry = e;
        entry.promise = new Promise(function (res, rej) {
          queue.push(function () {
            active++;
            loader().load(url, function (g) {
              active--; entry.gltf = g;
              if (cache.get(url) !== entry) P1.dispose(g.scene); // released while loading
              res(g); pump();
            }, undefined, function (err) {
              active--; if (cache.get(url) === entry) cache.delete(url);
              rej(new Error('failed to load ' + url + (err && err.message ? ': ' + err.message : ''))); pump();
            });
          });
          pump();
        });
      }
      e.refs++;
      return e.promise;
    },
    release: function (url) {
      const e = cache.get(url); if (!e) return;
      if (--e.refs > 0) return;
      cache.delete(url);
      if (e.gltf) { P1.dispose(e.gltf.scene); e.gltf = null; }
    },
    count: function () { return cache.size; }
  };

  /* ---------- blob shadow (real shadow maps are too expensive for mid-range phones) ---------- */
  let sh = null;
  P1.blobShadow = function (w, l) {
    if (!sh) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      sh = {
        geo: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        mat: new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.6 })
      };
    }
    const m = new THREE.Mesh(sh.geo, sh.mat);
    m.scale.set(w, 1, l == null ? w : l); m.position.y = 0.03; m.renderOrder = -1; m.userData.isShadow = true;
    return m;
  };

  /* ---------- measuring: bounding box of VISIBLE meshes. Skinned meshes are measured from the REAL skinned vertex positions
   * (skeleton.update() + SkinnedMesh.boneTransform), not from geometry-box x matrixWorld: for rigs whose mesh node carries a
   * 0.01 scale (Kamla Devi) the old method under-measured the height ~4x, which made her ~6 m tall. ---------- */
  const _b = new THREE.Box3(), _v = new THREE.Vector3();
  P1.measure = function (root) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    root.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      let n = o;
      while (n) { if (!n.visible) return; if (n === root) break; n = n.parent; }
      const pos = o.geometry.attributes.position;
      if (o.isSkinnedMesh && o.skeleton && o.boneTransform && pos) {
        o.skeleton.update();
        for (let i = 0; i < pos.count; i++) { o.boneTransform(i, _v); _v.applyMatrix4(o.matrixWorld); box.expandByPoint(_v); }
        return;
      }
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      _b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      box.union(_b);
    });
    return box;
  };

  // config helper: 'foo|bar' -> /foo|bar/i ; '/foo/g' -> /foo/g ; RegExp passes through ; null -> null
  P1.rx = function (spec) {
    if (spec == null || spec === '') return null;
    if (spec instanceof RegExp) return spec;
    const m = /^\/(.*)\/([a-z]*)$/.exec(String(spec));
    return m ? new RegExp(m[1], m[2]) : new RegExp(String(spec), 'i');
  };

  /* ---------- optional runtime texture grading (saturation / brightness / contrast / fade / tint) ----------
   * Returns a NEW CanvasTexture (the original is untouched). Cached per source texture + settings. */
  P1.gradeTexture = function (tex, g, cache) {
    const img = tex && tex.image;
    if (!img || !(img.width > 0)) return tex;
    const key = tex.uuid + JSON.stringify(g);
    if (cache && cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
    const sat = g.saturation == null ? 1 : g.saturation, br = g.brightness == null ? 1 : g.brightness,
          ct = g.contrast == null ? 1 : g.contrast, fade = g.fade || 0, tn = g.tint || [1, 1, 1];
    for (let i = 0; i < a.length; i += 4) {
      const l = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
      for (let k = 0; k < 3; k++) {
        let v = l + (a[i + k] - l) * sat;
        v = ((v - 128) * ct + 128) * br * tn[k];
        v = v + (170 - v) * fade;
        a[i + k] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    x.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.name = tex.name; t.encoding = tex.encoding; t.flipY = tex.flipY; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
    t.minFilter = tex.minFilter; t.magFilter = tex.magFilter; t.anisotropy = tex.anisotropy;
    t.offset.copy(tex.offset); t.repeat.copy(tex.repeat); t.center.copy(tex.center); t.rotation = tex.rotation;
    t.needsUpdate = true;
    if (cache) cache.set(key, t);
    return t;
  };

  P1.distXZ = function (ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); };

  /* ---------- optional on-screen diagnostics: add ?debug to the URL ---------- */
  let dbg = null, dbgT = 0;
  P1.debugTick = function (dt) {
    if (!P1.cfg.debug) return;
    dbgT -= dt; if (dbgT > 0) return; dbgT = 0.5;
    if (!dbg) {
      dbg = document.createElement('pre');
      dbg.style.cssText = 'position:fixed;left:6px;top:calc(env(safe-area-inset-top,0px) + 6px);z-index:30;margin:0;font:10px/1.25 monospace;color:#9f9;background:rgba(0,0,0,.55);padding:4px 6px;pointer-events:none;max-width:70vw;white-space:pre-wrap';
      document.body.appendChild(dbg);
    }
    let s = 'P1 ' + P1.VERSION + ' | assets cached: ' + P1.assets.count() + '\n';
    if (window.__hutFix) { const h = window.__hutFix; s += 'hut: base ' + h.base + ' (old pivot ' + h.oldPivot + ') ground ' + h.ground + ' sink ' + h.sink + ' shift ' + h.shift + ' m [' + h.method + ']\n'; }
    for (const id in P1.status) {
      const i = P1.info[id];
      s += id + ': ' + P1.status[id] + (i ? ' h=' + i.height + 'm s=' + i.scale + (i.dist != null ? ' d=' + i.dist : '') + (i.spawn ? ' @' + i.spawn.x + ',' + i.spawn.z + (i.spawn.snapped ? ' (snapped)' : '') : '') : '') + '\n';
    }
    dbg.textContent = s;
  };
})();

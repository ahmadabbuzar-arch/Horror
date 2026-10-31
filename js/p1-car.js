/* THE LAST VILLAGE — Phase 1 car (Three.js r128). Depends on p1-core.js.
 * Places the supplied abandoned sedan as the player's damaged car near the opening accident spot.
 * No driving, physics or repair gameplay. Exposes parts (doors, hood, trunk, wheels) for later phases.
 *
 * Facts about the supplied model (measured, see docs/MODEL_INSPECTION.md):
 *  - body 21.56 model units long (+Z = front) => scale to 4.6 m; Y up; wheels' axles along X.
 *  - it ships pre-posed: hood raised ~54 deg, trunk ~36 deg, doors ajar. Wheels (verified from real vertices, r2):
 *    rear -X / rear +X are fine, front +X is yawed ~25 deg off the car's axle, the front -X tyre is MISSING (only a
 *    54-vertex brake disc remains, sagged 0.55 units). r2 straightens all tyres and clones the rear -X tyre into the gap.
 *  - every part is a separate node; all share one material. There is NO separate glass or lamp mesh. */
(function () {
  'use strict';
  const P1 = window.P1;
  const T = THREE;
  const AX_Y = new T.Vector3(0, 1, 0), AX_X = new T.Vector3(1, 0, 0);
  const DEG = Math.PI / 180;
  const norm = function (s) { return String(s || '').replace(/[^A-Za-z0-9]/g, ''); };
  const smooth = function (a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const hash = function (x, y, z) { const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return n - Math.floor(n); };

  P1.car = { ready: false, circles: [] };

  function firstMesh(o) { let m = null; o.traverse(function (c) { if (c.isMesh && !m) m = c; }); return m; }

  // crash damage: crumple everything beyond `start` along local +Z. Deterministic, so split vertices stay welded.
  function crumple(mesh, start, end, depth, lift) {
    const geo = mesh.geometry, pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), f = smooth(start, end, z);
      if (f <= 0) continue;
      const k = 0.55 + 0.45 * hash(Math.round(x * 2), Math.round(y * 2), 0);
      pos.setXYZ(i, x * (1 - 0.05 * f), y - lift * f * k, z - depth * f * k);
    }
    finishGeo(geo, pos);
  }
  // one crushed front fender on the +X side
  function fenderDent(mesh) {
    const geo = mesh.geometry, pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const g = smooth(1.8, 3.6, x) * smooth(1.5, 4, z) * (1 - smooth(8, 9.5, z));
      if (g > 0) pos.setX(i, x - 0.45 * g * (0.6 + 0.4 * hash(Math.round(y * 3), Math.round(z * 3), 1)));
    }
    finishGeo(geo, pos);
  }
  function finishGeo(geo, pos) {
    (pos.isInterleavedBufferAttribute ? pos.data : pos).needsUpdate = true;
    geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
  }
  // grime / soot via vertex colours (all parts share one material, so every mesh gets a colour attribute)
  function grime(mesh, rel, sootFrontZ) {
    const geo = mesh.geometry, pos = geo.attributes.position, n = pos.count, col = new Float32Array(n * 3), v = new T.Vector3();
    for (let i = 0; i < n; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const lz = v.z; v.applyMatrix4(rel);
      let c = 0.9 * (0.55 + 0.45 * smooth(0.4, 4.2, v.y)) * (0.94 + 0.12 * hash(i * 0.37, i * 0.11, 3));
      if (sootFrontZ != null && lz > sootFrontZ) c *= 1 - 0.45 * smooth(sootFrontZ, sootFrontZ + 2.4, lz);
      col[i * 3] = c; col[i * 3 + 1] = c * 0.97; col[i * 3 + 2] = c * 0.92;
    }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    [].concat(mesh.material).forEach(function (m) { m.vertexColors = true; m.needsUpdate = true; });
  }

  function buildCar(w, gltf) {
    const cfg = P1.cfg.car, model = gltf.scene;
    const holder = new T.Group(), sc = new T.Group();
    holder.add(sc); sc.add(model); holder.updateMatrixWorld(true);

    // ---- find the parts (GLTFLoader strips spaces/dots from names, so compare alphanumerics only)
    const parts = { doors: [], wheels: [] };
    model.traverse(function (o) {
      if (o.isMesh) return;
      const n = norm(o.name);
      if (/^KUZA/.test(n)) parts.body = o;
      else if (/^KAPOT/.test(n)) parts.hood = o;
      else if (/^BAQAJ/.test(n)) parts.trunk = o;
      else if (/^(ON|ARXA)QAPI/.test(n)) parts.doors.push(o);
      else if (/^TEKER/.test(n)) parts.wheels.push(o);
    });
    if (!parts.body) throw new Error('car body node (KUZA) not found');

    // ---- real-world scale from the body length, then ground from the wheels
    const bb = new T.Box3().setFromObject(parts.body), len = bb.max.z - bb.min.z;
    if (!(len > 0)) throw new Error('car body has empty bounds');
    const s = cfg.lengthM / len; sc.scale.setScalar(s); holder.updateMatrixWorld(true);
    // ---- wheels: straighten, restore the missing front tyre, then ground the car on the true tyre radius
    // (note: a world-space AABB of a spun wheel is inflated; r1 used it and mis-reported a "sunk wheel" — r2 uses geometry bounds)
    const bodyX = new T.Vector3(1, 0, 0).applyQuaternion(parts.body.getWorldQuaternion(new T.Quaternion())).normalize();
    const wl = parts.wheels.map(function (o) {
      const m = firstMesh(o), g = m && m.geometry;
      if (g && !g.boundingBox) g.computeBoundingBox();
      return { node: o, geo: g, verts: g ? g.attributes.position.count : 0, c: sc.worldToLocal(o.getWorldPosition(new T.Vector3())) };
    });
    const rotor = wl.filter(function (w) { return w.verts < 100; })[0] || null;   // the lone brake disc
    const tyres = wl.filter(function (w) { return w !== rotor; });
    const wheelReport = { tyresInFile: tyres.length, brakeDiscInFile: !!rotor, correctedDeg: [], restored: false };
    const straighten = function (o) {
      sc.attach(o);                                      // o.quaternion is now expressed in car space
      const ax = new T.Vector3(1, 0, 0).applyQuaternion(o.quaternion).normalize();
      const tgt = bodyX.clone().multiplyScalar(ax.dot(bodyX) >= 0 ? 1 : -1), ang = ax.angleTo(tgt);
      if (ang > 0.01) o.quaternion.premultiply(new T.Quaternion().setFromUnitVectors(ax, tgt));
      return +(ang * 57.2958).toFixed(1);
    };
    tyres.forEach(function (w) { wheelReport.correctedDeg.push(cfg.straightenWheels ? straighten(w.node) : (sc.attach(w.node), 0)); });
    const key = function (c) { return (c.z > 0 ? 'F' : 'R') + (c.x < 0 ? '-X' : '+X'); };
    const corner = {}; tyres.forEach(function (w) { corner[key(w.c)] = w; });
    let restored = null;
    if (cfg.restoreMissingWheel && !corner['F-X'] && tyres.length) {
      const donor = corner['R-X'] || tyres[0], front = corner['F+X'] || corner['F-X'];
      const nn = donor.node.clone(true); nn.name = 'WHEEL_F-X_restored'; sc.add(nn);
      if (donor.c.x > 0) nn.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(AX_Y, Math.PI)); // donor from the wrong side: face the rim outwards
      const zF = front ? front.c.z : (rotor ? rotor.c.z : donor.c.z + 12), xL = donor.c.x < 0 ? donor.c.x : -Math.abs(donor.c.x);
      nn.position.set(xL, donor.c.y, zF);
      restored = { node: nn, geo: donor.geo, verts: donor.verts, c: new T.Vector3(xL, donor.c.y, zF) };
      corner['F-X'] = restored; wheelReport.restored = true;
    }
    if (rotor) {
      if (cfg.showBrakeDisc && restored) {                // keep the file's own brake disc: move it onto the restored axle, just inboard
        straighten(rotor.node);
        const cen = new T.Box3().setFromObject(rotor.node).getCenter(new T.Vector3());
        rotor.node.position.add(new T.Vector3(restored.c.x + 0.3, restored.c.y, restored.c.z).sub(cen));
      } else rotor.node.visible = false;
    }
    const radiusOf = function (w) { const g = w.geo && w.geo.boundingBox; return g ? Math.max(g.max.y - g.min.y, g.max.z - g.min.z) / 2 : 1.41; };
    const bottoms = tyres.filter(function (w) { return w !== restored; }).map(function (w) { return w.c.y - radiusOf(w); }).sort(function (a, b) { return a - b; });
    const ground = (bottoms.length ? bottoms[Math.floor(bottoms.length / 2)] : new T.Box3().setFromObject(parts.body).min.y / s); // model units
    sc.position.y = -ground * s; holder.updateMatrixWorld(true);
    parts.wheels = tyres.map(function (w) { return w.node; }); parts.brakeDisc = rotor ? rotor.node : null;

    // ---- damage + grime (before parts are re-parented so the car-frame matrix is simple)
    const inv = new T.Matrix4().copy(sc.matrixWorld).invert(), seen = new Set();
    const bodyMesh = firstMesh(parts.body), hoodMesh = parts.hood && firstMesh(parts.hood);
    try {
      if (bodyMesh) { crumple(bodyMesh, 6.8, 10.2, 1.5, 0.35); fenderDent(bodyMesh); }
      if (hoodMesh) crumple(hoodMesh, 3.4, 5.3, 0.9, 0);
    } catch (e) { P1.warn('car damage step failed (car still usable):', e); }
    holder.traverse(function (o) {   // holder, not model: wheels were re-parented out of the model subtree
      if (!o.isMesh || !o.geometry || seen.has(o.geometry.uuid)) return;
      seen.add(o.geometry.uuid);
      try { o.updateWorldMatrix(true, false); grime(o, new T.Matrix4().multiplyMatrices(inv, o.matrixWorld), o === bodyMesh ? 7.5 : null); }
      catch (e) { P1.warn('grime failed on', o.name, e); }
    });

    // ---- pivots so doors / hood / trunk can swing about their real hinge points
    const _q = new T.Quaternion();
    function pivotize(node) {
      node.updateWorldMatrix(true, false);
      const pv = new T.Group();
      pv.position.copy(sc.worldToLocal(node.getWorldPosition(new T.Vector3())));
      sc.add(pv); pv.updateMatrixWorld(true); pv.attach(node);
      return pv;
    }
    const doors = [];
    parts.doors.forEach(function (d) {
      const centre = new T.Box3().setFromObject(d).getCenter(new T.Vector3());
      const pv = pivotize(d);
      const z = new T.Vector3(0, 0, 1).applyQuaternion(d.quaternion), authored = Math.atan2(z.x, z.z);
      d.quaternion.premultiply(_q.setFromAxisAngle(AX_Y, -authored));          // bake the CLOSED pose (rotation 0 = closed)
      const side = centre.x < 0 ? -1 : 1;
      pv.userData.th = (side < 0 ? 1 : -1) * cfg.doorOpenDeg * DEG;           // outward swing; -X side opens with +yaw
      doors.push({ node: d, pivot: pv, side: side, frontZ: centre.z, authoredDeg: +(authored / DEG).toFixed(1),
                   state: { cur: 0, t: 0, x: 0, z: 0, piv: [pv], isCar: true } });
    });
    let hoodPivot = null, trunkPivot = null;
    if (parts.hood) {
      hoodPivot = pivotize(parts.hood);
      const vy = new T.Vector3(0, 1, 0).applyQuaternion(parts.hood.quaternion), phi = Math.atan2(vy.z, vy.y);
      parts.hood.quaternion.premultiply(_q.setFromAxisAngle(AX_X, -phi));
      hoodPivot.rotation.x = -cfg.hoodDeg * DEG;
    }
    if (parts.trunk) {
      trunkPivot = pivotize(parts.trunk);
      const vy = new T.Vector3(0, 1, 0).applyQuaternion(parts.trunk.quaternion), phi = Math.atan2(vy.z, vy.y);
      parts.trunk.quaternion.premultiply(_q.setFromAxisAngle(AX_X, -phi));
      trunkPivot.rotation.x = 0;
    }
    // front door on the -X side starts ajar
    const lf = doors.filter(function (d) { return d.side < 0; }).sort(function (a, b) { return b.frontZ - a.frontZ; })[0];
    if (lf && cfg.ajarFront > 0) { lf.state.cur = lf.state.t = cfg.ajarFront; lf.pivot.rotation.y = cfg.ajarFront * lf.pivot.userData.th; }

    // ---- optional lamps (OFF unless ?carlights): emissive discs at ESTIMATED lamp positions on the body mesh
    const lamps = [];
    if (bodyMesh) {
      const mk = function (x, y, z, color, flip) {
        const m = new T.Mesh(new T.CircleGeometry(0.5, 14), new T.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.55 }));
        m.position.set(x, y, z); if (flip) m.rotation.y = Math.PI; m.visible = !!cfg.lights; bodyMesh.add(m); lamps.push(m);
      };
      mk(-2.6, 2.6, 10.0, 0xfff2c0, false); mk(2.6, 2.6, 10.0, 0xfff2c0, false);
      mk(-2.7, 2.6, -11.1, 0xff2810, true); mk(2.7, 2.6, -11.1, 0xff2810, true);
    }

    // ---- place in the world
    const cc = w.cc;
    holder.position.set(cc.x + cfg.dx, 0, cc.z + cfg.dz); holder.rotation.y = cfg.yaw;
    const shadow = P1.blobShadow(2.7, 5.9); holder.add(shadow);
    model.traverse(function (o) { if (o.isMesh) o.castShadow = o.receiveShadow = false; });
    w.scene.add(holder); holder.updateMatrixWorld(true);

    // hook the car doors into the game's existing door interaction (button / E key)
    doors.forEach(function (d) {
      const c = new T.Box3().setFromObject(d.node).getCenter(new T.Vector3());
      d.state.x = c.x; d.state.z = c.z; w.addDoor(d.state);
    });
    // 3 circle colliders along the car's axis (same push-out style as the game's tree collision)
    const fx = Math.sin(cfg.yaw), fz = Math.cos(cfg.yaw);
    const circles = [-1.4, 0, 1.4].map(function (o) { return { x: holder.position.x + fx * o, z: holder.position.z + fz * o, r: 0.95 }; });

    const car = P1.car;
    car.ready = true; car.holder = holder; car.model = model; car.scaleGroup = sc; car.parts = parts; car.circles = circles;
    car.doors = doors; car.lamps = lamps; car.scale = s; car.wheelReport = wheelReport;
    car.wheels = { frontNegX: corner['F-X'] && corner['F-X'].node, frontPosX: corner['F+X'] && corner['F+X'].node, rearNegX: corner['R-X'] && corner['R-X'].node, rearPosX: corner['R+X'] && corner['R+X'].node };
    car.setDoor = function (i, v) { const d = doors[i]; if (d) { d.state.t = v; } };
    car.setHood = function (deg) { if (hoodPivot) hoodPivot.rotation.x = -deg * DEG; };
    car.setTrunk = function (deg) { if (trunkPivot) trunkPivot.rotation.x = deg * DEG; };
    car.setLights = function (on) { lamps.forEach(function (m) { m.visible = !!on; }); };
    car.dispose = function () {   // removes the car, its door buttons and ALL GPU resources (parts were re-parented outside gltf.scene, so dispose the holder)
      if (!car.ready) return;
      doors.forEach(function (d) { const i = w.doors.indexOf(d.state); if (i >= 0) w.doors.splice(i, 1); });
      w.scene.remove(holder); P1.dispose(holder); P1.assets.release(cfg.url);
      car.ready = false; car.circles = []; P1.status.car = 'disposed';
    };
    P1.status.car = 'ready';
    P1.info.car = { height: +(new T.Box3().setFromObject(holder).getSize(new T.Vector3()).y).toFixed(2), scale: +s.toFixed(4),
                    doors: doors.length, wheels: parts.wheels.length, wheelsRestored: wheelReport.restored, wheelAxleCorrectionDeg: wheelReport.correctedDeg.join('/'), authoredDoorDeg: doors.map(function (d) { return d.authoredDeg; }).join('/') };
    P1.log('car ready', P1.info.car);
  }

  P1.loadCar = function (w) {
    const url = P1.cfg.car.url;
    P1.status.car = 'loading';
    return P1.assets.acquire(url).then(function (g) {
      try { buildCar(w, g); }
      catch (e) { P1.assets.release(url); P1.status.car = 'error: ' + e.message; console.error('[P1] car build failed', e); if (w.notify) w.notify('⚠ Car load nahi hui (console dekho)'); }
    }).catch(function (e) { P1.status.car = 'error: ' + e.message; console.error('[P1] car', e); if (w.notify) w.notify('⚠ Car load nahi hui (console dekho)'); });
  };

  P1.collideCar = function (pos) {
    const cs = P1.car.circles;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i], dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + 0.35;
      if (d < m && d > 1e-4) { pos.x = c.x + dx / d * m; pos.z = c.z + dz / d * m; }
    }
  };
})();

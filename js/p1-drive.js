/* THE LAST VILLAGE — Phase 1 car driving (r7). Walk up to the sedan, tap "Car chalao" (or press C), drive with the joystick / WASD,
 * tap again to get out. Simple bicycle model, first-person from the driver seat. Uses the car built by p1-car.js (P1.car.holder).
 * index.html hooks: P1.drive.step() replaces walking while active, P1.drive.camPos() puts the camera in the seat. */
(function () {
  'use strict';
  const P1 = window.P1, T = THREE;
  const CFG = P1.cfg.drive = {
    maxFwd: 13, maxRev: 4, acc: 5, brake: 10, drag: 1.2,   // m/s, m/s, m/s^2 ...   (13 m/s = 47 km/h; the car is a crashed wreck, keep it slow)
    wheelBase: 2.7, maxSteer: 0.55,                         // metres, radians
    seat: [-0.42, 1.12, 0.2],                               // driver seat in car-local metres (model front +Z, driver on -X = right-hand side)
    enterDist: 3.6, radius: 1.15, bumpers: 2.4
  };
  const D = P1.drive = { active: false, v: 0, h: 0, steer: 0, off: 0, lastYaw: NaN };
  let btn = null, au = null;
  const ang = function (a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const ok = function () { return P1.car && P1.car.ready && P1.car.holder; };

  function ui() {
    if (btn) return btn;
    btn = document.createElement('button'); btn.id = 'drv';
    btn.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 104px);z-index:10;background:rgba(43,130,217,.92);color:#fff;border:0;font-weight:700;font-size:14px;padding:8px 16px;border-radius:99px;display:none';
    btn.onclick = function (e) { e.stopPropagation(); toggle(); };
    document.body.appendChild(btn);
    addEventListener('keydown', function (e) { if (e.key && e.key.toLowerCase() === 'c') toggle(); });
    return btn;
  }
  function circles() {
    const H = P1.car.holder, hx = H.position.x, hz = H.position.z, s = Math.sin(H.rotation.y), c = Math.cos(H.rotation.y);
    P1.car.circles = [-1.4, 0, 1.4].map(function (o) { return { x: hx + s * o, z: hz + c * o, r: 0.95 }; });
  }
  function engine(on, v) {
    try {
      if (on && !au) {
        const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
        const ctx = new C(), o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 360; o.connect(f); f.connect(g); g.connect(ctx.destination); g.gain.value = 0; o.start();
        au = { ctx: ctx, o: o, g: g };
      }
      if (au) {
        if (au.ctx.state === 'suspended') au.ctx.resume();
        const t = au.ctx.currentTime;
        au.g.gain.setTargetAtTime(on ? 0.04 + Math.min(0.07, Math.abs(v) * 0.006) : 0, t, 0.1);
        au.o.frequency.setTargetAtTime(36 + Math.abs(v) * 6, t, 0.1);
      }
    } catch (e) { /* audio is optional */ }
  }

  function toggle() {
    if (!ok() || !P1.world) return;
    const w = P1.world, H = P1.car.holder;
    if (!D.active) {
      if (Math.hypot(w.pos.x - H.position.x, w.pos.z - H.position.z) > CFG.enterDist) return;
      D.active = true; D.v = 0; D.steer = 0; D.h = H.rotation.y; D.off = 0; D.lastYaw = NaN;
      P1.car.circles = []; if (P1.car.setHood) P1.car.setHood(0);
      w.pos.set(H.position.x, 0, H.position.z);
      if (w.notify) w.notify('🚗 Car mein baith gaye — joystick/WASD se chalao, utarne ke liye button/C');
    } else {
      D.active = false; D.v = 0; engine(false, 0);
      const s = Math.sin(D.h), c = Math.cos(D.h);
      w.pos.set(H.position.x - c * 1.9 + s * 0.2, 0, H.position.z + s * 1.9 + c * 0.2);   // driver side (-X in car space)
      if (P1.car.setHood) P1.car.setHood(P1.cfg.car.hoodDeg || 0);
      circles();
    }
    refresh(w.pos);
  }
  function refresh(pos) {
    const b = ui();
    if (!ok()) { b.style.display = 'none'; return; }
    const near = Math.hypot(pos.x - P1.car.holder.position.x, pos.z - P1.car.holder.position.z) < CFG.enterDist;
    b.style.display = (D.active || near) ? 'block' : 'none';
    if (D.active || near) b.textContent = D.active ? '🚪 Car se utro' + ('ontouchstart' in window ? '' : ' (C)') : '🚗 Car chalao' + ('ontouchstart' in window ? '' : ' (C)');
  }
  P1.driveUI = function (pos) { refresh(pos); };

  // f = throttle (+forward), s = steering (+right), trees = game's tree circles, blocked(x,z,dx,dz,len) = building/hut ray test from index.html
  D.step = function (dt, f, s, pos, trees, yaw, blocked) {
    const H = P1.car.holder;
    let v = D.v;
    if (f > 0.05) v += (v >= 0 ? CFG.acc * f : CFG.brake) * dt;
    else if (f < -0.05) v += (v > 0.3 ? -CFG.brake * -f : CFG.acc * f * 0.6) * dt;
    else v -= Math.sign(v) * Math.min(Math.abs(v), CFG.drag * (1 + Math.abs(v) * 0.15) * dt);
    v = Math.max(-CFG.maxRev, Math.min(CFG.maxFwd, v));
    const target = s * CFG.maxSteer / (1 + Math.abs(v) * 0.15);
    D.steer += (target - D.steer) * Math.min(1, dt * 6);
    D.h += -(v / CFG.wheelBase) * Math.tan(D.steer) * dt;
    const dx = Math.sin(D.h), dz = Math.cos(D.h), sg = v >= 0 ? 1 : -1;
    let nx = H.position.x + dx * v * dt, nz = H.position.z + dz * v * dt;
    if (Math.abs(v) > 0.2 && blocked && blocked(H.position.x, H.position.z, dx * sg, dz * sg, CFG.bumpers + Math.abs(v) * dt)) { v = -v * 0.25; nx = H.position.x; nz = H.position.z; }
    const q = { x: nx, y: 0, z: nz };
    for (const t of trees) {
      const ax = q.x - t.x, az = q.z - t.z, d = Math.hypot(ax, az), m = t.r + 1.0;
      if (d < m && d > 1e-4) { q.x = t.x + ax / d * m; q.z = t.z + az / d * m; v *= 0.5; }
    }
    if (P1.collideProps) { const bx = q.x, bz = q.z; P1.collideProps(q, CFG.radius); if (Math.hypot(q.x - bx, q.z - bz) > 0.01) v *= 0.5; }
    q.x = Math.max(-148, Math.min(148, q.x)); q.z = Math.max(-148, Math.min(148, q.z));
    D.v = v;
    H.position.set(q.x, 0, q.z); H.rotation.y = D.h; pos.set(q.x, 0, q.z);
    // look around a little with the right thumb, then drift back to looking ahead
    const base = D.h + Math.PI;
    if (isNaN(D.lastYaw)) D.off = ang(yaw - base);
    else { const user = ang(yaw - D.lastYaw); D.off = Math.max(-2.2, Math.min(2.2, D.off + user)); if (Math.abs(user) < 1e-4) D.off *= Math.max(0, 1 - dt * 1.2); }
    const ny = base + D.off; D.lastYaw = ny;
    engine(true, v);
    return { yaw: ny };
  };
  D.camPos = function (cam) {
    const H = P1.car.holder, s = Math.sin(D.h), c = Math.cos(D.h), p = CFG.seat;
    cam.position.set(H.position.x + p[0] * c + p[2] * s, p[1] + Math.sin(performance.now() * 0.03) * 0.004 * Math.abs(D.v), H.position.z - p[0] * s + p[2] * c);
  };
})();

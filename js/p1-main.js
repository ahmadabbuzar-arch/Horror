/* THE LAST VILLAGE — Phase 1 glue. The game calls P1.start / P1.update / P1.collide; every call is wrapped so a
 * Phase 1 failure can never break the original gameplay (movement, torch, doors, touch controls). */
(function () {
  'use strict';
  const P1 = window.P1;
  let errors = 0;
  function guard(fn, label) {
    if (P1.disabled) return;
    try { fn(); }
    catch (e) { errors++; if (errors < 4) console.error('[P1] ' + label + ' error', e); if (errors > 20) { P1.disabled = true; console.error('[P1] disabled after repeated errors'); } }
  }
  // world = { scene, cam, pos, cc, doors, addDoor(d), ground(x,z), clear(x,z,r) }
  P1.start = function (world) {
    P1.world = world;
    if (!world.spawn) world.spawn = { x: world.pos.x, z: world.pos.z };
    if (!world.notify) world.notify = function () {};
    guard(function () { const bad = P1.startCharacters(world); if (bad && bad.length) world.notify('⚠ P1 config: ' + bad.length + ' problem(s) — console dekho'); }, 'characters start');
    guard(function () { P1.loadCar(world); }, 'car start');
    guard(function () { P1.startProps(world); }, 'props start');
    P1.log('started (' + P1.VERSION + ')' + (P1.cfg.gallery ? ' [gallery]' : '') + (P1.cfg.debug ? ' [debug]' : ''));
  };
  P1.update = function (dt, pos) { guard(function () { P1.updateCharacters(dt, pos); P1.debugTick(dt); }, 'update'); guard(function () { P1.updateProps(dt, pos); }, 'props update'); guard(function () { P1.driveUI(pos); }, 'drive ui'); };
  P1.collide = function (pos) { guard(function () { P1.collideCharacters(pos); P1.collideCar(pos); }, 'collide'); guard(function () { P1.collideProps(pos); }, 'props collide'); };
})();

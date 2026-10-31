/* THE LAST VILLAGE — ground alignment helpers (pure functions, no Three.js needed, unit-tested in tools/test_hut_ground.js).
 *
 * P1.baseLevel(groups, opt)
 *   groups : array of Float32Array/Array — for EACH mesh of the object, the world-space Y of all its vertices.
 *   returns the Y of the object's REAL base plane (the level its walls / foundation / fence stand on), i.e. the lowest level on
 *   which several separate parts agree. A single mesh that pokes lower than everything else (a buried step, a stray vertex)
 *   is deliberately ignored: that is exactly what made the starting hut float (its lowest vertex was a buried part 0.14 m
 *   below the walls, and scaling the hut 3.6x about that vertex lifted the walls ~0.34 m off the terrain).
 *   Method: per mesh, its "floor" = lowest Y that carries at least minFrac of its vertices inside a `window` slab;
 *           base = median of the lowest cluster of >= `agree` meshes whose floors lie within `joinTol` of each other.
 * P1.settleShift(base, ground, sink) -> how far to move the object (after scaling about `base`) so base sits at ground - sink.
 */
(function () {
  'use strict';
  const P1 = (window.P1 = window.P1 || {});
  P1.baseLevel = function (groups, opt) {
    const o = Object.assign({ window: 0.03, minFrac: 0.02, minVerts: 8, agree: 3, joinTol: 0.03 }, opt || {});
    const floors = [];
    let globalMin = Infinity;
    groups.forEach(function (ys) {
      if (!ys || !ys.length) return;
      const s = Float32Array.from(ys).sort();
      if (s[0] < globalMin) globalMin = s[0];
      if (s.length < o.minVerts) return;
      const need = Math.max(o.minVerts, Math.ceil(s.length * o.minFrac));
      for (let i = 0; i + need - 1 < s.length; i++) {
        if (s[i + need - 1] - s[i] <= o.window) { floors.push(s[i]); break; }
      }
    });
    floors.sort(function (a, b) { return a - b; });
    for (let i = 0; i + o.agree - 1 < floors.length; i++) {
      if (floors[i + o.agree - 1] - floors[i] <= o.joinTol) {
        const m = floors.filter(function (f) { return f >= floors[i] && f - floors[i] <= o.joinTol; });
        return m[(m.length - 1) >> 1];
      }
    }
    return floors.length ? floors[0] : (isFinite(globalMin) ? globalMin : 0);   // too few parts to cluster: lowest floor
  };
  P1.settleShift = function (base, ground, sink) { return (ground - (sink == null ? 0 : sink)) - base; };
})();

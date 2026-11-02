# r30 — graveyard boundary (4 sides) + openable gate
NEW `js/p1-gate.js` (no new GLB, everything is built from code):
* Iron fence + stone pillars on ALL FOUR sides, a 22.9 x 22.9 m square (+-11.45 m around the graveyard centre -26, 38), inside the terrain edge (11.63) and outside the outermost tomb (11.05). ~530 bars = 2 InstancedMesh draw calls.
* Two-leaf iron GATE on the EAST side (village side), at local z = +2.0 (no tomb near the fence there), tall stone gate posts. The leaves swing INTO the graveyard (100 deg).
* Opens/closes with the game's normal door button / E key ("⛩️ Gate kholo / band karo" within 3.6 m).
* Collision: fence blocks the player on every side; the gate opening is blocked until the gate is >55 % open.
Changed: `js/p1-main.js` (start/update/collide hooks), `index.html` (script tag + `label` support in showDoor), `tools/test_gate.js` (NEW, 11 checks: gate closed/open, all 4 sides from outside and inside).
Tune: CFG at the top of js/p1-gate.js (half, gateZ, height, openDeg ...). NOT tested in a browser. Car driving does not collide with the fence yet.

## r30 — fog redesign (js/atmo.js)
The old mist = 2-6 big flat stacked planes -> looked like a straight horizontal line / sheet. Replaced by SMOKE PUFFS: ONE InstancedMesh (1 draw call), soft cloud texture (1 texture fetch), all motion on the GPU.
* every puff slowly RISES (blooms, gets thinner) and then SINKS back (shrinks, thicker), sways sideways and drifts with the wind; 40 % are low ground haze, 60 % are wisps that move more (up to ~1.7 m).
* soft fade near the ground (no hard cut at the terrain), near the camera (no blob in the face) and at the far ring (puffs wrap around the player, never pop).
* counts: High 64 / Medium 40 / Low 22 puffs. Tune at the top of the ground-smoke block in js/atmo.js: DENS (thicker/thinner), SIZE, PUFF_R, per-puff height/amp/speed in makeMist(). `?nomist` still switches it off.
* Distance fog (FOG_BASE / FogExp2) and sky are unchanged. NOT tested in a browser.

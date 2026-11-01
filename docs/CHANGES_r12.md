# r12 — GRAVEYARD (3 new models) — NOT yet run in a browser / on a phone
West of the village (behind the houses), centre (-42, 38):
* `gy_cluny` (assets/props/cluny.glb) — Old Cluny Churchyard scan, 1.9 M tris / 83 MB -> 110 k tris / 3 MB. Headstones, walls, trees, domed mausoleum. The file's only texture is a
  *specular* map; the colours are in the vertex colours (COLOR_0), which tools/prep_props.py drops -> new tools/prep_scan_color.py keeps them. Mausoleum is solid (circle collider);
  the rest is walk-through (no walls:true: its 18 tiles are big meshes and would box the player in). Scan ground lies 0–0.6 m above the game plane (player walks at y=0).
* `gy_gate` (graveyard_entrance.glb, 17 MB -> 1.7 MB textures 512) — iron gate, 2 pillars with lamps, 2 wall wings, at x=-23.4 facing the village road. Pillars/walls are solid, the 2.6 m gap is open.
* `gy_hand` (graveyard.glb, ground plane cropped away) — grave mounds with a giant skeletal hand (~9 m), behind the graveyard at x=-66.
* Forest: extra keep-out rectangle [-72,16,-20,60] so no trees grow inside the graveyard.
* tools/test_props.js: prop count 2 -> 5 (all 18 checks pass; npm-less Node tests only, no rendering proof).
Tunables: js/p1-config.js (x/z/yaw/scale/tint of the three entries). If the hand looks too big/small change `scale` (0.18). If the scan looks too bright at night lower `tint` (0.5).
Licence: **Cluny scan is CC-BY-NC-4.0 (non-commercial)** — see docs/CREDITS.md.

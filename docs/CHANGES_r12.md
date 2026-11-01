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

## r13 (after first phone test)
* Phone screenshots: the gate stood alone in an empty field and the Cluny scan was not visible; the windmill texture looked dull with black holes.
* **Boundary**: `gy_wall` (graveyard_wall.glb, tools/make_graveyard_wall.py) = the gate's pillar + wall/railing wing copied 41x round a rectangle x -61..-23.4, z 17.9..59.1. Solid (walls:true). Whole Cluny scan is inside.
* **Cluny**: colours were stored as 16-bit RGB (not 4-byte aligned) — now 8-bit RGBA, the standard layout; tint 0.5 -> 0.8 (it may simply have been black on the dark night). If it is STILL missing, open `?debug` and send the `prop:gy_cluny` line.
* **Windmill**: replaced by windmill_from_the_village_of_bogdanka_poland.glb (CC-BY-NC-4.0), 300k -> 120k tris, texture 1024 (the file's own size; it cannot be sharper than that). The old black holes came from the old decimation. tint 0.55 -> 0.8.

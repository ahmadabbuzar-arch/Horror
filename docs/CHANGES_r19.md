# r19 — new graveyard (Banchory-Ternan watch house), much smaller fenced area (NOT tested on a phone)
Included: everything from r18 (High/Medium/Low graphics selector) and r18b (graveyard no longer floats).
* **Old graveyard scan removed:** assets/props/cluny.glb is gone (deleted from part2).
* **New scan:** assets/props/banchory.glb = "Banchory-Ternan watch house, Scotland" by Douglas Ledingham (CC-BY-NC-4.0, non-commercial; see docs/CREDITS.md). Source 1.85 M triangles / 83 MB -> 100 k triangles / 2.4 MB, vertex colours (the source's only texture is a specular map). Steps: tools/prep_scan_color.py --tris 100000 -> tools/flatten_scan_ground.py --yaw 168 --cell 1 --blur 1.5 (ground was already level within 1.2 deg, now flat; long side runs east-west).
* **Size:** scale 2.4 -> 24.8 x 17.4 m, chapel ~5 m, watch-house tower ~5.4 m. Solid parts: chapel (box) + tower (circle). Gravestones are not solid.
* **Fenced area: 41 x 41 m (1681 m2) -> 28 x 23 m (644 m2), about 62 % less.** tools/make_graveyard_wall.py: X_E -23.4, X_W -51.4, Z_S 27, Z_N 50 (25 fence units instead of ~38, so a bit lighter too).
* **Gate moved north** (z 38.5 -> 44.5) so the chapel does not stand right in front of the entrance. From the gate the tower is visible at the far end.
* Skeleton hand moved to x -57 (just behind the new west fence); forest keep-out rectangle shrunk to the new area.
Changed: part1 (js/p1-config.js, tools/make_graveyard_wall.py, tools/flatten_scan_ground.py (--yaw), tools/test_props.js, docs) and part2 (cluny.glb removed, banchory.glb added, graveyard_wall.glb rebuilt). Checked offline: node tools/test_props.js (19), check_assets.py, plan-view plot of fence / scan / colliders / gate.
Easy tweaks in js/p1-config.js entry gy_banchory: `scale` (bigger/smaller scan; then the fence and colliders must be redone), `tint` (brightness of the scan colours).

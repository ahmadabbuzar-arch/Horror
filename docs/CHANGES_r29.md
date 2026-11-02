# r29 — old cemetery removed, whole "GRAVEYARD (HIGH QUALITY)" map placed

**Removed:** `gy_graves` (15 graves) + `gy_fence` (wooden fence) from `js/p1-config.js`. `assets/props/cemetery.glb` / `cemetery_fence.glb` are no longer used (delete them if you want).
**Added:** ONE prop `graveyard` = `assets/props/graveyard_map.glb` (5.1 MB, 155k triangles) at world x = -26, z = 38 (same place as the old cemetery, west of the village).
The map = terrain (23.3 x 23.3 m) + 15 tombs / headstones in a ring + the big bare jacaranda tree (19 m). Source: "GRAVEYARD (HIGH QUALITY)" by lorem Models, CC-BY-4.0 (docs/CREDITS.md).

## Why the raw file could not simply be dropped in (what `tools/prep_graveyard.py` fixes)
| Problem in the 98 MB source | Fix |
|---|---|
| Z-up -> Y-up rotation, x2908 scale and mirrored axes live in node matrices (easy to end up upside-down / inside-out / 60 m wide) | all node matrices are baked into the vertices, winding checked against the normals, **y is up**, file is in **metres**, origin = map centre, no node transforms left |
| Terrain floats 0.9-2.9 units above y=0 and has a hollow round the tree that would sink **below the game's ground plane** (plane is at y=0, 318 m wide) -> that part of the map would be invisible ("texture gone") | heights below the edge level are lifted, the border strip is blended down, edge level = y 0. Result: terrain y = 0.00 .. 1.06 m, border exactly 0, nothing under the plane. The game lifts it 3 cm (`sink: -0.03`) so it never z-fights |
| Tombs' bottoms sat on the original terrain (6 of 15 would float after the change) | bottoms extended down into the ground |
| Materials: terrain metallic 0.998, tombs roughness 0.08 + `KHR_materials_specular` -> **black in three.js without an environment map** | rebuilt as plain diffuse (metal 0, rough 1), only the 4 base-colour maps are kept (moss ground, concrete, 2 x bark) |
| 4096 px textures (60 MB), 431k triangles | textures 1024 (all 1024) JPEG; terrain 32k -> 8k tris (65x65 grid); trunk 115k -> 20k, branches 283k -> 126k (branches without normals = flat shaded twigs) (vertex clustering that follows the tiled branch UVs; silhouette checked) |

## How the player interacts with it (`js/p1-props.js`, 3 new optional per-prop keys, everything else unchanged)
* `origin:true` — keep the file's own origin / ground level (no bounding-box re-centring; the canopy reaches 1.4 m past the terrain on the west side).
* `floorRe:'gy_terrain'` (+ `climb:true`) — only the terrain mesh counts as floor, so the player walks over its small hills (max slope ~45 deg for a few cm).
* `wallRe:'gy_tombs'` (+ `walls:true`) — only the 900-triangle tombs block the player. The tree trunk uses 15 collision circles (`circles`), the 126k-triangle canopy (starts 1.85 m above ground) is never ray-tested, so no frame-rate cost.
* Forest: `keepOut` rectangle + `footprint:14` keep the extra forest trees out of the map.

## Checked offline (NOT in a browser — no Three.js in the build sandbox)
`node tools/test_props.js` (20 pass; the 2 "asset exists" fails are watchtower/windmill = part2, not in this zip), GLB structure / accessor ranges / normals (`|n|`=1, terrain 100 % facing up), terrain border y = 0.0000, original hut-model trees (all z <= 19) and NPC spawns are > 4 m away from the map. Software renders with the real textures: `python3 tools/preview/graveyard_preview.py assets/props/graveyard_map.glb out` (flat shading, no fog/lights — the game will look darker and foggier).

## Tune
* Bigger / smaller map: `python3 tools/prep_graveyard.py graveyard_high_quality.glb assets/props/graveyard_map.glb --scale 0.5` (0.4 default; at 0.5 the tree is 24 m and the terrain 29 m — then move `x` to about -29 and widen `keepOut`). The tree-trunk circles are printed by the script, paste them into `circles`.
* Shipped with: `--branch-cell 0.5 --trunk-tris 20000 --no-branch-normals --terrain-tex 1024` (keeps the whole game zip under 25 MB). More detail: `--branch-cell 0.15 --trunk-tris 45000 --terrain-tex 2048` (8.8 MB, 210k tris).
* Different spot: change `x`, `z`, `yaw` of `graveyard` in `js/p1-config.js` (+ the 2nd `keepOut` rectangle).

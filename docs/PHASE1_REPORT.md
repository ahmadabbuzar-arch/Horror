# Phase 1 report — revision 2 (correction + verification pass)

**Browser testing / rendering: NOT DONE. This build is still UNTESTED on screen.** The sandbox has no network and no
copy of Three.js r128, so nothing was ever rendered. Everything below says exactly what was checked and how.

## 0. What was verified, and how (all re-runnable)
| Check | Command | Result in this sandbox |
|---|---|---|
| JS syntax (index inline script + 5 modules) | `node --check` | pass |
| Asset manager: one load per URL, strictly sequential, refcounted disposal, release-while-loading, failure + retry, shadow meshes never disposed | `node tools/test_p1_logic.js` (fake `GLTFLoader`) | 33/33 pass |
| Config validation (bad anchor / bad regex / absurd height / missing NPC are reported) | same | pass |
| NPC placement maths: world/hut/entry/door/village anchors, offsets, `snap:false` exactness, blocked-spot snapping, facing (`to`/`point`/`yaw`), missing-anchor fallback, no two NPCs on one spot | same (stub world) | pass |
| Every `assets/*.glb` path exists with exact case; every GLB parses, lengths/accessors/images valid, no external URIs; every config regex matches a real mesh/material; SAAYA eye material, Chotu `idle` clip and car part names exist | `python3 tools/check_assets.py` | pass (1 informational note: Shyamlal's pistol is already stripped from the file) |
| Car wheel fix maths on the real vertices | `python3 tools/verify_car_geometry.py` | see §1 |
| **Not verified** | — | rendering, console errors in a real browser, orientation/scale/pose on screen, SAAYA shader compile and look, torch readability, touch controls, frame rate, memory on a phone, door/hood swing direction on screen (hinge maths verified numerically only) |

## 1. Car wheels
**Correction of a wrong claim in r1:** the "one rear wheel is tilted and sinks ~11 cm" was a measurement artifact (a world-space bounding box of a spun wheel is inflated). Measured from real vertices (`tools/verify_car_geometry.py`):
* Rear -X and rear +X wheels: axle exactly along the body's own axle (0.0°), tyre bottoms within 0.5 cm of each other. Fine.
* **Front +X wheel: axle 23.4° off the body's axle** (a yawed/bent wheel). Real problem.
* **Front -X wheel: missing.** Only a 54-vertex brake disc (radius 0.82, sagged to y 0.91 vs axle height 1.46) remains.

Fix (`js/p1-car.js`, options in `P1.cfg.car`): every tyre is re-aimed along the body's axle (`straightenWheels`); the rear -X tyre is **cloned** (shared geometry/material, no new asset) into the empty front -X corner at the axle position taken from the front +X tyre and the rear -X track (`restoreMissingWheel`) — numerically it lands at the same axle z as the leftover brake disc (5.77 vs 5.80); the lone disc is moved onto the new axle just inboard (`showBrakeDisc`, else hidden). Ground height now comes from the true tyre radius (geometry bounds), median of the three real tyres. **Unverified visually:** whether the cloned wheel looks right on that side (the tread/rim face orientation), and that the body sits on it without a visible gap.

## 2. NPC placement
All spawn data moved to `js/p1-config.js` → `P1.config.npcs`. Each NPC: `anchor` (`world` | `hut` | `spawn` | `village` | `entry` | `door`+index), `x`/`z` offset (absolute for `world`), `face` (`{to}` | `{point:[x,z]}` | `{yaw:deg}`), `snap` (true = search for a free spot, false = exact). Defaults are **placeholders** still relative to the first door — replace with `anchor:'world'` entries when the level is designed. `?spawns` draws a coloured pole + facing cone at every spawn point; `?debug` prints coordinates and whether a spot was snapped; `P1.characters.teleport(id,x,z,yaw)` moves one at runtime. A blocked `snap:false` spot is reported in the console and never moved. The logic is tested (§0); whether the default spots look sensible in the real village is not.

## 3. SAAYA
Rebuilt (`P1.config.saaya`): the horror_girl textures are discarded entirely. Body = very dark blue-black Phong surface (picks up the torch: diffuse + wet specular sheen); **plus a view-dependent rim glow injected into the Phong emissive term** (pulses slowly) so the outline stays visible with no light; hair/lashes keep their cut-out in black; eyes glow; figure stretched narrower/taller (`stretch`, `height` 1.90 m). Also: slower, stronger head-tilt idle. **Not verified:** that the shader chunk injection compiles on r128 (a warning is logged if the injection string is not found), and that it actually reads as a shadow entity and is readable under the torch. Colours/strengths are all in the config. The model is still, underneath, a girl with a dress and long hair — only a different model would change that.

## 4. Material configurability
`P1.config.appearance[id]`: `height`, `relax`, `unlit`, `anim`, `idleRate`, `hide`, `headParts` and an ordered `materials[]` rule list — every matching rule applies — with `mesh`/`mat` regex filters and `tint`, `color`, `set{roughness, metalness, emissive, emissiveIntensity, opacity, side}`, and **`grade{saturation, brightness, contrast, fade, tint}` which recolours the texture itself on a canvas** (real desaturation/fading, which a colour multiply cannot do). `grade` is implemented but **unused by default and unrun** — turn it on per rule when you start improving clothing. Mesh/material names for every character are in `docs/MODEL_STATS.md`; `tools/check_assets.py` flags rules that match nothing.

## 5. Chotu "213k triangles"
Investigated — see `docs/MODEL_STATS.md`. The Chotu file (`dark_psychic_kid.glb`) has **12,915 triangles / 9,345 vertices**, one mesh, no LODs, no hidden geometry. No supplied file or accessor sum corresponds to 213k; the heaviest file (not used) is 121,134 triangles. The figure is not from these files. Chotu needed no geometry optimisation.

## 6. Paths, loading errors, duplicate loading, disposal
* Paths: all 10 referenced GLBs exist, exact case, relative, no `..`/absolute/backslash (audit tool).
* Loading errors: a failed/404/non-GLB download rejects, the cache entry is dropped, the character is marked `error` (never retried automatically, so no retry storm), a visible `⚠ … load nahi hua` message is shown, and nothing else stops. A failed build removes its half-built holder.
* Duplicate loading: one load per URL (tested); characters can only be loaded from state `idle`; sequential queue (tested).
* **Disposal bug found and fixed (r1):** parts re-parented out of `gltf.scene` (car doors/hood/trunk/wheels, Dev's head meshes) were never disposed, and cloned/graded materials lived outside it. Now `unload()` / `car.dispose()` dispose the whole holder (shared blob-shadow geometry/material are skipped), then release the asset. `car.dispose()` also removes the car's doors from the game's door list. The refcount/dispose rules are tested with a fake loader; real GPU memory release is not measurable here.
* Existing: release-while-loading is disposed on arrival (tested); memory cap evicts the farthest character.

## 7. Licences (new finding)
Embedded metadata shows **horror_girl (SAAYA) is CC-BY-NC-4.0 — non-commercial**; the others are CC-BY-4.0 (attribution required); the doctor is CC0; the **village has no metadata**. See `docs/CREDITS.md`. A credits line was added to the start screen.

## Still not implemented / known issues (unchanged unless noted)
Mesh merging, real shadow maps, cracked glass, other supplied animations (guard 52 s clip, mechanic 0-length pose, SAAYA walk cycle are kept but not played), authentic Indian clothing/skin (needs new textures — the `grade`/`materials` config is the hook), Kamla's hat mesh assumed to be a hat, Dr. Arvind has no head movement, car lamps off by default (`?carlights`, estimated positions), normals recomputed after the dents, default NPC spots are placeholders, `file://` does not work, ZIP excludes the 27 MB original doctor model (it is in the previous Phase 1 ZIP at `source_models/`; `tools/optimize_doctor.py` still needs it as input to regenerate `dr_arvind.glb`). No Phase 2 work was started.

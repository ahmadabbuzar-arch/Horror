# THE LAST VILLAGE — Phase 1 FINAL CORRECTION (r3) — correction report

**Status: NOT tested in a browser.** The build sandbox has no network and no Three.js r128, so the game itself was never run.
What was checked: JS syntax, 3 offline test suites (33 + 13 logic checks, asset/regex checks), numeric analysis of the real GLB data,
and **offline preview renders** made with a small stand-alone WebGL renderer (`tools/preview/`, no Three.js). Those renders show the
corrected *assets* (poses, scale, grounding, car parts) — they are **not screenshots of the running game** (different shader and lighting).
The environment (village.glb, trees, roads, terrain, lighting, fog) was not touched.

## 1. Starting hut floating — FIXED (root cause found)
* Cause: `index.html` scaled the hut 3.6x about the **lowest vertex of the whole cabin** (y = -0.1428, a buried part). The walls/foundation
  stand at y = -0.0103, so after scaling they ended **0.334 m above the terrain** (the gap in your recording). Interior floor was 0.5 m high.
* Fix: `js/p1-ground.js` `P1.baseLevel()` finds the real base plane = lowest level where >= 3 separate meshes agree (stray/buried parts are
  ignored). The hut is scaled about that plane, then moved down so the base sits 3 cm into the terrain (`HUT_SINK`, ~ what the original
  author's 1 cm embed becomes at 3.6x). Terrain height is probed with rays on the ground plane, not assumed.
* Preserved: scale 3.6, rotation, X/Z position (cc.x/cc.z unchanged), Cabin8_5 meshes, wall toggle, in-hut spawn.
* Verified numerically on the real vertices (`node tools/test_hut_ground.js`, 13 checks): old base 0.334 m high -> new -0.030 m; every
  wall/fence/foundation lowest point within 2-4 cm of terrain; deepest buried vertex 0.51 m (hidden under the ground plane).
* Interior floor is now ~0.15 m above terrain (was ~0.5 m). Hut has no door mesh (the doors you open are the village's); village door
  logic untouched. NOT verified in the browser: that walking in/out feels right.
* `?debug` prints base / ground / shift for the hut.

## 2. Characters — poses, scale, ground
* **Kamla Devi was ~7 m tall.** `P1.measure` measured skinned meshes as geometry-box x matrixWorld; her mesh node has scale 0.01 so it
  read 0.356 m instead of ~1.8 m (scale 4.2x). Now skinned meshes are measured from real skinned vertices (`skeleton.update()` +
  `boneTransform`) — `js/p1-core.js`.
* T-poses removed by **baking a natural standing pose into the GLBs** (`tools/bake_poses.py`): clavicle -8 deg, upper arm hanging ~9 deg out,
  elbow slightly bent, hand relaxed. Done for Raghunath, Kamla Devi, Shyamlal, SAAYA. Dev (un-rigged A-pose mesh): arms lowered 25 deg by moving
  arm/sleeve vertices about the shoulder with a soft blend (`tools/bake_dev_arms.py`). Dr. Arvind already stood naturally; Chotu plays his
  own `idle` clip. Runtime `relax` switched off for the baked ones (code kept).
* Idle animation (procedural) improved: breathing, hip weight shift, shoulder/arm sway, head look-around + occasional glance; static
  models (Dev, Arvind) get sway/breath, Dev's head turns. SAAYA: slower, with larger head tilt.
* Mappings unchanged; all seven kept. Feet are placed on the ground at each spawn via the measured bottom.
* Checked in preview renders: `screenshots/characters_all_seven.png`. Shoulder deformation of the baked arms looks clean at that distance;
  not inspected up close from every angle.

## 3. SAAYA
* Matte near-black Phong (specular black, shininess 1) — no gloss, no blue-white. Subtle thin rim (power 3.4, strength 0.55, dim cool grey,
  slow breathing) = silhouette outline. Eyes: small pale-grey, 55% brightness, slow flicker. Taller/narrower (stretch 0.80/1.07/0.80, ~2.1 m).
  Idle: slow head tilt/glance. All knobs in `P1.config.saaya`.
* Preview (`screenshots/saaya_*.png`) uses my own approximation of these settings. **Not verified:** the Three.js shader injection for the rim
  (it logs a warning if the chunk name differs) and how bright she looks inside the real torch spotlight (in my preview the torch lit her
  too pale — if so in-game, lower `bodyColor`).

## 4. NPC spawn points — individually configurable, none near the start hut
Absolute world coordinates in `P1.config.npcs` (+ `saayaEncounters`). **The village has 5 buildings and nothing labelled clinic/school/workshop,
so the building-to-role assignment is mine (by position/size)** — change x/z to re-home anyone:
Raghunath B1 (14.0 m from start side) = workshop · Kamla B2 = village house · Dr. Arvind B3 (shop front with sign) = clinic · Chotu B4 (big hall) =
abandoned school · Shyamlal B5 (tallest) = watchtower · Dev behind B2/B3 on the west side = hidden house · SAAYA behind B5 + 3 more encounter
points. All spots are outdoors at the front, checked clear of village geometry offline; runtime `snap:true` nudges if blocked. `?spawns` shows poles.

## 5. Car
* Verified from the real vertices and in preview: the front-left tyre is missing in the source (only a brake disc), the front-right wheel
  is yawed ~24 deg — the existing runtime fixes (straighten + clone rear-left tyre) are correct; all 4 tyres land on the ground within 0.5 cm;
  hinges are at the door front edges / hood rear edge / trunk front edge; hood 12 deg open, front-left door ajar, others closed.
  See `screenshots/car_*.png` (emulation of those same transforms). **No change was needed in the car code.**
* Not verified: the crumple/dent damage and grime (runtime vertex edits, can't be rendered here), the moved brake disc, car-door buttons.

## 6. Mobile UI
* Gaon / Hut ke andar / Hut deewar buttons hidden unless `?debug` or `?dev` is in the URL (keys H / G still work). HUD smaller (torch is a 36 px round
  button), door prompt smaller, fades in, says Car vs Door and drops "(E)" on touch. Joystick slightly smaller; touch logic untouched.

## Not changed (as requested)
village.glb, trees, terrain, lighting/fog, player movement/camera/torch/collision/touch code, village doors. No Phase 2 work.

## Remaining issues / risks
1. Whole build still untested in a browser (rendering, console, touch, FPS). First thing to do: open `?debug&spawns`.
2. Building roles are my assignment (see 4). Dev's "hidden house" is a spot behind buildings, not a real separate house (none exists).
3. SAAYA torch brightness and rim shader unverified in Three.js; hair is flat card geometry (looks cut-out up close).
4. Baked arm poses: no hand/finger posing; Dev's sleeves may clip the torso slightly at the shoulder.
5. Chotu keeps his own clip pose (arms slightly out); Dr. Arvind's arms are slightly away from the body.
6. Car damage look and the brake-disc placement unseen. Hut: no door/interior test; interior floor level changed (0.5 -> 0.15 m).
7. Shyamlal's pistol/cigarette were removed earlier; Raghunath is flat-lit (unlit material converted) — unchanged.

# r21 — small cemetery next to the village (NOT tested in a browser)
Source: cemetery.rar (OBJ + 4096 px textures). tools/make_cemetery.py converts it:
* assets/props/cemetery.glb (0.8 MB): the 7 graves (mound + headstone) scaled x1.6 (graves 2.4 m long, headstones up to 1.5 m), BaseColor texture 2048 jpg. The model's own low half-fence (only 2 sides) is dropped.
* assets/props/cemetery_fence.glb (0.1 MB): NEW closed wooden fence on all four sides (1.5 m planks + posts with caps), built from the plank area of the same texture. Open gate on the east side (facing the village): 2.6 m gap, taller posts, lintel on top.
* js/p1-config.js: props gy_graves (21 collision circles: headstones + mounds) and gy_fence (walls:true, wallR 0.4); forest keep-out rectangle for the area.
* Position: fenced area x -27.3..-18.0, z 34.0..42.3 (9.3 x 8.3 m = 77 m2), ~12 m west of the houses. To move it: change x,z of BOTH props by the same amount (+ keepOut).
* tools/test_props.js: 4 props + 2 wrecks, circles / centres check.
Changed: part1 (config, tools, test, docs) and NEW part2 files (assets/props/cemetery*.glb).

## r22 — crooked / creepy graves
tools/make_cemetery.py now jitters the graves with a fixed seed (same result every build): mounds turned up to 13 deg and shifted ~14 cm, headstones turned up to 16 deg and leaning 3-10 deg, three of them 14-24 deg (nearly falling), every headstone's lowest corner sunk 4-16 cm into the ground. Collision circles follow the new positions. gy_graves x,z changed to (-22.84, 37.92). For a calmer look lower the numbers in the jitter block (or set lean to 0).

## r23 — bigger cemetery + clean part2/part3
* Fence rectangle enlarged 9.3 x 8.3 m -> 12 x 11 m (x -30.0..-18.0, z 32.65..43.65); east fence stays at x -18, gate gap 2.8 m (world z 37.75..40.55). Graves unchanged inside (more walking room on the west side). Change X0,X1,Z0,Z1 in tools/make_cemetery.py to resize again, rebuild, then copy the printed numbers.
* part2: old graveyard files (banchory.glb, graveyard_entrance.glb, graveyard_wall.glb, graveyard.glb) removed, windmill.glb + watchtower.glb kept, cemetery.glb + cemetery_fence.glb added. part3 (village_hq.glb) needed no change.

## r24 — 15 graves instead of 7
tools/make_cemetery.py now copies the model's 7 mound+headstone pairs into a 5 x 3 grid (COLS / ROWS at the top of the grave block), each copy with its own random turn / shift / lean / sink (fixed seed, 4 headstones lean a lot). Aisles ~0.9 m, free strip on the east for the gate. 45 collision circles. cemetery.glb 1.1 MB. gy_graves x,z = (-24.44, 38.21). part3 unchanged. More / fewer graves: edit COLS and ROWS, rebuild, copy the printed numbers.

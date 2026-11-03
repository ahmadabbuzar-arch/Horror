# r32 — DR. ARVIND CLINIC made bigger
Request: the clinic (the veranda house) was too small, no room inside -> make it a bit bigger.
What changed
* `assets/models/village.glb`: only the 14 nodes of the clinic house (Cube.137-147, 114, 115, 202) got a new transform = **1.3x in plan (x and z), height unchanged**, pivot x = -4.968 / z = 6.425 (village-local). Nothing else in the file was touched (all other houses, road, trees, props identical).
  - Interior: 3.2 x 4.6 m  ->  **4.1 x 6.0 m** (about +70 % floor area). Ceiling stays 1.89 m, stairs keep the same step height (they are just 1.3x wider / longer, so gentler).
  - Pivot was chosen so the house grows toward the road and the village bounding box stays identical (the village is centred on that box, so nothing else shifts). The veranda front moved from x -2.77 to -2.11 (still behind the neighbours' fronts at -1.9 / -1.4). Gaps to the neighbouring houses: ~0.9 m south, ~1.2 m north.
  - Door / windows / posts scale with the house; door-leaf detection in index.html checked offline: the same 7 door nodes are found before and after.
* `js/p1-clinic.js`: door, Dr. Arvind, room light, tubes, all 10 furniture items and the sign moved into the bigger room (each item keeps its wall: desk/cabinets on the west + north walls, bed under the window, visitor chair by the door). Sign board 3.6 -> 4.3 m wide (veranda roof is 6.2 m long now). Stairs corner (west wall, south) and the door lane are still free.
* `js/p1-config.js`: fallback Arvind spawn updated. `tools/test_clinic.js`: expected door / doctor positions updated (15/15 pass).
Layout check: floor-plan slice at 1.0 m cut from the real mesh data + furniture footprints (SAT overlap test): 0 overlaps, everything inside the room, nothing in the stairs or door lane.
Tune: scale = K / PX / PZ in the patch (see CHANGES text above); furniture x/z in CFG at the top of js/p1-clinic.js.
NOT tested in a browser. Not in this zip: `village_hq.glb` (part3, used with ?hq) is NOT patched — the clinic is still the old size there.

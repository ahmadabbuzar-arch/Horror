# r5 — village built from the 7 new models (STILL NOT RUN IN A BROWSER)

| prop | file | where (x,z) | notes |
|---|---|---|---|
| farmstead house (with interior) | assets/props/vintage_house.glb | 21, 27 | cropped from a 28x63 m scan lot to ~20x30 m, big terrain mesh dropped, 1 unit = 1 cm -> scale 0.01; enterable (ray wall collision) |
| ruined log house | ruined_house.glb | 16, 54 | 100k -> 32k tris, solid box collider |
| watchtower | watchtower.glb | 4.5, 72 | landmark at the far end of the road, 11 m tall |
| windmill | windmill.glb | 33, 50 | 300k -> 42k tris, circle collider |
| boat wreck | boat_wreck.glb | -21, 29 | 680k -> 34k tris, mud slab sunk 0.9 m |
| clinic / bunker (corridors) | clinic_bunker.glb | -27, 52 | enterable, ray wall collision |
| 2 abandoned sedans | vehicles/sedan.glb?wreck1/2 | 4,22 / 5.6,63 | **your uploaded sedan is the same model as the player's car already in the game** -> reused, not duplicated |

* Total prop download ~10 MB (was ~64 MB raw). Props stream in by distance (loadRadius 85 m, one at a time, nearest first).
* ~100 extra trees are cloned from the hut model's own trees around the village (config.village.forest).
* Layout preview: docs/VILLAGE_LAYOUT_top.png / _oblique.png (original village shown white = textures not loaded in the preview tool).
* Tools: tools/prep_props.py (decimate/crop/optimise), tools/preview/layout.py, tools/test_props.js (15 checks).

## Not verified (needs a phone)
* Which side of each building is its front (yaw values are guesses; `yaw` in js/p1-config.js section 5).
* Scan props are darkened with `tint`; baked daylight may still look too bright/dull under the torch.
* Wall collision of the two enterable buildings is ray based (12 rays) — check you can walk in through doors and are not stuck.
* Vertex-cluster decimation can leave small holes in scanned meshes (boat slab, ruined house ground patches).
* NOTE found while working: index.html only looks at `root.children` for trees; in hut.glb that is one wrapper node, so the original tree clearing around the hut / tree collision may not be doing anything. Not changed.

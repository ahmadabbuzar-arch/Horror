# r25 — the 5 old village houses replaced by a Western street (NOT tested in a browser)
Source: `Western_architect_obj.rar` (OBJ + MTL + 44 textures, 17 objects). Built offline by `tools/make_western_town.py` (needs the extracted pack + the old village.glb for the cactus; Pillow + numpy only).

**Layout (world metres, main street runs north along x = 3, the player arrives from the south):**
| side | building (z of its centre) |
|---|---|
| west row, fronts look east | blacksmith 15 · general store 25 · hotel 38 · bank 51 |
| east row, fronts look west | wooden house 13 · sheriff 23.5 · saloon 38 (opposite the hotel) · small house 47 · cabin 54 |
| end of the street | church (z 64, looks back down the street) |
| street furniture / yards | wagon (z 20) · windmill-pump 'vane' in the middle of the street (z 31.5) · gallows (SE entrance) · crate by the saloon · water tower and shed behind the west row · cactus group east of the saloon |
Small stagger (+-1 m, +-2 deg) so the rows are not ruler-straight. Edit `LAYOUT` in the script and re-run to move anything.

**Scale:** pack units x 5 (door ~1.65 m, same as the old houses; hotel 11.5 x 8 x 7 m); the sheriff office is x 1.25 because it is very low in the pack.
**Textures:** 43 JPEGs, power-of-two, 1024 px for the 17 main wall atlases, 512 for the rest -> village.glb 6.1 MB (was 9.7 MB), ~100 MB GPU on High (old: ~90), ~44 MB on Medium/Low. `village_hq.glb` / `?hq` are gone (the old file contained the old houses).

**Code changes**
* index.html: `placeVillage` — if the GLB has `scene.extras.worldCoords` it is placed at (0, 0.05, 0) as is (no re-centring, no 'delete everything east of x = 2.9' rule); the 'Gaon' button teleports to `extras.entry` (3, 6.5) because the new buildings have no animated doors; `?hq` removed.
* js/p1-config.js: NPC spawns moved in front of the new buildings (Raghunath = blacksmith, Arvind = general store, Kamla = small house, Shyamlal = sheriff, Chotu = church, Dev behind the east row, SAAYA behind the church + 4 encounter spots); wreck2 moved off the church; forest keep-out widened to x -15..18, z 6..75.
* part2 (windmill, watchtower, cemetery) is unchanged. part3 is obsolete.

**Checked offline:** JS syntax, node tools/test_props.js (21), tools/check_assets.py, offline preview renders (own renderer, not the game), no building overlaps another, no NPC/wreck/prop inside a building (bbox test), cemetery still 8 m west of the hotel's back wall.
**NOT checked / known limits:** never run in a browser. **Doors do not open and the buildings are solid shells** (the doors are painted on the walls / separate panels inside one mesh, not animated); you can walk on the porches and around everything, but not inside. The saloon mesh does contain a bar/tables interior but is closed. Roof textures look a bit noisy in the preview. Pack author/licence unknown (docs/CREDITS.md).

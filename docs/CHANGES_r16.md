# r16 — texture / image quality (NOT tested on a phone)
Honest limit: village.glb's textures are 512x512 JPEGs (the originals are not in this project), the hut is 1024, characters 512–1024. Real extra detail cannot be invented; what CAN be done:
* index.html: MSAA anti-aliasing ON (was off), pixel ratio min(devicePixelRatio, 2) (was 1.5), anisotropic filtering up to 8x on EVERY texture of every GLB (was 2–4) -> walls, roofs and ground stay sharp at an angle. Escape hatch if it lags: URL `?pr=1.5` and/or `?aa=0`.
* graveyard_entrance.glb: colour textures 512 -> 1024 (tools/prep_props.py --tex 1024 --ntex 512: new --ntex keeps normal / metal-rough maps at 512 to save memory). graveyard_wall.glb rebuilt from it.
* cluny.glb: 110k -> 170k triangles (its detail is vertex colour, i.e. triangle density). 4.3 MB.
* If you have the ORIGINAL high-res house/village textures or the original village GLB, send them and I will put 1024 in (memory: ~190 MB for 35 textures at 1024 — I would merge/trim them first).

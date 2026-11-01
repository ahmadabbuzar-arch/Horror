# r17 — real HD village textures (ambientCG, CC0) — NOT tested on a phone
Source of the village: NaiveGoblin "Old West Town" (CC0). Its textures are ambientCG materials that the author used at 512 px, so the HD versions come from ambientCG (4K zips supplied by the user).
* tools/upgrade_village_textures.py swaps 25 of the 35 textures (Planks023A+black, Planks012+blue, Planks019 red, Fabric019, PavingStones115B, Metal041C, Bricks096, Wallpaper001A normal/roughness). Mapping checked against the old images (correlation 0.88–0.99); tinted variants re-derived from the HD colour with a fitted colour matrix.
* `assets/models/village.glb` (default): colour 1024, normal 1024, roughness 512 -> ~90 MB GPU (was ~49 MB), file 9.7 MB.
* `assets/models/village_hq.glb` (add `?hq` to the URL): colour 1536, normal 1024, roughness 1024 -> ~180 MB GPU, file 14.6 MB. If the phone reloads/crashes the tab, drop `?hq`.
* Not upgraded (not supplied): Cactus (probably the author's own), Desert Floor = Ground076L, Wood026 (furniture), the red wallpaper colour (a flat colour in the source file).
* 4K/8K are NOT used on purpose: one 4096 px texture = ~90 MB of GPU memory; 25 of them would crash a phone.

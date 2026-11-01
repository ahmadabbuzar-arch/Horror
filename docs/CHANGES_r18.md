# r18 — Graphics option: High / Medium / Low (NOT tested on a phone)
Reason: game lagged. Start screen now has a Graphics selector (High / Medium / Low); in game the ⚙️ button (top right) pauses and opens the same screen. Changing the level saves it (localStorage `lv_quality`) and reloads the page.

| | High | Medium | Low |
|---|---|---|---|
| render resolution (pixel ratio) | min(dpr,2) | min(dpr,1.25) | 1 |
| MSAA anti-aliasing | on | off | off |
| anisotropic filtering | 8x | 4x | 1x |
| house / village / hut / props textures | as in file (1024) | max 512 | max 256 |
| characters / car textures | as in file | max 1024 | max 512 |
| `?hq` village | allowed | ignored | ignored |

Default when nothing is saved: Medium on touch devices, High on PC. URL override: `?q=low` (or medium / high). `?pr=` and `?aa=0|1` still win over the preset.
Textures are shrunk in the browser right after a GLB is loaded (before the first GPU upload): halving steps on a canvas, power-of-two sizes. The files themselves are unchanged.
Changed files: index.html (quality block, loader hook, selector UI), js/p1-props.js (anisotropy respects the level).

## r18b — graveyard floated in the air (NOT tested on a phone)
Cause: assets/props/cluny.glb (the graveyard scan) is a hillside. Its west edge touches the ground but the east (gate / village) edge is 2.3 m ABOVE the game's flat y=0 ground, so the ground sheet hung in the air and tombstones stood on it, above the gravel.
Fix: tools/flatten_scan_ground.py estimates the smooth ground surface of the scan and subtracts it from every vertex height (normals corrected). Tombstones and the mausoleum keep their shape. cluny.glb is replaced (same size class, 4.3 MB); js/p1-config.js: gy_cluny now `sink: 0.0, baseY: 0`.
Changed: part1 (js/p1-config.js, tools/flatten_scan_ground.py, docs) AND part2 (assets/props/cluny.glb).

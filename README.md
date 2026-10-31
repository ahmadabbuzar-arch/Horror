# THE LAST VILLAGE — Phase 1 r3 (final corrections)  ·  UNTESTED IN A BROWSER

See docs/CORRECTION_REPORT_r3.md (what changed, what was and was NOT verified) and screenshots/ (offline asset previews, not in-game).
URL switches now: ?debug / ?dev also show the developer buttons (Gaon, Hut ke andar, Hut deewar).

Existing game (hut, village, first-person movement, torch, doors, collision, touch controls) is preserved.
Phase 1 adds 7 characters and the player's damaged sedan, loaded from external files.

## Run it
Assets are separate `.glb` files now (the 7.8 MB of base64 is gone), so the page must be served over HTTP — `file://` will not work.

    cd <this folder>
    python3 serve.py            # then open http://localhost:8000  (phone: http://<your-pc-ip>:8000)

Any static server works (`npx serve`, nginx, GitHub Pages ...). Needs internet for Three.js r128 from the CDN, or put
`three.min.js` + `GLTFLoader.js` (r128) into `vendor/` (see vendor/README.md).

## URL switches (QA only)
* `?debug`     — on-screen list: load state, heights, scale, distance for every character and the car
* `?spawns`    — coloured pole + facing cone at every NPC spawn point (for editing `P1.config.npcs`)
* `?gallery`   — loads all 7 characters in a row next to the spawn point (left of the car) to inspect them
* `?carlights` — shows the (estimated-position) head/tail lamp discs on the car

## Layout
    index.html                 original game + hooks (look for `P1.` and `p1Start` / `p1Ground` / `p1Clear`)
    js/p1-config.js            ALL tunables: NPC spawn points, character appearance/material rules, SAAYA look, car options
    js/p1-core.js              config, asset manager (dedupe / sequential / refcounted dispose), blob shadow, measuring
    js/p1-characters.js        7 characters: orientation, height normalisation, materials, idle, distance streaming
    js/p1-car.js               sedan: scale, ground, damage, door/hood/trunk pivots, door-button hookup, colliders
    js/p1-main.js              guarded glue (a Phase 1 error can never break the original gameplay)
    assets/models/             hut.glb, village.glb      (extracted byte-for-byte from the original base64)
    assets/characters/         raghunath, kamla_devi, dr_arvind, shyamlal, chotu, dev, saaya  (.glb, mobile-optimised)
    assets/vehicles/sedan.glb
    tools/                     extract_base64.py, optimize_glb.py, optimize_doctor.py (Pillow only),
                               check_assets.py, test_p1_logic.js, verify_car_geometry.py  (offline verification, see below)
    docs/                      PHASE1_REPORT.md, MODEL_INSPECTION.md, CREDITS.md

Character -> model mapping: Raghunath=mechanic_low_poly, Kamla Devi=old_lady_fbx, Dr. Arvind=jordan doctor (optimised),
Shyamlal=guard, Chotu=dark_psychic_kid, Dev=man, SAAYA=horror_girl (re-materialled as a shadow silhouette).
The leather-jacket model is not used.

## Offline verification (no browser needed; these do NOT prove it renders)
    python3 tools/check_assets.py          # paths, GLB validity, config regexes vs real mesh names
    node tools/test_p1_logic.js            # asset manager / placement / config logic with a fake loader
    python3 tools/verify_car_geometry.py   # wheel fix maths on the real car vertices

## Re-generating assets
    python3 tools/optimize_doctor.py <original doctor .glb (in the previous Phase 1 ZIP: source_models/)> assets/characters/dr_arvind.glb
    python3 tools/optimize_glb.py <in.glb> <out.glb> [--base 1024] [--other 512] [--drop nodeName,...]

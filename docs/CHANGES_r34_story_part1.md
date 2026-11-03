# r34 — Story Part 1: investigation-driven missions

## What changed
- Replaced the previous seven-step fetch-and-return chain with five connected first-half story missions: The Return, The Missing Letters, The Medical Record, The Watchtower, and The Child in the Drawing.
- Reworked NPC dialogue so the villagers recognize the player, conceal information, and reveal the 18-year-old tragedy gradually.
- Added investigation stages with multiple clues per location, a workshop exploration step, and a watchtower climb.
- Added silent visual scare flashes for selected discoveries. No voice, TTS, or audio was added.
- Added a first-half cliffhanger: the school drawings connect the player to the night of the tragedy and imply SAAYA has followed the player for years. SAAYA's identity remains unrevealed.
- Added optional GLB prop loading with procedural fallback for supplied toolbox, sketchbook, school bag, and rusty key assets. The fallback remains if a GLB fails to load.
- Progress now uses `lv_p2_story_v2` so old fetch-quest save data cannot corrupt the new story progression.

## Files changed
- `js/p2-config.js`
- `js/p2-story.js`
- `tools/test_p2_logic.js`
- `assets/props/story/{toolbox,sketchbook,school_bag,rusty_key}.glb`

## Verification
- `node --check js/p2-config.js` — passed
- `node --check js/p2-story.js` — passed
- `node tools/test_p2_logic.js` — 54 passed, 0 failed
- This is offline logic verification only. A real browser / Android gameplay render test has not been performed in this environment.

## Asset note
The four GLB props were supplied by the user in `Assets for game.zip`. Their original source/licence metadata was not included in that ZIP, so check the source licences before public or commercial distribution.

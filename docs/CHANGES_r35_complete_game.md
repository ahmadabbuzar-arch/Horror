# r35 — Main story completion layer

## Added
- Added the second-half story chain: The Forgotten Grave, The Missing Villager, and The Last Ride.
- Reused existing graveyard and diary evidence props already present in r34; added a final car key interaction.
- Added an evidence notebook UI listing discovered names and clue IDs.
- Added a SAAYA encounter director that relocates the existing SAAYA character between configured encounter points and triggers close-range visual scares.
- Added four selectable endings: Escape, Truth, Forgotten, and Secret Bell.
- Kept dialogue subtitle-only; no voice/TTS was added.

## Verification
- `node --check` passed for new and existing story scripts.
- `node tools/test_p2_logic.js`: 54 passed, 0 failed.
- `python3 tools/check_assets.py`: all checks passed.
- Quest config validation: 8 quests and all referenced item IDs resolve.
- No real browser/Android render or end-to-end playthrough was performed. Encounter timing, item placement, and ending flow still need in-game validation.

## Known limitations
- The existing car driving system is reused; a full mechanical multi-part repair simulation was not added in this pass.
- SAAYA uses configured spawn-point relocations and scare flashes, not pathfinding or a full chase/attack AI.
- Ending choice is story/UI based; each ending currently plays a short text epilogue rather than a separate cinematic sequence.

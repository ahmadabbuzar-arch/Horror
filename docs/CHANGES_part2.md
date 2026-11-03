# PART 2 — NPCs, dialogue & missions (on top of r31/r33)

**New files:** `js/p2-config.js` (all dialogue, missions, item positions), `js/p2-story.js` (engine), `tools/test_p2_logic.js`.
**Edited (small):** `index.html` (2 script tags, 1 line that freezes walking while a dialogue/mission list is open, hint text), `js/p1-main.js` (calls `P2.start` / `P2.update` inside the existing guard).
**Untouched:** NPC models and spawn positions, village map, clinic, buildings, graveyard, gate, tower, car. Nothing is moved; while talking, an NPC only turns its body towards you and turns back afterwards.

## Controls
* Walk up to an NPC (≤ 2.9 m, looking at him) -> button **💬 <Name> se baat karo** (PC: **E**). Quest items: **E** / button within 2 m.
* Dialogue = subtitle box at the bottom: NPC name, typing effect, **Continue ▶** (tap the button or box; PC: Space / Enter / E / click). Tapping while it types finishes the line. No voice, no audio.
* **📜** button (PC: **J**) = mission list. Top-left = current objective. A yellow **!** floats above the NPC who is waiting for you.
* Progress is saved in `localStorage` (the graphics selector reloads the page). `?newgame` resets, `?mission=N` (0-6) jumps for testing.

## Mission chain (one active at a time, each unlocks the next)
| # | Who | Mission | Steps |
|---|---|---|---|
| 1 | Raghunath | Find missing toolbox | talk -> toolbox near the windmill -> return |
| 2 | Kamla Devi | Find missing letters | talk -> 3 letters (roadside / school side / graveyard fence) -> return |
| 3 | Dr. Arvind | Find missing medical register | talk (inside clinic) -> register outside the clinic's west wall -> return |
| 4 | Shyamlal | Find lantern, reach watchtower | talk -> lantern (west of the school) -> climb to the tower top deck -> talk |
| 5 | Chotu | Find drawing book at school | talk -> book in the school yard -> return |
| 6 | Graveyard | **The Forgotten Grave** | enter graveyard (open the east gate with E) -> hidden grave (revealed within 7 m, in a gap between two tombs) -> read 3 name stones |
| 7 | Dev | Missing villager + diary clues | talk -> 3 diary pages -> Mohan's coat at the forest edge -> talk |

Other NPCs give "not yet" lines until their mission is reached, then reminders, then after-lines. Names found (Hari Prasad, Savitri, Baldev, Munna, Lakshmi, Gopal) are listed in the mission list. After mission 7 the game just shows "Part 2 missions complete" — no ending.

## Tuning
Every item position is in `P2.config.items` (world metres; `snap:true` = moved to the nearest free spot among the village meshes). Graveyard items are offsets from the map centre (-26, 38) chosen from the tomb map of `graveyard_map.glb` (free nook around local (-5,-5)). Tower success = `places.tower` (`minY` 5.5 m, deck ~9 m). Typing speed: `typeSpeed`.

## NOT verified
Offline only: JS syntax, `node tools/test_p2_logic.js` (157 checks: the whole 7-mission chain through the real engine with a fake DOM/THREE), plus the existing p1 tests. **Not run in a browser** (no Three.js/network here). To check on a device: item spots may need a nudge (items inside walls/trees can't be reached — change x/z), tap sizes of the Continue button, and the tower deck height.

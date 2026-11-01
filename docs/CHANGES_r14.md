# r14 — watchtower "invisible wall / getting stuck" (NOT tested on a phone)
Cause (checked with tools/sim_tower_climb.py on the real tower triangles): the stair lanes are ~0.95 m wide and the body radius was 0.3 m. The climb only worked by a hair:
radius 0.35 already stops at 5 m, 0.4 at 6 m, 0.5 at 1 m. With a touch joystick that is an invisible wall (railings / stringers at 0.55 and 1.3 m height push you back).
1. `wallR` of the tower 0.3 -> 0.18 (js/p1-config.js). Sim: top deck reached with 0.18 and 0.25; much more slack.
2. index.html: the "no floor under you -> go back" edge guard used ONE ray under the player centre; plank/stair gaps made it fire in the middle of the deck. It now also samples 4 points 0.15 m around (only floors <= 0.5 m higher count).
If it still catches somewhere, tell me roughly where (height, which stair/landing) — then I can read that exact spot from the geometry.

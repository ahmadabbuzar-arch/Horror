# r9 — clinic/bunker removed, tower lift button (NOT yet run on a phone)
1. Removed the concrete clinic/bunker (west, -27/52): config entry + assets/props/clinic_bunker.glb.
2. Watchtower still could not be climbed on the phone after r8 (I could not reproduce it: the offline sim of the real stair triangles reaches the deck, but it is not a real browser run).
   Guaranteed fallback added: near the tower base (within 6.5 m, on the ground) a button "🪜 Tower par chadho" puts you on the deck (8.46 m); on the deck "🪜 Neeche utro" puts you back at the foot of the stairs.
   Config: `lift` on the tower entry in js/p1-config.js. Stair walking from r8 is kept (floor rays + wallR 0.3). If stairs still fail, send a screen recording of the first step.

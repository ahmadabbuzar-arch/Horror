# r31 — DR. ARVIND CLINIC (old abandoned clinic in the veranda house)
Which house: the 2-storey wooden house in the middle of the road (B2: door + lower window on the road side, veranda roof, no sign before).
NEW `js/p1-clinic.js` (+ `assets/props/clinic/*.glb`, 24 files, 3.6 MB, from the "Abandoned Hospital" pack + your stethoscope):
* **Sign board** "DR. ARVIND CLINIC" + cross, standing on the veranda roof, facing the road. EVERY LETTER IS ITS OWN LIGHT:
  `o` steady lit (8 letters + cross) · `f` flicker / lop-jhup (R, V, L: stable, then a burst of stutters, sometimes a short blackout) · `w` nearly dead (2nd N of ARVIND, 2nd I of CLINIC: dark, blink now and then).
  Change which letter does what: `CFG.sign.modes` (one code per letter: D R . A R V I N D | C L I N I C).
* **Lights**: green point light from the sign onto the veranda/road (follows the flicker), a flickering fluorescent tube inside + a broken tube hanging crooked, and a room light that pulses with the tube. (Low graphics: no point lights, only the glowing letters / tube.)
* **Props inside** (streamed: loaded within 45 m, freed beyond 75 m): doctor's desk (phone, clipboard, folder, stethoscope, medicine bottle) + swivel chair, medicine cabinet, filing cabinet (first-aid box, bandage), wall sink, wall clock, bin, examination bed under the window, surgical lamp, surgical trolley (tray, kidney dish, scalpel, forceps, syringe), visitor chair by the door. Furniture blocks the player (simple box collision). Stairs corner (west wall) and the door lane are kept free.
* **Dr. Arvind** now stands INSIDE the clinic (`CFG.doctor`), looking at the door. The old arvind spawn was B3 -> **Kamla Devi** moved to B3's front (p1-config.js).
* The clinic door button now reads "🏥 Clinic ka darwaza kholo / band karo".
Changed: `index.html` (script tag, `window.__villageG`, `village:` in the P1 world object), `js/p1-main.js` (start/update/collide hooks; clinic starts BEFORE the characters), `js/p1-config.js` (Kamla/Arvind spawns).
Tests: `node tools/test_clinic.js` (15 checks with a mock THREE: letter modes, Dr. re-home, colliders, load/unload). Layout was checked against the real house geometry offline (no overlaps; room 3.2 x 4.6 m, ceiling 1.89 m).
Tune: CFG at the top of js/p1-clinic.js (item x/z/yaw, sign position/colour, light strength). NOT tested in a browser.

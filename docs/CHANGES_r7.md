# r7 — drivable car + flicker fix (not yet run on a phone)
1. **Flickering surface**: village porch/floor meshes sit exactly at y=0, the same height as the big ground plane -> z-fighting (floor appears/disappears while you move slightly; your two screenshots 12:03/12:04). Ground plane now has polygonOffset (pushed back in depth) and the camera near/far went 0.05/220 -> 0.12/170 (fog hides everything past ~100 m anyway) for better depth precision. If it still flickers somewhere, tell me where — then that mesh needs raising 1-2 cm.
2. **Drivable car** (js/p1-drive.js): walk within 3.6 m of the sedan -> blue button "🚗 Car chalao" (or key C). Left joystick / WASD: up = gas, down = brake/reverse, left/right = steer. Right thumb looks around a little. Same button gets you out on the driver side.
   * max 47 km/h forward, 14 km/h reverse (config: P1.cfg.drive), engine hum via WebAudio, first-person from the driver seat (seat position in cfg.drive.seat)
   * collides with trees, the new props (boxes/circles/walls), village buildings and the hut (ray test); hits stop/bounce the car
   * NOT done: wheels do not spin/steer visually, no headlights, no damage, the car can't leave x/z ±148
   * tests: tools/test_drive.js (7 checks)

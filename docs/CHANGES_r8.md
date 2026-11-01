# r8 — 3 props removed, car seat + door fixed, watchtower climbable (NOT yet run on a phone)

1. **Removed** (config entries AND .glb files, ZIP is ~8 MB smaller): American house (east, 21/27), ruined log house (east, 16/54), boat (west field, -21/29).
   Everything else unchanged (tower, windmill, bunker, 2 wreck cars, village, hut, forest, NPCs).
2. **Driver seat was on the passenger side.** The sedan's steering wheel (node Object_9) is at car-local x=+0.37 m; the old seat was at x=-0.42.
   `P1.cfg.drive.seat` is now [0.37, 1.12, -0.10]. Getting out now puts you on the +X (driver) side.
3. **Car door**: you cannot sit down with the driver door closed any more. Tap "Car chalao" next to the DRIVER door (front door on the steering-wheel side, button
   appears within 3.4 m of that door): the door swings open (0.6 s), you sit, the door closes. Getting out: door opens, you step out, it closes after 2.5 s.
   Far from the driver door you get "Driver door ke paas jao". The door buttons also follow the car now (before, they stayed where the car had been parked).
4. **Watchtower**: two reasons you could not climb it, both fixed:
   * the player's floor ray only looked at village + hut meshes, never at the tower -> tower meshes are now floor (`climb:true`, `P1.propFloors`).
   * the wall rays used fixed heights (0.55 / 1.3 m) and a 0.5 m radius; the stair lanes are only 0.95 m wide -> rays start at the player's current floor height (`P1.gy`)
     and the tower uses `wallR: 0.3`.
   Checked offline with tools/sim_tower_climb.py (real tower triangles + the game's ray logic): radius 0.5 -> stuck at 1.1 m, radius 0.3 -> reaches the top deck (~9 m).
   Not checked: how it looks/feels on screen (stairs are 0.3 m deep, 17 cm risers; the first step is at local x=-0.3 on the tower's -Z face).
Tests: test_props.js (15), test_drive.js (13), test_p1_logic.js (33), check_assets.py all pass. None of this proves it renders.

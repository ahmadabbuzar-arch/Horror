# r4 changes (still NOT run in a browser)
1. SAAYA model replaced by "the_unvermeidlich_ghost_darkness_of_eclipse.glb" -> assets/characters/saaya.glb
   - textures optimised (8.6 MB -> 2.0 MB), T-pose baked to a standing pose (tools/bake_poses.py, chain table 'saaya'), checked in an offline render
   - uses the model's OWN textures (P1.config.saaya.ownLook = true, slight dark tint in appearance.saaya); set ownLook:false for the old flat-black shadow look
   - height 1.85 m (appearance.saaya.height), no stretch. The model has 4 clips (Stalking 1-3, Chasing) — unused in Phase 1, available for later
   - credits: original author/licence of this model unknown -> add to docs/CREDITS.md
2. Hut fence: was 0.72 m tall (knee-high) -> FENCE_SCALE = 1.7 in index.html -> 1.22 m. Only the 'Fence' mesh is stretched upward, base stays on the ground. Console: window.__fenceFix
3. Player: eye height 1.50 -> 1.35 m (EYE_H in index.html). Walking speed / collision untouched.

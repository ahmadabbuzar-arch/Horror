# Model inspection summary
| File | Used as | Format | Tris | Rig / clips | Notes |
|---|---|---|---|---|---|
| mechanic_low_poly_character | Raghunath | GLB, KHR_materials_unlit | 4.2k | Mixamo skeleton (66), clip `mixamo.com` duration 0 s | 1 mesh, 1 texture (1024 jpg) |
| old_lady_fbx | Kamla Devi | GLB, spec-gloss | 22k, 9 meshes | 137 bones, no clip | hat/teeth/tongue meshes separate |
| jordan doctor (clinical coat) | Dr. Arvind | GLB, KHR_texture_transform (required), KHR_materials_specular | 43.8k -> 36.7k | static, no clip | metres, ~1.85 m with afro, +Z; 27 MB -> 1.7 MB (4096 normal map -> 1024, teeth mesh removed) |
| guard | Shyamlal | GLB | 10.2k + pistol/cigarette (removed) | 75 bones, clip `allAnims` 51.9 s | 13 x 1024 textures -> 9 (<=1024/512) |
| dark_psychic_kid | Chotu | GLB | 12,915 (the 213k figure matches no file — see MODEL_STATS.md) | 54 bones, clip `idle` 1.67 s (looping) | stylised colours |
| man | Dev | GLB, spec-gloss | ~55k, 20 meshes | static, centimetres (181 cm), +Z, A-pose | 23 textures -> flat ones shrunk to 128 |
| horror_girl | SAAYA | GLB | 27k, 7 meshes | 54 bones, clip 2.73 s walk cycle with root motion | gore/blood textures; re-materialled |
| abandoned_generic_sedan | player's car | GLB, KHR_materials_specular | ~9.6k, 16 parts | none | 21.56 units long, +Z front, pre-posed damage, no glass/lamp meshes; front -X tyre MISSING (54-vertex brake disc only), front +X tyre yawed 23.4° (r2, measured from vertices) |
| gritty_elderly_man_in_leather_jacket | not used | GLB | 121k | static | per your correction |
Extracted from the original HTML: `V64` = village (2.9 MB), `B64` = hut (4.7 MB).

See docs/MODEL_STATS.md for exact per-file statistics and mesh/material names, docs/CREDITS.md for licences.

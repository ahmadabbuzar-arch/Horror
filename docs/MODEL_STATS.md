# Model statistics (measured from the real files, r2)

All numbers come from parsing the GLB accessors: **triangles = index count / 3 summed over every mesh node instance**; verts = POSITION accessor counts. `tools/check_assets.py` re-validates the shipped files.

## Source files as supplied vs. shipped (optimised)

| Role | Source file | Source MB | Source tris | Source verts | Mesh nodes | Shipped tris | Shipped MB |
|---|---|---|---|---|---|---|---|
| Raghunath | `mechanic_low_poly_character.glb` | 0.6 | 4,228 | 2,673 | 1 | 4,228 | 0.27 |
| Kamla Devi | `old_lady_fbx.glb` | 3.7 | 22,390 | 13,202 | 9 | 22,390 | 1.40 |
| Dr. Arvind | `jordan-3d-person-doctor-with-clinical-coat` | 26.6 | 43,840 | 31,336 | 20 | 36,720 | 1.70 |
| Shyamlal | `guard.glb` | 14.2 | 10,459 | 7,235 | 9 | 9,718 | 3.41 |
| Chotu | `dark_psychic_kid.glb` | 3.6 | 12,915 | 9,345 | 1 | 12,915 | 1.21 |
| Dev | `man.glb` | 11.5 | 55,561 | 31,070 | 20 | 55,561 | 2.87 |
| SAAYA | `horror_girl.glb` | 6.5 | 27,489 | 19,663 | 7 | 27,489 | 2.42 |
| Player car | `abandoned_generic_sedan_1_-_game_ready.glb` | 3.8 | 9,591 | 9,500 | 16 | 9,591 | 1.14 |
| (unused) | `gritty_elderly_man_in_leather_jacket.glb` | 18.0 | 121,134 | 195,371 | 5 | — | — |

Only the doctor (hidden teeth mesh, 4.5k verts) and the guard (pistol/cigarette) lose geometry in the shipped files; everything else keeps its full triangle count — only textures were reduced.

## Chotu triangle-count investigation
The brief mentioned "Chotu's 213k-triangle model". **No supplied file matches that.** `dark_psychic_kid.glb` (the Chotu model):

* 1 mesh (`boy_01 - Default_0`), 1 primitive, **9,345 vertices, 38,745 indices = 12,915 triangles**, 3 PNG textures, 54 joints, 1 clip `idle` (1.67 s).
* Single scene, no LOD nodes, no morph targets, no second mesh, no hidden geometry (checked every node/primitive).
* Its embedded metadata: *Dark Psychic Kid* by sebasxpm, CC-BY-4.0, https://sketchfab.com/3d-models/dark-psychic-kid-c098c598657843ca92ced396a8b22d33 (Sketchfab generator 12.67).
* The heaviest uploaded file is `gritty_elderly_man_in_leather_jacket` at **121,134 triangles / 195,371 vertices** (18 MB) — still not 213k, and it is not used. No sum of accessor counts in any file lands near 213,000 either except coincidences (horror_girl 197k, doctor 225k total *accessor entries*, which are not triangles).
* Conclusion: the 213k figure most likely belongs to a different model/listing (or a different export of this one). The shipped Chotu is the 12.9k-triangle file; **no optimisation of Chotu's geometry was needed** (only its 3 textures were recompressed).

## Mesh names per shipped character (use these in `P1.config.appearance[...].materials[].mesh` / `hide`)

**Raghunath** — `characters/raghunath.glb`  
meshes: `Mechanic_Material__25_0`  
materials: `Material__25`  

**Kamla Devi** — `characters/kamla_devi.glb`  
meshes: `Body_Material.001_0`, `Bottoms_Material.001_0`, `Hats_Material.001_0`, `Tops_Material.001_0`, `Eyes_Material.001_0`, `Shoes_Material.001_0`, `Above Teeth_Material.001_0`, `Tongue_Material.001_0`, `bottom Teeth_Material.001_0`  
materials: `Material.001`  

**Dr. Arvind** — `characters/dr_arvind.glb`  
meshes: `Clinical uniform | attached ID clip`, `Clinical uniform | original blank ID card`, `Doctor | connected stethoscope diaphragm`, `Doctor | continuous rear neck loop`, `Doctor | diaphragm connector`, `Doctor | fitted stethoscope tubing`, `Doctor | fitted stethoscope tubing.001`, `Doctor | stethoscope soft ear tip`, `Doctor | stethoscope soft ear tip.001`, `Doctor | unmarked stethoscope ear tube`, `Doctor | unmarked stethoscope ear tube.001`, `afro01`, `eyebrow001`, `eyelashes01`, `Hairline | fine scalp roots`, `Jordan | anatomical body`, `low-poly`, `male_casualsuit05`, `shoes04`  
materials: `black`, `white`, `steel`, `Jordan | anatomical body.afro01`, `Jordan | anatomical body.eyebrow001`, `Jordan | anatomical body.eyelashes01`, `Jordan | fine hair roots`, `Jordan | anatomical body.body`, `Jordan | anatomical body.low-poly`, `Jordan | top`, `Jordan | bottom`, `Jordan | anatomical body.shoes04`  

**Shyamlal** — `characters/shyamlal.glb`  
meshes: `body_1_body_0`, `face1_face_0`, `boots_boots_0`  
materials: `body`, `face`, `boots`  

**Chotu** — `characters/chotu.glb`  
meshes: `boy_01 - Default_0`  
materials: `01_-_Default`  

**Dev** — `characters/dev.glb`  
meshes: `man_Std_Tongue_0`, `man_Std_Skin_Head_0`, `man_Std_Skin_Body_0`, `man_Std_Skin_Arm_0`, `man_Std_Skin_Leg_0`, `man_Std_Nails_0`, `man_Std_Eyelash_0`, `man_Std_Eye_R_0`, `man_Std_Cornea_R_0`, `man_Std_Eye_L_0`, `man_Std_Cornea_L_0`, `man_Std_Upper_Teeth_0`, `man_Std_Lower_Teeth_0`, `man_Std_Eye_Occlusion_R_0`, `man_Std_Eye_Occlusion_L_0`, `man_Std_Tearline_R_0`, `man_Std_Tearline_L_0`, `man_Henley___Longsleeve_0`, `man_Jeans_0`, `man_Slip-ons_0`  
materials: `Std_Tongue`, `Std_Skin_Head`, `Std_Skin_Body`, `Std_Skin_Arm`, `Std_Skin_Leg`, `Std_Nails`, `Std_Eyelash`, `Std_Eye_R`, `Std_Cornea_R`, `Std_Eye_L`, `Std_Cornea_L`, `Std_Upper_Teeth`, `Std_Lower_Teeth`, `Std_Eye_Occlusion_R`, `Std_Eye_Occlusion_L`, `Std_Tearline_R`, `Std_Tearline_L`, `Henley___Longsleeve`, `Jeans`, `Slip-ons`  

**SAAYA** — `characters/saaya.glb`  
meshes: `Object_0`, `Object_1`, `Object_2`, `Object_3`, `Object_4`, `Object_5`, `Object_6`  
materials: `material0000`, `material0002`, `material0003`, `material0004`, `material0005`, `material0006`, `material0008`  

**Player car** — `vehicles/sedan.glb`  
meshes: `Object_0`, `Object_1`, `Object_2`, `Object_3`, `Object_4`, `Object_5`, `Object_6`, `Object_7`, `Object_8`, `Object_9`, `Object_10`, `Object_11`, `Object_12`, `Object_13`, `Object_14`, `Object_15`  
materials: `Material_1`  

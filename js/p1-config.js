/* THE LAST VILLAGE — Phase 1 CONFIG. Everything you are expected to tune lives here. Loaded after p1-core.js.
 * Units: metres, degrees for yaw. Regex values are strings: 'foo|bar' (case-insensitive) or '/foo/g'.
 * Nothing in this file has been verified on screen (UNTESTED build) — values are starting points. */
(function () {
  'use strict';
  const P1 = window.P1;

  /* ===================================================================================================
   * 1. NPC SPAWN POINTS  (PLACEHOLDERS — replace with designated locations when the level is designed)
   *   anchor : 'world'   absolute world coordinates (x,z) — use this for final designed locations
   *            'hut'     hut centre            'spawn'  the player's start position
   *            'village' centre of the village bounding box
   *            'entry'   the point in front of the first village door (where the "Gaon" button drops you)
   *            'door'    centre of village door number `door` (0 = first), e.g. {anchor:'door', door:2, x:2.5, z:0}
   *   x, z   : offset from the anchor (for 'world': the coordinates themselves)
   *   face   : {to:'entry'|'hut'|'spawn'|'village'|'door'(+door:n)}  |  {point:[x,z]}  |  {yaw:deg}   (yaw 0 = +Z, 90 = +X)
   *   snap   : true  -> if the exact spot is blocked, search nearby for a free one (ray test, once, at placement)
   *            false -> use EXACTLY this spot, never move it (a blocked spot is only reported in the console)
   *   Add  ?spawns  to the URL to draw a coloured pole + facing cone at every spawn point, ?debug for coordinates.
   * =================================================================================================== */
  const npcs = {
    raghunath: { anchor: 'entry', x:  3.0, z: -3.5, face: { to: 'entry' },  snap: true },
    kamla:     { anchor: 'entry', x:  1.5, z:  4.0, face: { to: 'entry' },  snap: true },
    arvind:    { anchor: 'entry', x:  4.0, z:  8.0, face: { to: 'entry' },  snap: true },
    shyamlal:  { anchor: 'entry', x:  0.5, z: -9.0, face: { to: 'entry' },  snap: true },
    chotu:     { anchor: 'entry', x:  6.0, z:  1.5, face: { to: 'hut' },    snap: true },
    dev:       { anchor: 'entry', x:  3.5, z: 14.0, face: { to: 'entry' },  snap: true },
    saaya:     { anchor: 'entry', x:  1.0, z: 20.0, face: { to: 'entry' },  snap: true }
    // designed-location example:  raghunath: { anchor: 'world', x: 12.5, z: 48.0, face: { yaw: 270 }, snap: false },
  };

  const placement = {
    clearRadius: 0.55,                       // body radius used for the free-space ray test
    searchRings: [0, 1.0, 1.8, 2.6, 3.4, 4.4], // metres from the target, tried in order when snap:true
    minSpacing: 1.3,                         // keep snapped NPCs this far apart
    minFromSpawn: 2.5,                       // keep snapped NPCs this far from the player's start
    gallery: { dx: -8.4, dz: 10, step: 1.2 } // ?gallery layout, relative to the hut centre
  };

  /* ===================================================================================================
   * 2. APPEARANCE  (per character)  — these are the knobs for improving village clothing / looks later
   *   height   metres, whole model incl. hair
   *   relax    lower T/A-pose arms procedurally (rigged models)       unlit  swap an unlit material for a lit one
   *   anim     name of a supplied clip to loop as the idle (null = procedural idle only)
   *   idleRate speed multiplier of the procedural idle
   *   hide     regex of mesh names to hide (kept in the file, just not drawn)
   *   headParts regex of separate head meshes that may turn (static, un-rigged models only)
   *   materials: ordered list of rules; EVERY rule whose regexes match a mesh is applied, in order:
   *       mesh:'regex'  mesh-name filter       mat:'regex' material-name filter  (omit = match all)
   *       tint:[r,g,b]  multiply into the existing colour (1 = unchanged)
   *       color:0xRRGGBB  multiply the texture by this colour instead of white
   *       set:{ roughness, metalness, emissive:0xRRGGBB, emissiveIntensity, opacity, side:'double'|'front' }
   *       grade:{ saturation, brightness, contrast, fade, tint:[r,g,b] }  re-colours the TEXTURE itself on a canvas
   *               (real desaturation / fading; costs one canvas pass per texture at load; 1 = unchanged, fade 0..1)
   *   Mesh names are listed in docs/MODEL_INSPECTION.md (and visible with ?debug in the console log).
   * =================================================================================================== */
  const SKIN  = [0.90, 0.88, 0.90];
  const FADED = [0.82, 0.82, 0.84];
  const appearance = {
    raghunath: { height: 1.64, relax: true, unlit: true, anim: null,
      materials: [{ mesh: '.', tint: [0.88, 0.86, 0.87] }] },
    kamla:     { height: 1.50, relax: true, hide: 'Hats|Teeth|Tongue',
      materials: [{ mesh: 'Body', tint: SKIN }, { mesh: 'Tops|Bottoms', tint: [0.80, 0.74, 0.72] }, { mesh: 'Shoes', tint: [0.85, 0.85, 0.85] }] },
    arvind:    { height: 1.76,
      materials: [{ mesh: 'anatomical', tint: SKIN }, { mesh: 'casualsuit', tint: [0.90, 0.87, 0.80] }, { mesh: 'shoes', tint: [0.85, 0.85, 0.85] }] },
    shyamlal:  { height: 1.75, relax: true, hide: 'cigarette|pistol|slide|trigger|clip|bullet',
      materials: [{ mesh: 'body|face|boots', tint: [0.90, 0.90, 0.92] }] },
    chotu:     { height: 1.20, anim: 'idle',
      materials: [{ mesh: '.', tint: [0.86, 0.88, 0.94] }] },
    dev:       { height: 1.72, hide: 'Tongue|Teeth|Occlusion|Tearline|Cornea|Nails',
      headParts: 'Skin_Head|Eyelash|Eye_|Cornea|Teeth|Occlusion|Tearline|Tongue',
      materials: [{ mesh: 'Skin|Eyelash', tint: SKIN }, { mesh: 'Henley|Jeans|Slip', tint: FADED }] },
    saaya:     { height: 1.90, relax: true, shadow: true, idleRate: 0.6, materials: [] } // look = section 3
  };

  /* ===================================================================================================
   * 3. SAAYA — supernatural shadow entity (replaces the original gory textures entirely)
   *   Body: very dark blue-black Phong surface -> picks up the torch beam (diffuse + wet specular sheen).
   *   Rim : view-dependent glow added to the emissive term -> the silhouette stays readable even unlit.
   *   stretch scales the figure in its own width/height/depth (x, y, z) to break the "little girl" proportions.
   * =================================================================================================== */
  const saaya = {
    bodyColor: 0x141a2a, specular: 0x7f93c4, shininess: 16, emissive: 0x03040a,
    rimColor: 0x5a78d8, rimPower: 2.2, rimStrength: 1.25, rimPulse: 0.18,  // pulse: +-fraction, slow breathing glow
    hairColor: 0x0a0c14,
    eyeMat: 'material0004', eyeColor: 0xe6eeff,                           // eye material name inside saaya.glb
    stretch: [0.88, 1.0, 0.88]
  };

  P1.config = { npcs: npcs, placement: placement, appearance: appearance, saaya: saaya };

  /* ---- car tuning (see also js/p1-core.js defaults) ---- */
  Object.assign(P1.cfg.car, {
    dx: 3.4, dz: 10.2, yaw: 2.2,   // metres from the hut centre / radians
    hoodDeg: 12, ajarFront: 0.3, doorOpenDeg: 55
  });
})();

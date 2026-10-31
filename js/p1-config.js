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
  /* r3: every NPC has its OWN spawn point, in front of its building (nobody stands near the starting hut any more).
   * Coordinates are absolute world metres (anchor:'world'). The village model has 5 buildings (+ the start hut) and no signs saying
   * which is the clinic / school / workshop, so the assignment below is by position and size — change x/z here to re-home anyone.
   * Spots are outdoors at the front door (an interior spawn is just another x/z). snap:true = if blocked, nudge to the nearest free spot.
   *   building      village building (west side of the road, numbered from the start): B1 first/closest ... B5 last/tallest (9.3 m)
   *   raghunath  B1 (7x7 m, nearest the start)       -> "mechanic workshop"      kamla    B2 (small house with veranda) -> "village house"
   *   arvind     B3 (shop front with sign board)     -> "clinic"                  chotu    B4 (large hall)               -> "abandoned school"
   *   shyamlal   B5 (tallest, far end of the road)   -> "watchtower"              dev      behind B2/B3, west, off the road -> "hidden house"
   *   saaya      far end behind B5; more encounter spots in saayaEncounters below (used by ?spawns markers now, by Phase 2 later) */
  const npcs = {
    raghunath: { place: 'mechanic workshop (B1)', anchor: 'world', x:   1.6, z: 14.0, face: { to: 'spawn' }, snap: true },
    kamla:     { place: 'village house (B2)',     anchor: 'world', x:  -1.2, z: 22.0, face: { to: 'spawn' }, snap: true },
    arvind:    { place: 'clinic (B3)',            anchor: 'world', x:  -0.6, z: 32.6, face: { to: 'spawn' }, snap: true },
    chotu:     { place: 'abandoned school (B4)',  anchor: 'world', x:   2.6, z: 40.0, face: { to: 'spawn' }, snap: true },
    shyamlal:  { place: 'watchtower (B5)',        anchor: 'world', x:   3.7, z: 57.0, face: { to: 'spawn' }, snap: true },
    dev:       { place: 'hidden house (behind B2/B3)', anchor: 'world', x: -10.3, z: 28.4, face: { yaw: 90 }, snap: true },
    saaya:     { place: 'supernatural encounter #1 (behind B5)', anchor: 'world', x: -3.5, z: 63.4, face: { to: 'spawn' }, snap: true }
  };
  // further SAAYA encounter points (world x,z + where she faces). Phase 1 only draws markers for them with ?spawns.
  const saayaEncounters = [
    { x: -3.5, z: 63.4, face: { to: 'spawn' }, note: 'behind the last building' },
    { x:  4.5, z: 47.0, face: { yaw: 270 },    note: 'road, between clinic and hall (seen at the edge of the torch beam)' },
    { x: -9.5, z: 36.0, face: { yaw: 90 },     note: 'behind the clinic, west tree line' },
    { x:  2.0, z:  3.0, face: { to: 'spawn' }, note: 'road just south of the first building' }
  ];

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
    raghunath: { height: 1.64, relax: false, unlit: true, anim: null,
      materials: [{ mesh: '.', tint: [0.88, 0.86, 0.87] }] },
    kamla:     { height: 1.50, relax: false, hide: 'Hats|Teeth|Tongue',
      materials: [{ mesh: 'Body', tint: SKIN }, { mesh: 'Tops|Bottoms', tint: [0.80, 0.74, 0.72] }, { mesh: 'Shoes', tint: [0.85, 0.85, 0.85] }] },
    arvind:    { height: 1.76,
      materials: [{ mesh: 'anatomical', tint: SKIN }, { mesh: 'casualsuit', tint: [0.90, 0.87, 0.80] }, { mesh: 'shoes', tint: [0.85, 0.85, 0.85] }] },
    shyamlal:  { height: 1.75, relax: false, hide: 'cigarette|pistol|slide|trigger|clip|bullet',
      materials: [{ mesh: 'body|face|boots', tint: [0.90, 0.90, 0.92] }] },
    chotu:     { height: 1.20, anim: 'idle',
      materials: [{ mesh: '.', tint: [0.86, 0.88, 0.94] }] },
    dev:       { height: 1.72, hide: 'Tongue|Teeth|Occlusion|Tearline|Cornea|Nails',
      headParts: 'Skin_Head|Eyelash|Eye_|Cornea|Teeth|Occlusion|Tearline|Tongue',
      materials: [{ mesh: 'Skin|Eyelash', tint: SKIN }, { mesh: 'Henley|Jeans|Slip', tint: FADED }] },
    // r4: SAAYA = new model "Darkness of Eclipse" ghost (own textures, standing pose baked by tools/bake_poses.py). Look knobs: saaya.ownLook below.
    saaya:     { height: 1.85, relax: false, shadow: true, idleRate: 0.55,
      materials: [{ mesh: 'Body', tint: [0.85, 0.85, 0.9] }, { mesh: 'Dress', tint: [0.78, 0.78, 0.84] }] }
  };

  /* ===================================================================================================
   * 3. SAAYA — supernatural shadow entity (replaces the original gory textures entirely)
   *   Body: very dark blue-black Phong surface -> picks up the torch beam (diffuse + wet specular sheen).
   *   Rim : view-dependent glow added to the emissive term -> the silhouette stays readable even unlit.
   *   stretch scales the figure in its own width/height/depth (x, y, z) to break the "little girl" proportions.
   * =================================================================================================== */
  const saaya = {
    // matte black shadow body: near-black diffuse, NO specular (no glossy blue-white), picks up the torch beam as a dull grey-blue shape
    bodyColor: 0x07080b, specular: 0x000000, shininess: 1, emissive: 0x000000,
    // subtle silhouette outline: thin (high power) dim cool rim, slowly breathing; stays readable at the edge of darkness without glowing
    rimColor: 0x2b3446, rimPower: 3.4, rimStrength: 0.55, rimPulse: 0.12,
    hairColor: 0x040508,
    // dim, unsettling eyes: small pale-grey glints that flicker slowly (never bright)
    eyeMat: 'material0004', eyeColor: 0x7d8494, eyeDim: 0.55, eyeFlicker: 0.30,
    // proportions that break the "little girl in a dress" read: taller, narrower, a touch longer
    stretch: [1, 1, 1],   // r4: new model has its own proportions
    ownLook: true         // r4: true = use the new model's own textures (tint in appearance.saaya); false = old flat black shadow look
  };

  P1.config = { npcs: npcs, placement: placement, appearance: appearance, saaya: saaya, saayaEncounters: saayaEncounters };

  /* ---- car tuning (see also js/p1-core.js defaults) ---- */
  Object.assign(P1.cfg.car, {
    dx: 3.4, dz: 10.2, yaw: 2.2,   // metres from the hut centre / radians
    hoodDeg: 12, ajarFront: 0.3, doorOpenDeg: 55
  });
})();

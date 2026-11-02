# r25 — cemetery texture fix
js/p1-props.js: material tint is now applied only ONCE per material (userData._p1tint). cemetery.glb / cemetery_fence.glb use one shared material for all meshes, so the per-mesh tint multiply (0.8^30) made graves + fence pitch black. part2 / part3 unchanged.

## r25b — auto landscape + fullscreen
index.html: on phones the "Khelo" button now enters fullscreen and locks landscape (screen.orientation.lock). Portrait shows a "rotate your phone" screen. Leaving fullscreen pauses to the menu. NEW manifest.webmanifest + assets/icon-192/512.png: "Add to Home screen" / Install app opens the game fullscreen + landscape directly.

## r26 — night sky + creepy mist (js/atmo.js, NEW)
* Sky dome (dark blue gradient, slowly drifting dark clouds with silver edges near the moon), 350-1100 twinkling stars (by graphics level), big moon with glow + halo.
* Creepy ground mist: 8-24 soft drifting fog sprites around the player (Low/Medium/High), faded out indoors, never pop in front of the camera.
* Fog is slightly denser (0.030) and "breathes" slowly. Fog colour = sky horizon colour so the treeline blends.
* Tune at the top of js/atmo.js: FOG_BASE (thicker/thinner), PRESET (stars / mist count), MOON_DIR (moon position). URL: ?nomist (no mist) ?nosky (old plain sky).
* NOT tested in a browser (no Three.js in the build sandbox); logic smoke-tested with a mock. If anything fails it disables itself and the game runs as before.

## r27 — more horror
Fog density 0.030 -> 0.062 (visibility ~40 m instead of ~100 m) with slow thickening waves, denser/taller mist (12-34 sprites), darker ambient light (0.95 -> 0.72), dark vignette on screen edges. Tune: FOG_BASE in js/atmo.js (0.045 = lighter, 0.08 = very thick), HemisphereLight intensity + #vig in index.html.

## r28 — realistic fog
The mist sprites (camera-facing, rotated cards) looked like vertical light beams. Replaced by 2/4/6 (Low/Medium/High) stacked horizontal fog layers with procedural noise in a shader (world-space, drifting with wind, fading with distance, off indoors). No texture file needed. Tune in js/atmo.js: PRESET.layers (more = thicker/softer, heavier on GPU), uDens (opacity per layer), uCol (fog tint), MIST_FRAG smoothstep(0.30,0.78) (higher first number = fewer, more separate banks).

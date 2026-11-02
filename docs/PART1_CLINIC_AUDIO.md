# Part 1 clinic and audio integration

## Clinic
- Uses the existing B3 building already present in `assets/models/village.glb`.
- B3 bounds were inspected from the GLB: approximately X -8.47..1.84 and Z 36.61..43.58.
- Added a signboard on the east/road-facing facade, without moving or modifying the building.
- Added lightweight procedural decorative clinic furnishings within the existing B3 footprint.
- No clinic building/model was downloaded or created.

## Ambient audio
The modular optional audio loader is in `js/p1-clinic-audio.js`.
It looks for:
- `assets/audio/wind.mp3`
- `assets/audio/crickets.mp3`
- `assets/audio/wood_creaks.mp3`

No sound recordings were supplied in the uploaded ZIP, so these files are not fabricated or included. Missing files are handled as optional. Playback waits for the first pointer/key interaction to satisfy mobile browser autoplay rules.

## Scope
No missions, inventory, dialogue, SAAYA AI, car repair progression, or endings were added.

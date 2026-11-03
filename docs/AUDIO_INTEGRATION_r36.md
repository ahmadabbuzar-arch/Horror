# THE LAST VILLAGE — Audio Integration r36

## Added
- 27 selected sounds from the user-provided `Horror SFX Free.zip` in `assets/audio/horror/`.
- Low-volume looping night ambience (drone + frogs), unlocked only after a user gesture.
- Context sounds: walking/running footsteps, sprint breathing, flashlight toggle, doors, car doors, clue searching, mission-complete stinger, and SAAYA proximity scare sounds.
- Random quiet environmental creaks/taps with long cooldowns to avoid constant repetition.
- Audio playback is optional and fails silently if a browser blocks playback or a file is missing.

## Intentionally not imported
The pack contains 150 audio files. 27 relevant, non-gory sounds were selected. Unrelated kitchen/liquid/office recordings and graphic gore effects were not added to the game.

## Verification
- JavaScript syntax checks passed for modified scripts.
- Existing offline tests passed: clinic 15, drive 13, gate 11, hut-ground 13, P1 logic 33, P2 story 54, props 20 (159 assertions total).
- Browser/mobile gameplay audio has not been physically tested in this environment. Confirm sound levels on the target phone and adjust master volume in `js/p1-audio.js` if needed.
- The supplied sound ZIP did not include a visible licence/readme file. Check its redistribution terms before publishing the game.

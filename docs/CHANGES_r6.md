# r6 — fixes after the first phone test of r5 (screenshots: house torn open + floating, bunker walls missing, ruin shredded)
1. **Back-face culling**: glTF materials are single-sided, so every wall/ground seen from behind vanished (house, bunker, scan terrain). All prop materials are now DoubleSide (js/p1-props.js build()).
2. **House floated ~1.6 m**: the scan lot's lowest point is 1.6 m below the house floor and was used as ground. New per-prop `baseY` (model units); house uses 172. Lot parts lower than that sink under the game's ground plane.
3. **Ruined house**: vertex-cluster decimation shredded the planks -> back to the full 100k tris (4.8 MB).
Still unverified on screen: yaw/front of each building, interior wall collision, windmill/tower/boat.

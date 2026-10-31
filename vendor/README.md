# vendor/ — offline Three.js (optional)
`index.html` loads Three.js **r128** from the jsDelivr CDN exactly like the original project.
If the CDN is unreachable it falls back to these two files, which you must add yourself
(they could not be downloaded when this package was built):

* `vendor/three.min.js`   — https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js
* `vendor/GLTFLoader.js`  — https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js

Do NOT use a newer Three.js: the project is written for r128 (global `THREE`, classic scripts).

/* THE LAST VILLAGE — r26 ATMOSPHERE: night sky (gradient dome + drifting clouds), twinkling stars, big moon with glow,
 * creepy low ground mist (drifting soft sprites around the player) and slowly "breathing" fog.
 * Usage (index.html): ATMO.init(scene, GQ, renderer)  once;  ATMO.update(dt, tSeconds, camera, groundY, indoor)  every frame.
 * URL switches: ?nomist (no mist sprites)  ?nosky (old plain background).  Wrapped in try/catch: if anything fails the game runs as before. */
(function () {
  'use strict';
  const T = THREE;
  const A = (window.ATMO = { ready: false });
  // quality presets: stars, mist sprites, dome clouds on/off
  const PRESET = { high: { stars: 1100, layers: 6, clouds: true }, medium: { stars: 650, layers: 4, clouds: true }, low: { stars: 350, layers: 2, clouds: false } };
  const FOG_COL = 0x0e1524, FOG_BASE = 0.062;   // r27: much denser (visibility ~40 m, far trees vanish into the dark)
  const MOON_DIR = new T.Vector3(-0.55, 0.50, 0.38).normalize();
  const R_SKY = 100, MIST_R = 22;
  let scene, dome, stars, moon, glow, mist = [], P, fog, tU = { value: 0 }, pr = 1;
  
  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function moonTex() {
    const c = cv(256, 256), x = c.getContext('2d');
    x.beginPath(); x.arc(128, 128, 100, 0, 7); x.closePath();
    const g = x.createRadialGradient(108, 108, 10, 128, 128, 100);
    g.addColorStop(0, '#f4f6ff'); g.addColorStop(1, '#b9c4e0'); x.fillStyle = g; x.fill();
    x.save(); x.clip();
    for (let i = 0; i < 16; i++) {                         // maria / craters
      const px = rnd(40, 216), py = rnd(40, 216), rad = rnd(8, 30);
      const h = x.createRadialGradient(px, py, 0, px, py, rad);
      h.addColorStop(0, 'rgba(110,122,150,0.55)'); h.addColorStop(1, 'rgba(110,122,150,0)');
      x.fillStyle = h; x.fillRect(0, 0, 256, 256);
    }
    x.restore();
    const e = x.createRadialGradient(128, 128, 88, 128, 128, 100);   // soft rim
    e.addColorStop(0, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(8,12,24,0.35)');
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = e; x.fillRect(0, 0, 256, 256);
    return new T.CanvasTexture(c);
  }
  function glowTex() {
    const c = cv(256, 256), x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(190,208,255,0.55)'); g.addColorStop(0.25, 'rgba(140,165,235,0.22)');
    g.addColorStop(0.6, 'rgba(90,115,190,0.07)'); g.addColorStop(1, 'rgba(60,80,150,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return new T.CanvasTexture(c);
  }

  /* ---------------------------------------------------------------- sky dome */
  function makeDome() {
    const mat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { uT: tU, uMoon: { value: MOON_DIR.clone() }, uClouds: { value: P.clouds ? 1 : 0 } },
      vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: [
        'varying vec3 vD;uniform float uT;uniform vec3 uMoon;uniform float uClouds;',
        'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
        'float fbm(vec2 p){float a=0.5,s=0.0;for(int i=0;i<3;i++){s+=a*n(p);p*=2.03;a*=0.5;}return s;}',
        'void main(){',
        ' vec3 d=normalize(vD);float y=d.y;',
        ' vec3 hor=vec3(0.055,0.082,0.141);vec3 zen=vec3(0.012,0.020,0.055);',
        ' vec3 col=mix(hor,zen,pow(clamp(y,0.0,1.0),0.5));',
        ' if(y<0.0)col=hor*(1.0+y*0.6);',
        ' float md=max(dot(d,uMoon),0.0);',
        ' col+=vec3(0.10,0.13,0.22)*pow(md,6.0)*0.8+vec3(0.18,0.22,0.34)*pow(md,40.0);',   // moon halo in the sky
        ' if(uClouds>0.5&&y>0.0){',
        '  vec2 uv=d.xz/(y+0.30)*1.5+vec2(uT*0.012,uT*0.004);',
        '  float c=fbm(uv);c=smoothstep(0.42,0.80,c)*smoothstep(0.0,0.22,y);',
        '  vec3 cc=vec3(0.020,0.028,0.055)+vec3(0.20,0.24,0.36)*pow(md,5.0);',            // dark clouds, silver edges near the moon
        '  col=mix(col,cc,c*0.70);',
        ' }',
        ' gl_FragColor=vec4(col,1.0);}'
      ].join('\n')
    });
    const m = new T.Mesh(new T.SphereGeometry(R_SKY, 24, 16), mat);
    m.renderOrder = -10; m.frustumCulled = false; return m;
  }

  /* ---------------------------------------------------------------- stars */
  function makeStars() {
    const n = P.stars, pos = new Float32Array(n * 3), size = new Float32Array(n), ph = new Float32Array(n), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let y; do { y = Math.random(); } while (y < 0.04);               // upper hemisphere only
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - y * y), R = R_SKY * 0.96;
      pos[i * 3] = Math.cos(a) * r * R; pos[i * 3 + 1] = y * R; pos[i * 3 + 2] = Math.sin(a) * r * R;
      size[i] = Math.random() < 0.07 ? rnd(2.6, 3.6) : rnd(1.0, 2.1); ph[i] = Math.random() * 6.28;
      const w = Math.random(); col[i * 3] = 0.75 + 0.25 * w; col[i * 3 + 1] = 0.82 + 0.15 * w; col[i * 3 + 2] = 1.0;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aSize', new T.BufferAttribute(size, 1));
    g.setAttribute('aPh', new T.BufferAttribute(ph, 1)); g.setAttribute('aCol', new T.BufferAttribute(col, 3));
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, fog: false, blending: T.AdditiveBlending,
      uniforms: { uT: tU, uPR: { value: pr } },
      vertexShader: 'attribute float aSize;attribute float aPh;attribute vec3 aCol;uniform float uT;uniform float uPR;varying float vA;varying vec3 vC;' +
        'void main(){vC=aCol;vA=0.55+0.45*sin(uT*(1.2+aPh*0.25)+aPh*7.0);gl_PointSize=aSize*uPR;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying float vA;varying vec3 vC;void main(){float d=length(gl_PointCoord-0.5)*2.0;float a=smoothstep(1.0,0.0,d);gl_FragColor=vec4(vC*a*vA,1.0);}'
    });
    const p = new T.Points(g, mat); p.renderOrder = -9; p.frustumCulled = false; return p;
  }

  /* ---------------------------------------------------------------- moon */
  function makeMoon() {
    const g = new T.Group();
    const gm = new T.Mesh(new T.PlaneGeometry(64, 64), new T.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, depthTest: true, fog: false, blending: T.AdditiveBlending }));
    const mm = new T.Mesh(new T.PlaneGeometry(13, 13), new T.MeshBasicMaterial({ map: moonTex(), transparent: true, depthWrite: false, depthTest: true, fog: false }));
    gm.renderOrder = -8; mm.renderOrder = -7; mm.position.z = 0.05;
    g.add(gm, mm); g.frustumCulled = false; return g;
  }

  /* ---------------------------------------------------------------- ground mist (r28)
   * Stacked horizontal fog layers (a few big planes at different heights that follow the player) with PROCEDURAL noise in the shader.
   * The noise is sampled in WORLD space, so the fog banks stay in place and slowly drift with the wind; they thin out with distance and
   * fade near the camera. No sprites -> no light-beam / card look, no hard edges, no texture file needed. */
  const MIST_VERT = 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}';
  const MIST_FRAG = [
    'varying vec3 vW;uniform float uT;uniform vec3 uCam;uniform float uSeed;uniform float uDens;uniform float uFade;uniform vec3 uCol;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float a=0.5,s=0.0;for(int i=0;i<4;i++){s+=a*n(p);p=p*2.07+vec2(17.0,5.0);a*=0.5;}return s;}',
    'void main(){',
    ' vec2 p=vW.xz*0.085+vec2(uSeed*13.0,uSeed*7.0);',
    ' vec2 wind=vec2(uT*0.030,uT*0.011)*(0.6+uSeed*0.35);',
    ' float a=fbm(p+wind);float b=fbm(p*1.9-wind*1.4+vec2(5.2,1.3));',
    ' float m=smoothstep(0.30,0.78,a*0.62+b*0.46);',
    ' float d=length(vW.xz-uCam.xz);',
    ' float rad=1.0-smoothstep(12.0,34.0,d);',
    ' float near=smoothstep(0.8,4.5,d);',
    ' float al=m*uDens*rad*near*uFade;',
    ' gl_FragColor=vec4(uCol*(0.85+0.3*m),al);}'
  ].join('\n');
  function makeMist() {
    const L = P.layers;
    for (let i = 0; i < L; i++) {
      const u = { uT: tU, uCam: { value: new T.Vector3() }, uSeed: { value: i * 1.37 + 0.5 }, uDens: { value: 0.62 / Math.sqrt(L) }, uFade: { value: 1 },
                  uCol: { value: new T.Vector3(0.36, 0.43, 0.56) } };
      const mat = new T.ShaderMaterial({ uniforms: u, vertexShader: MIST_VERT, fragmentShader: MIST_FRAG, transparent: true, depthWrite: false, depthTest: true, fog: false, side: T.DoubleSide });
      const m = new T.Mesh(new T.PlaneGeometry(80, 80, 1, 1), mat);
      m.rotation.x = -Math.PI / 2; m.renderOrder = 2; m.frustumCulled = false;
      m.userData = { u: u, dy: 0.10 + (L > 1 ? i * (1.12 / (L - 1)) : 0.3) };
      scene.add(m); mist.push(m);
    }
  }

  /* ---------------------------------------------------------------- API */
  A.init = function (sc, GQ, renderer) {
    try {
      scene = sc; P = PRESET[GQ && GQ.id] || PRESET.medium; pr = Math.min(2, renderer && renderer.getPixelRatio ? renderer.getPixelRatio() : 1);
      const q = location.search;
      scene.fog = new T.FogExp2(FOG_COL, FOG_BASE); fog = scene.fog; scene.background = new T.Color(FOG_COL);
      if (!/[?&]nosky\b/.test(q)) {
        dome = makeDome(); stars = makeStars(); moon = makeMoon();
        scene.add(dome, stars, moon);
      }
      if (!/[?&]nomist\b/.test(q)) makeMist();
      A.moonDir = MOON_DIR.clone(); A.mistFade = 1; A.ready = true;
    } catch (e) { console.warn('[atmo] init failed, game continues without it', e); A.ready = false; }
  };

  const tmp = new T.Vector3();
  A.update = function (dt, t, cam, gy, indoor) {
    if (!A.ready) return;
    try {
      tU.value = t;
      const cp = cam.position;
      if (dome) { dome.position.copy(cp); stars.position.copy(cp); }
      if (moon) { moon.position.copy(cp).addScaledVector(MOON_DIR, R_SKY * 0.93); moon.lookAt(cp); }
      // fog "breathes" slowly (thicker / thinner waves) -> creepy, never fully clear
      const surge = Math.max(0, Math.sin(t * 0.045 + 2.0)) ** 3;      // every ~2 min the fog slowly thickens for a while
      if (fog) fog.density = FOG_BASE * (1 + 0.16 * Math.sin(t * 0.11) + 0.08 * Math.sin(t * 0.37 + 1.3) + 0.30 * surge);
      // mist off indoors (smooth), on outdoors
      A.mistFade += ((indoor ? 0 : 1) - A.mistFade) * Math.min(1, dt * 2.5);
      const base = gy || 0;
      for (const m of mist) {
        const u = m.userData.u;
        m.position.set(cp.x, base + m.userData.dy + Math.sin(t * 0.2 + m.userData.dy * 5) * 0.05, cp.z);
        u.uCam.value.copy(cp); u.uFade.value = A.mistFade;
      }
    } catch (e) { console.warn('[atmo] update failed, disabled', e); A.ready = false; }
  };
})();

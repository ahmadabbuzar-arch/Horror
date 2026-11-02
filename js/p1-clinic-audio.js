/* THE LAST VILLAGE — clinic dressing + optional ambient audio (Part 1).
 * Uses the existing B3 building in village.glb. No replacement building or downloaded model.
 * Procedural low-poly props are intentionally lightweight and decorative.
 */
(function () {
  'use strict';
  const T = window.THREE;
  const P1 = window.P1 = window.P1 || {};
  let clinicGroup = null, audio = [], audioStarted = false;

  function mat(color, roughness) {
    return new T.MeshStandardMaterial({ color: color, roughness: roughness == null ? 0.9 : roughness });
  }
  function box(parent, name, x,y,z, sx,sy,sz, material) {
    const m = new T.Mesh(new T.BoxGeometry(sx,sy,sz), material);
    m.name = name; m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function cylinder(parent, name, x,y,z, rt, rb, h, material, seg) {
    const m = new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg||8), material);
    m.name=name; m.position.set(x,y,z); m.castShadow=true; parent.add(m); return m;
  }
  function labelTexture() {
    const c=document.createElement('canvas'); c.width=768; c.height=256;
    const x=c.getContext('2d');
    x.fillStyle='#e8dfc7'; x.fillRect(0,0,768,256);
    x.strokeStyle='#493a2b'; x.lineWidth=15; x.strokeRect(9,9,750,238);
    x.fillStyle='#263b31'; x.textAlign='center'; x.font='bold 74px sans-serif'; x.fillText('CLINIC',384,104);
    x.font='bold 43px sans-serif'; x.fillText('ग्रामीण स्वास्थ्य केंद्र',384,174);
    x.fillStyle='#8b3329'; x.fillRect(240,194,288,7);
    const t=new T.CanvasTexture(c); t.encoding=T.sRGBEncoding; return t;
  }
  function makeClinic(world) {
    if (clinicGroup || !world || !world.scene) return;
    clinicGroup = new T.Group(); clinicGroup.name='P1_Existing_B3_Clinic_Dressing';
    // B3 is the existing shop-front building in village.glb. Its east facade faces the road (+X).
    // These coordinates are derived from the B3 mesh bounds; the building itself is untouched.
    const sign = new T.Group(); sign.name='Clinic signboard';
    box(sign,'Clinic sign backing',0,0,0,2.35,0.82,0.12,mat(0x35291f));
    const face = new T.Mesh(new T.PlaneGeometry(2.18,0.68),new T.MeshBasicMaterial({map:labelTexture(),side:T.DoubleSide}));
    face.position.z=0.067; sign.add(face);
    sign.position.set(1.93,4.15,40.15);
    sign.rotation.y=Math.PI/2;
    clinicGroup.add(sign);

    // Decorative interior furnishings inside B3's existing footprint. No building geometry is created.
    const inside = new T.Group(); inside.name='B3 clinic interior props';
    const wood=mat(0x49372a), darkWood=mat(0x2c241e), cloth=mat(0x9b9a83), metal=mat(0x59615e,0.55);
    const cream=mat(0xd8d1bd), bottle=mat(0x718b75,0.45), red=mat(0x8c3931);
    // Examination cot
    box(inside,'Clinic bed frame',-4.0,0.48,39.25,1.75,0.18,0.72,wood);
    box(inside,'Clinic mattress',-4.0,0.63,39.25,1.68,0.16,0.66,cloth);
    box(inside,'Clinic pillow',-4.55,0.75,39.25,0.38,0.10,0.48,cream);
    for (const x of [-4.72,-3.28]) for (const z of [38.98,39.52]) cylinder(inside,'Bed leg',x,0.22,z,0.045,0.055,0.48,metal,6);
    // Doctor's desk and chair
    box(inside,'Doctor desk top',-1.75,0.92,41.0,1.25,0.12,0.65,wood);
    for (const x of [-2.27,-1.23]) for (const z of [40.76,41.24]) box(inside,'Desk leg',x,0.44,z,0.08,0.88,0.08,darkWood);
    box(inside,'Desk drawer',-1.75,0.72,41.0,0.72,0.24,0.52,darkWood);
    box(inside,'Chair seat',-1.75,0.53,42.0,0.55,0.12,0.52,wood);
    box(inside,'Chair back',-1.75,0.92,42.22,0.55,0.68,0.10,wood);
    for (const x of [-1.98,-1.52]) for (const z of [41.8,42.2]) box(inside,'Chair leg',x,0.26,z,0.055,0.52,0.055,metal);
    // Medicine shelf
    box(inside,'Medicine shelf back',-6.15,1.45,40.1,0.12,1.65,1.15,wood);
    for (const y of [0.82,1.35,1.88,2.41]) box(inside,'Medicine shelf plank',-6.02,y,40.1,0.32,0.07,1.12,darkWood);
    for (let row=0;row<3;row++) for(let col=0;col<3;col++) {
      const b=cylinder(inside,'Medicine bottle',-5.88,0.98+row*0.53,39.78+col*0.31,0.075,0.085,0.28,bottle,8);
      b.rotation.z=0.02;
      box(inside,'Bottle label',-5.79,0.98+row*0.53,39.78+col*0.31,0.012,0.10,0.10,cream);
    }
    // Cabinet + red medical cross
    box(inside,'Medical cabinet',-6.15,0.9,42.0,0.48,1.55,0.72,cream);
    box(inside,'Cabinet door',-5.89,0.9,42.0,0.035,1.42,0.62,mat(0xc7c0ad));
    box(inside,'Medical cross vertical',-5.86,1.45,42.0,0.025,0.40,0.12,red);
    box(inside,'Medical cross horizontal',-5.86,1.45,42.0,0.025,0.12,0.40,red);
    clinicGroup.add(inside);
    world.scene.add(clinicGroup);
    P1.info.clinic = { building:'existing B3', sign:'added', props: 'procedural low-poly interior set' };
    P1.status.clinic = 'ready (existing B3 dressed; no new building)';
  }

  function startAudio(world) {
    if (P1.audio || !world || !world.cam) return;
    const defs = [
      ['wind','assets/audio/wind.mp3',0.20],
      ['crickets','assets/audio/crickets.mp3',0.12],
      ['wood-creaks','assets/audio/wood_creaks.mp3',0.10]
    ];
    const list = defs.map(d => {
      const a = new Audio(d[1]); a.loop=true; a.preload='none'; a.volume=d[2];
      a.addEventListener('error',()=>{ P1.status['audio:'+d[0]]='file missing (optional)'; });
      P1.status['audio:'+d[0]]='waiting for file/user gesture';
      return {id:d[0],el:a,src:d[1]};
    });
    function unlock() {
      if (audioStarted) return;
      audioStarted=true;
      list.forEach(o=>{ o.el.play().then(()=>{P1.status['audio:'+o.id]='playing';}).catch(()=>{P1.status['audio:'+o.id]='waiting for audio file or browser permission';}); });
      window.removeEventListener('pointerdown',unlock); window.removeEventListener('keydown',unlock);
    }
    window.addEventListener('pointerdown',unlock,{once:true});
    window.addEventListener('keydown',unlock,{once:true});
    audio=list; P1.audio={list:list, setVolume:function(v){list.forEach(o=>o.el.volume=Math.max(0,Math.min(1,v)));}, stop:function(){list.forEach(o=>o.el.pause());}};
    P1.status.audio='ready (optional files in assets/audio; starts after user interaction)';
  }

  P1.startClinicAudio = function(world) {
    try { makeClinic(world); } catch(e) { P1.warn('clinic dressing failed',e); }
    try { startAudio(world); } catch(e) { P1.warn('ambient audio init failed',e); }
  };
  P1.disposeClinicAudio = function() {
    if (clinicGroup && clinicGroup.parent) clinicGroup.parent.remove(clinicGroup);
    clinicGroup=null; if(P1.audio)P1.audio.stop();
  };
})();
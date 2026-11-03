/* THE LAST VILLAGE r37 — realtime 3D cutscenes. Uses existing world models; no replacement scene. */
(function(){
 'use strict';
 const C=window.LV_CUTSCENE=window.LV_CUTSCENE||{};
 let active=false,elapsed=0,shots=[],ui=null,world=null,oldLock=false,oldYaw=0,oldPitch=0,oldPos=null,saaya=null,saayaOld=null,carLights=null,midPlayed=false;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function makeUI(){
  if(ui)return;
  const style=document.createElement('style');style.textContent=`#lvcs{position:fixed;inset:0;z-index:60;pointer-events:none;color:#fff;font-family:system-ui,sans-serif}#lvcs:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.48),transparent 24%,transparent 68%,rgba(0,0,0,.72));}#lvcsbar{position:absolute;left:0;right:0;top:0;height:9vh;background:#000;transform:scaleY(0);transform-origin:top;transition:transform .35s}#lvcsbar.b{top:auto;bottom:0;transform-origin:bottom}#lvcsname{position:absolute;left:5vw;right:5vw;bottom:16vh;text-align:center;color:#f2b66e;font-size:clamp(12px,2vw,17px);font-weight:700;text-shadow:0 2px 5px #000}#lvcstext{position:absolute;left:7vw;right:7vw;bottom:8vh;text-align:center;font-size:clamp(15px,2.5vw,22px);line-height:1.45;text-shadow:0 2px 6px #000;min-height:2.8em}#lvcsskip{position:absolute;right:14px;top:14px;pointer-events:auto;border:1px solid #aaa;background:#111c;color:white;border-radius:20px;padding:8px 14px;font-size:13px}`;document.head.appendChild(style);
  ui=document.createElement('div');ui.id='lvcs';ui.innerHTML='<div id="lvcsbar"></div><div id="lvcsbar" class="b"></div><div id="lvcsname"></div><div id="lvcstext"></div><button id="lvcsskip">Skip ▶</button>';document.body.appendChild(ui);
  ui.querySelector('#lvcsskip').onclick=finish;
 }
 function say(name,text){if(!ui)return;ui.querySelector('#lvcsname').textContent=name||'';ui.querySelector('#lvcstext').textContent=text||'';}
 function finish(){if(!active)return;active=false;if(ui)ui.remove();ui=null;if(world&&world.cam){world.cam.position.copy(oldPos);world.cam.rotation.set(oldPitch,oldYaw,0)}if(world){world.pos.x=world.playerX;world.pos.z=world.playerZ;}if(saaya&&saayaOld){saaya.position.copy(saayaOld.p);saaya.rotation.y=saayaOld.y;saaya.visible=saayaOld.v;}if(carLights&&world&&world.P1&&world.P1.car&&world.P1.car.setLights)world.P1.car.setLights(false);if(window.P2)window.P2.locked=oldLock;}
 function vec(x,y,z){return new THREE.Vector3(x,y,z)}
 C.start=function(w){if(active||!w||!w.cam||!w.pos||!window.THREE)return;world=w;const P=w.P1||window.P1||{};const car=P.car&&P.car.ready&&P.car.holder?P.car.holder:null;const cp=car?car.position.clone():vec(w.pos.x,0,w.pos.z);const yaw=car?car.rotation.y:0;const forward=vec(Math.sin(yaw),0,Math.cos(yaw));const side=vec(forward.z,0,-forward.x);const target=cp.clone().add(vec(0,1,0));
  oldLock=!!(window.P2&&P2.locked);if(window.P2)P2.locked=true;oldYaw=w.yaw||0;oldPitch=w.pitch||0;oldPos=w.cam.position.clone();w.playerX=w.pos.x;w.playerZ=w.pos.z;
  const slot=P.characters&&P.characters.get?P.characters.get('saaya'):null;saaya=slot&&slot.holder?slot.holder:null;if(saaya){saayaOld={p:saaya.position.clone(),y:saaya.rotation.y,v:saaya.visible};saaya.visible=true;saaya.position.copy(cp.clone().add(forward.clone().multiplyScalar(-5)).add(side.clone().multiplyScalar(1.8)));saaya.position.y=0;saaya.rotation.y=Math.atan2(cp.x-saaya.position.x,cp.z-saaya.position.z)}
  if(car&&P.car.setLights){P.car.setLights(true);carLights=true}
  shots=[
   {d:0,dur:4.2,from:cp.clone().add(vec(10,5,13)),to:target,name:'NARRATOR',text:'Raat ke 2:17 baje… ek sunsaan sadak par tumhari car control se bahar ho jaati hai.'},
   {d:4.2,dur:3.8,from:cp.clone().add(vec(-7,2.5,7)),to:target,name:'',text:'BRAAAAK!  Takkar ke baad engine band ho jaata hai. Charon taraf sirf sannata hai.'},
   {d:8,dur:4.2,from:cp.clone().add(forward.clone().multiplyScalar(-7)).add(vec(0,2,0)),to:target,name:'TUM',text:'Ye… kaunsi jagah hai? Koi hai yahan?'},
   {d:12.2,dur:3.8,from:cp.clone().add(forward.clone().multiplyScalar(-4)).add(side.clone().multiplyScalar(2)).add(vec(0,1.8,0)),to:saaya?saaya.position.clone().add(vec(0,1,0)):target,name:'',text:'Torch ki roshni mein ek saya kuch pal ke liye nazar aata hai… phir gayab.'},
   {d:16,dur:4.5,from:cp.clone().add(vec(0,2.2,-9)),to:target,name:'NARRATOR',text:'Tumhe nahi pata… ye gaon tumhare liye ajnabi nahi hai. 18 saal pehle tum yahin the.'},
   {d:20.5,dur:3.2,from:oldPos.clone(),to:vec(w.pos.x,1.35,w.pos.z),name:'NARRATOR',text:'Subah hone se pehle sach dhoondhna hoga. THE LAST VILLAGE.'}
  ];elapsed=0;active=true;makeUI();ui.querySelectorAll('#lvcsbar').forEach(x=>x.style.transform='scaleY(1)');if(window.P1SFX){P1SFX.play('door',.18);P1SFX.play('stinger_slow',.25)}
 };
 C.update=function(dt){if(!world)return;if(!active&&window.P2&&P2.state&&P2.state.qi>=5&&!midPlayed){midPlayed=true;C.playFlashback();return}if(!active)return;elapsed+=dt;const s=shots.find(x=>elapsed>=x.d&&elapsed<x.d+x.dur)||shots[shots.length-1];const t=clamp((elapsed-s.d)/s.dur,0,1);const smooth=t*t*(3-2*t);const p=s.from.clone().lerp(s.to.clone().add(vec(0,0.2,0)),smooth);world.cam.position.copy(p);world.cam.lookAt(s.to);if(ui){const ix=shots.indexOf(s);if(C._line!==ix){C._line=ix;say(s.name,s.text)}}if(elapsed>=24)finish();};
 C.playFlashback=function(){if(active||!world)return;const w=world;oldLock=!!(window.P2&&P2.locked);if(window.P2)P2.locked=true;oldYaw=w.yaw||0;oldPitch=w.pitch||0;oldPos=w.cam.position.clone();w.playerX=w.pos.x;w.playerZ=w.pos.z;const p=vec(w.pos.x,0,w.pos.z),look=p.clone().add(vec(0,1.3,0));shots=[{d:0,dur:3.2,from:p.clone().add(vec(-5,2.3,-4)),to:look,name:'YAADON KA TUKDA',text:'Ek bachche ki awaaz… “Darwaza mat kholo!”'}, {d:3.2,dur:3.4,from:p.clone().add(vec(4,1.8,-2)),to:look,name:'NARRATOR',text:'Barish, cheekhein aur gaon ki ghanti… tumhare dimaag mein ek purani raat laut aati hai.'},{d:6.6,dur:3.4,from:p.clone().add(vec(0,3,5)),to:look,name:'BACHPAN KI AWAAZ',text:'Mujhe chhod kar mat jaana…'}, {d:10,dur:3.4,from:oldPos.clone(),to:look,name:'NARRATOR',text:'Tumhari yaad abhi bhi adhoori hai. Graveyard mein iska jawab chhupa hai.'}];elapsed=0;active=true;makeUI();ui.querySelectorAll('#lvcsbar').forEach(x=>x.style.transform='scaleY(1)');if(window.P1SFX)P1SFX.play('stinger_slow',.35)};
 C.isPlaying=()=>active;
})();

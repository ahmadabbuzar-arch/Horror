/* THE LAST VILLAGE — event-driven horror sound system. User-gesture unlocked; graceful fallback if audio is unavailable. */
(function(){
 'use strict';
 const A=window.P1SFX={ready:true,unlocked:false,muted:false,volume:0.72};
 const base='assets/audio/horror/';
 const files={
  ambient_drone:'ambient_drone.wav',ambient_frogs:'ambient_frogs.wav',ambient_creepy:'ambient_creepy.wav',
  ambient_creak:'ambient_creak.wav',ambient_bell:'ambient_bell.wav',ambient_tapping:'ambient_tapping.wav',
  door:'door.wav',drawer:'drawer.wav',switch:'switch.wav',
  footsteps_walk:'footsteps_walk.wav',footsteps_run:'footsteps_run.wav',
  breathing_slow:'breathing_slow.wav',breathing_fast:'breathing_fast.wav',
  flash_on:'flash_on.wav',flash_off:'flash_off.wav',keys:'keys.wav',search:'search.wav',
  car_open:'car_open.wav',car_close:'car_close.wav',
  stinger_slow:'stinger_slow.wav',stinger:'stinger.wav',piano_drone:'piano_drone.wav',
  ghost_moan:'ghost_moan.wav',monster_growl:'monster_growl.wav',ghost_hiss:'ghost_hiss.wav',child_laugh:'child_laugh.wav'
 };
 const cache={},loops={};let stepT=0,randomT=16,lastRun=false;
 function audio(id){
  if(!files[id])return null;
  if(!cache[id]){const a=new Audio(base+files[id]);a.preload='none';cache[id]=a;}
  return cache[id];
 }
 function play(id,vol,rate){
  if(!A.unlocked||A.muted)return;
  const src=audio(id);if(!src)return;
  try{const a=src.cloneNode();a.volume=Math.max(0,Math.min(1,(vol==null?0.7:vol)*A.volume));a.playbackRate=rate||1;a.play().catch(()=>{});}catch(e){}
 }
 function loop(id,vol){
  if(!A.unlocked||A.muted||loops[id])return;
  const a=audio(id);if(!a)return;
  try{a.loop=true;a.volume=vol*A.volume;loops[id]=a;a.play().catch(()=>{delete loops[id]});}catch(e){}
 }
 A.unlock=function(){
  if(A.unlocked)return;A.unlocked=true;
  loop('ambient_drone',0.18);loop('ambient_frogs',0.10);
  // Very quiet background texture, not a loud constant rain bed.
 };
 A.play=play;
 A.setMuted=function(v){A.muted=!!v;Object.keys(loops).forEach(k=>{const a=loops[k];if(A.muted)a.pause();else a.play().catch(()=>{});});};
 A.setVolume=function(v){A.volume=Math.max(0,Math.min(1,Number(v)||0));Object.keys(loops).forEach(k=>loops[k].volume=(k==='ambient_drone'?0.18:0.10)*A.volume);};
 A.update=function(dt,distance,running,driving){
  if(!A.unlocked||A.muted)return;
  if(distance>0.002&&!driving){
   stepT-=dt;
   if(stepT<=0){play(running?'footsteps_run':'footsteps_walk',running?0.55:0.40,running?1.05:0.92);stepT=running?0.34:0.49;}
  }else stepT=Math.min(stepT,0.08);
  if(running&&!lastRun)play('breathing_fast',0.30);
  lastRun=!!running;
  randomT-=dt;
  if(randomT<=0){
   const r=Math.random();
   if(r<0.35)play('ambient_creak',0.16,0.85+Math.random()*0.3);
   else if(r<0.65)play('ambient_tapping',0.13,0.8+Math.random()*0.4);
   else if(r<0.82)play('ambient_creepy',0.20);
   randomT=20+Math.random()*24;
  }
 };
 A.stop=function(){Object.keys(loops).forEach(k=>{loops[k].pause();delete loops[k];});};
 window.addEventListener('pointerdown',()=>A.unlock(),{once:true});
 window.addEventListener('keydown',()=>A.unlock(),{once:true});
})();
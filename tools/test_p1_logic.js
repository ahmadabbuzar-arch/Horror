#!/usr/bin/env node
/* Logic tests for the parts of Phase 1 that do not need a renderer: asset manager (dedupe, sequencing, refcounted
 * disposal, release-while-loading, error + retry), shadow-safe disposal, regex helper, config validation, NPC placement maths.
 * Uses a FAKE THREE.GLTFLoader. This does NOT test rendering, skinning, materials or shaders.   usage: node tools/test_p1_logic.js */
const vm=require('vm'),fs=require('fs'),path=require('path');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('  PASS',m)}else{fail++;console.log('  FAIL',m)}};
const root=path.join(__dirname,'..');
class Dummy{constructor(){}}
let loads=[],inflight=0,maxInflight=0,failUrls=new Set(),delay=5;
class FakeLoader{load(url,ok_,prog,err){loads.push(url);inflight++;maxInflight=Math.max(maxInflight,inflight);
  setTimeout(()=>{inflight--;if(failUrls.has(url))return err&&err(new Error('404 '+url));
    const counters={geo:0,mat:0,tex:0};const mk=(shadow)=>({userData:shadow?{isShadow:true}:{},geometry:{dispose(){counters.geo++}},material:{map:{isTexture:true,dispose(){counters.tex++}},dispose(){counters.mat++}}});
    const kids=[mk(false),mk(false),mk(true)];ok_({scene:{traverse(f){kids.forEach(f)},_c:counters},animations:[]})},delay)}}
const THREE=new Proxy({},{get:(t,k)=>k==='GLTFLoader'?FakeLoader:Dummy});
const win={};win.window=win;
const ctx={window:win,THREE,console:{log(){},warn(){},error(){}},location:{search:''},document:{createElement:()=>({getContext:()=>({}),style:{}}),body:{appendChild(){}}},Math,Map,Set,Promise,setTimeout,Float32Array,Object,JSON,Array,RegExp,Error,Number,String};
vm.createContext(ctx);
for(const f of['p1-core','p1-config','p1-characters'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f});
const P1=win.P1;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
console.log('asset manager');
let a=P1.assets.acquire('u/a.glb'),b=P1.assets.acquire('u/a.glb');const [ga,gb]=await Promise.all([a,b]);
ok(loads.filter(u=>u==='u/a.glb').length===1,'two acquires of one URL -> ONE network/parse load');
ok(ga===gb,'both callers receive the same gltf object');
P1.assets.release('u/a.glb');ok(ga.scene._c.geo===0,'first release (refs 2->1) does not dispose');
P1.assets.release('u/a.glb');ok(ga.scene._c.geo===2&&ga.scene._c.mat===2&&ga.scene._c.tex===2,'last release disposes geometry+material+texture of every mesh');
ok(ga.scene._c.geo===2,'shared blob-shadow mesh (userData.isShadow) is NOT disposed');
ok(P1.assets.count()===0,'cache empty after full release');
await P1.assets.acquire('u/a.glb');ok(loads.filter(u=>u==='u/a.glb').length===2,'re-acquire after release loads again (no stale disposed object)');
P1.assets.release('u/a.glb');
// release while loading
const pr=P1.assets.acquire('u/b.glb');P1.assets.release('u/b.glb');const gg=await pr;await sleep(10);
ok(gg.scene._c.geo===2,'released while still loading -> disposed on arrival (no leak)');ok(P1.assets.count()===0,'cache empty');
// error + retry
failUrls.add('u/bad.glb');let rejected=false;try{await P1.assets.acquire('u/bad.glb')}catch(e){rejected=/bad\.glb/.test(e.message)}
ok(rejected,'failed download rejects with the URL in the message');ok(P1.assets.count()===0,'failed entry removed from cache');
failUrls.delete('u/bad.glb');await P1.assets.acquire('u/bad.glb');ok(P1.assets.count()===1,'retry after failure succeeds');P1.assets.release('u/bad.glb');
// sequential
maxInflight=0;await Promise.all(['u/1','u/2','u/3','u/4'].map(u=>P1.assets.acquire(u)));
ok(maxInflight===1,'4 different assets load strictly one at a time (max in flight = '+maxInflight+')');['u/1','u/2','u/3','u/4'].forEach(u=>P1.assets.release(u));
console.log('helpers');
ok(P1.rx('foo|bar').test('FOO')&&!P1.rx('foo').test('baz'),"rx('foo|bar') is case-insensitive");
ok(P1.rx('/Foo/').test('Foo')&&!P1.rx('/Foo/').test('foo'),"rx('/Foo/') keeps flags");ok(P1.rx(null)===null,'rx(null) -> null');
console.log('config validation');
ok(P1.validateConfig().length===0,'shipped config has 0 problems');
const C=P1.config;const keep=JSON.stringify(C.npcs.dev);C.npcs.dev.anchor='moon';ok(P1.validateConfig().some(m=>/dev.*moon/.test(m)),'unknown anchor is reported');C.npcs.dev=JSON.parse(keep);
C.appearance.dev.hide='(';ok(P1.validateConfig().some(m=>/dev\.hide/.test(m)),'invalid regex is reported');C.appearance.dev.hide='Tongue';
C.appearance.dev.height=9;ok(P1.validateConfig().some(m=>/height/.test(m)),'absurd height is reported');C.appearance.dev.height=1.72;
delete C.npcs.chotu;ok(P1.validateConfig().some(m=>/chotu.*npcs/.test(m)),'missing NPC entry is reported');C.npcs.chotu={anchor:'entry',x:6,z:1.5,face:{to:'hut'},snap:true};
ok(P1.validateConfig().length===0,'config valid again after restoring');
console.log('NPC placement maths (stub world, no loading)');
P1.cfg.loadRadius=0;           // never start a load in this test
let blocked=()=>false;
const world={scene:{add(){},remove(){}},cc:{x:100,z:200},spawn:{x:100,z:214},doors:[{x:110,z:230},{x:110,z:240}],villageBox:()=>({min:{x:105,z:224},max:{x:125,z:264}}),clear:(x,z)=>!blocked(x,z),ground:()=>0,notify(){}};
C.npcs.raghunath={anchor:'world',x:50,z:60,face:{yaw:90},snap:false};
C.npcs.kamla={anchor:'entry',x:1,z:2,face:{to:'hut'},snap:true};
C.npcs.arvind={anchor:'door',door:1,x:2,z:0,face:{point:[0,0]},snap:true};
C.npcs.shyamlal={anchor:'village',x:0,z:0,face:{to:'spawn'},snap:true};
C.npcs.chotu={anchor:'hut',x:3,z:-4,face:{yaw:180},snap:false};
C.npcs.dev={anchor:'door',door:9,x:0,z:0,face:{to:'entry'},snap:true};   // door 9 does not exist -> fallback
C.npcs.saaya={anchor:'entry',x:0,z:0,face:{to:'hut'},snap:true};
blocked=(x,z)=>Math.hypot(x-(112.2+1),z-(232))<0.9;                       // block kamla's exact spot
P1.startCharacters(world);for(let i=0;i<9;i++)P1.updateCharacters(0.4,{x:100,z:214});
const S=id=>P1.characters.get(id);
ok(S('raghunath').px===50&&S('raghunath').pz===60,"anchor 'world' + snap:false -> EXACT coordinates (50,60)");
ok(Math.abs(S('raghunath').yaw-Math.PI/2)<1e-9,'face {yaw:90} -> pi/2 rad (+X)');
ok(Math.abs(S('chotu').px-103)<1e-9&&Math.abs(S('chotu').pz-196)<1e-9,"anchor 'hut' offset (3,-4) -> (103,196)");
ok(Math.abs(S('chotu').yaw-Math.PI)<1e-9,'face {yaw:180} -> pi rad');
ok(Math.hypot(S('kamla').px-113.2,S('kamla').pz-232)>=0.9&&S('kamla').spawnInfo.snapped,'blocked exact spot -> snapped to a free nearby spot ('+S('kamla').spawnInfo.x+','+S('kamla').spawnInfo.z+')');
ok(Math.abs(S('arvind').px-112)<1e-6&&Math.abs(S('arvind').pz-240)<1e-6,"anchor 'door' index 1 + offset (2,0) -> (112,240)");
ok(Math.abs(S('arvind').yaw-Math.atan2(0-112,0-240))<1e-9,'face {point:[0,0]} aims at that world point');
ok(Math.abs(S('shyamlal').px-115)<1.2&&Math.abs(S('shyamlal').pz-244)<1.2,"anchor 'village' = centre of the village box (115,244)");
ok(S('dev').spawnInfo.anchor==='door->fallback','missing door index -> logged hut-relative fallback, no crash');
ok(P1.characters.list().every(s=>s.placed),'all 7 slots placed');
const near=P1.characters.list().filter(s=>s.spawnInfo.snapped||true).every((s,i,arr)=>arr.every((o,j)=>i===j||Math.hypot(s.px-o.px,s.pz-o.pz)>0.5));
ok(near,'no two NPCs share the same spot');
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})();

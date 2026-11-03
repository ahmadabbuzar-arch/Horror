/* Part 2 story logic regression test. Run: node tools/test_p2_logic.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
function el() { const e = { style: {}, children: [], className: '', textContent: '', _l: {}, appendChild(c) { this.children.push(c); c.parentNode = this; return c; }, insertBefore(c) { this.children.push(c); return c; }, contains() { return false; }, addEventListener(t, f) { this._l[t] = f; }, setAttribute() {}, getContext() { return { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeText() {}, fillText() {} }; } }; Object.defineProperty(e, 'innerHTML', { set() { this.children = []; this.textContent = ''; }, get() { return ''; } }); return e; }
const ids = {}; const doc = { head: el(), body: el(), createElement: () => el(), createTextNode: t => ({ t }), getElementById: id => ids[id] || null, addEventListener() {}, pointerLockElement: null }; doc.body.appendChild = function(c) { if(c.id) ids[c.id]=c; return c; }; ids.hud=el();
const V=function(){this.x=this.y=this.z=0;}; V.prototype.set=function(x,y,z){this.x=x;this.y=y;this.z=z;return this;};
const mesh=function(){return {position:{set(){},y:0},rotation:{},scale:{set(){}},add(){},geometry:{dispose(){}},material:{dispose(){}},visible:true,traverse(f){f(this);}};};
const grp=function(){return Object.assign(mesh(),{position:{set(x,y,z){this.x=x;this.y=y;this.z=z;}}});};
const THREE={Vector3:V,Group:grp,Mesh:mesh,Sprite:mesh,SpriteMaterial:function(){return {dispose(){}};},CanvasTexture:function(){},AdditiveBlending:1,BoxGeometry:function(){return {dispose(){}};},CylinderGeometry:function(){return {};},ConeGeometry:function(){return {};},TorusGeometry:function(){return {};},SphereGeometry:function(){return {};},MeshStandardMaterial:function(){return {dispose(){}};},MeshBasicMaterial:function(){return {dispose(){}};}};
const storage={}; const sandbox={window:null,document:doc,THREE,navigator:{},location:{search:''},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]},setTimeout:()=>0,addEventListener(){},console}; sandbox.window=sandbox; sandbox.self=sandbox;
const slots={}; ['raghunath','kamla','arvind','shyamlal','chotu','dev'].forEach((id,i)=>slots[id]={cfg:{id,label:id,height:1.7},status:'ready',holder:grp(),px:i*10,pz:0,py:0,yaw:0}); sandbox.P1={gy:0,log(){},characters:{get:id=>slots[id]},clinic:{world:{x:-12,z:22}}};
vm.createContext(sandbox); ['p2-config.js','p2-story.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',f),'utf8'),sandbox,{filename:f}));
const P2=sandbox.P2,C=P2.config,S=P2.state,TT=P2._test; const world={scene:{add(){},remove(){}},cam:{getWorldDirection(v){v.set(0,0,-1);}},clear:()=>true,ground:()=>0}; P2.start(world);
function finish(){let n=0;while(TT.dlg()&&n++<100)TT.advance();ok(!TT.dlg(),'dialogue closes');}
function talk(id){const r=TT.npcLines(id);TT.openDialogue(r.lines,r.nm,r.advance?()=>TT.completeStage():null,slots[id]);finish();}
function inspect(ids){ids.forEach(id=>{TT.syncItems();ok(!!TT.items[id],'clue spawned '+id);TT.pickItem(id);finish();});}
ok(C.quests.length===5,'five first-half missions');
ok(C.quests.every(q=>q.stages.some(s=>s.type==='inspect')),'each mission has investigation');
ok(C.quests[0].stages.some(s=>s.type==='reach'&&s.where==='garage'),'workshop exploration stage');
// Mission 1
talk('raghunath'); inspect(['toolbox','tracks','torn_note']); ok(S.st===2,'workshop clues lead to exploration'); P2.update(.3,{x:18.4,z:31.2}); ok(S.st===3,'garage reached'); talk('raghunath'); ok(S.qi===1,'Kamla unlocked');
// Mission 2
talk('kamla'); inspect(['letter1','letter2','letter3']); talk('kamla'); ok(S.qi===2,'Arvind unlocked');
// Mission 3
talk('arvind'); inspect(['register','clinic_key','family_photo']); talk('arvind'); ok(S.qi===3,'Shyamlal unlocked');
// Mission 4
talk('shyamlal'); inspect(['lantern','bell_clue']); ok(C.quests[3].stages[S.st].type==='reach','tower stage'); sandbox.P1.gy=8.8; P2.update(.3,{x:13,z:67}); ok(S.st===3,'tower reached'); sandbox.P1.gy=0; talk('shyamlal'); ok(S.qi===4,'Chotu unlocked');
// Mission 5
talk('chotu'); inspect(['drawing','school_bag','child_drawing']); talk('chotu'); finish(); ok(S.qi===5,'first half completed');
ok(TT.objectiveText()==='','no active objective after first half');
ok(storage.lv_p2_story_v2 && JSON.parse(storage.lv_p2_story_v2).qi===5,'story progress saved');
const src=fs.readFileSync(path.join(__dirname,'..','js','p2-story.js'),'utf8')+fs.readFileSync(path.join(__dirname,'..','js','p2-config.js'),'utf8');
ok(!/speechSynthesis|new Audio|AudioContext/.test(src),'no voice/audio');
console.log(pass+' passed, '+fail+' failed'); process.exit(fail?1:0);

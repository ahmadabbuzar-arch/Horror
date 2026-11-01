// Offline test of js/p1-props.js collision maths + forest placement rules (THREE is stubbed; no rendering).
const vm=require('vm'),fs=require('fs');let pass=0,fail=0;
function ok(c,m){if(c){pass++;console.log('  PASS '+m)}else{fail++;console.log('  FAIL '+m)}}
class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}set(x,y,z){this.x=x;this.y=y;this.z=z;return this}}
const T={Raycaster:class{set(){}intersectObjects(){return []}},Vector3:V3,Box3:class{containsPoint(){return true}},Group:class{},Matrix4:class{},Mesh:class{}};
const w={THREE:T,console,location:{search:''},document:{}};w.window=w;w.P1={cfg:{car:{}},log(){},warn(){},info:{},status:{},assets:{}};
vm.createContext(w);vm.runInContext(fs.readFileSync('js/p1-config.js','utf8'),w);vm.runInContext(fs.readFileSync('js/p1-props.js','utf8'),w);
const P1=w.P1,C=P1.config.village;
ok(C.props.length===6&&C.wrecks.length===2,'6 props (tower, windmill, gy_cluny, gy_gate, gy_wall, gy_hand) + 2 wrecks configured');
ok(!C.props.some(c=>/bunker/.test(c.id)),'r9: clinic bunker is gone');
ok(!C.props.some(c=>/house|ruin|boat/.test(c.id)),'r8: American house, ruined log house and boat are gone');
const tw=C.props.find(c=>c.id==='tower');ok(tw&&tw.climb&&tw.wallR<=0.35,'r8: tower is climbable (climb:true, narrow wall radius)');
for(const c of C.props.concat(C.wrecks))ok(fs.existsSync(c.url.split('?')[0]),'asset exists: '+c.url);
// ids unique, positions distinct and not inside each other's footprint
const all=C.props.concat(C.wrecks);ok(new Set(all.map(c=>c.id)).size===all.length,'unique ids');
let clash=0;for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=all[i],b=all[j];if(a.encloses||b.encloses)continue;if(Math.hypot(a.x-b.x,a.z-b.z)<(a.footprint||3)+(b.footprint||3)-2){clash++;console.log('   overlap',a.id,b.id)}}
ok(clash===0,'no two props overlap');
// collision: inject fake ready entries
P1.startProps({scene:{add(){},remove(){}},cc:{x:0,z:0},trees:[],root:()=>null});
const L=P1.props.list();
const wind=L.find(e=>e.id==='windmill');wind.status='ready';wind.holder={};
const p={x:21.5,z:28,y:0};P1.collideProps(p);
ok(Math.hypot(p.x-21,p.z-28)>=1.9+0.35-1e-6,'windmill circle pushes the player out');
const far={x:30,z:28,y:0};P1.collideProps(far);ok(far.x===30&&far.z===28,'no push outside the collider');
// r8: tower floor sampling
const tower=L.find(e=>e.id==='tower');tower.status='ready';tower.holder={};tower.floors=['stairMesh'];tower.box={min:{x:0,z:66},max:{x:9,z:78}};
ok(P1.propFloors({x:4.5,z:72}).length===1,'r8: tower stairs are offered as floor when the player is inside its box');
ok(P1.propFloors({x:30,z:10}).length===0,'r8: no floor meshes far from the tower');
// forest: no source trees -> must not throw
let threw=false;try{P1.startProps({scene:{add(){}},cc:{x:0,z:0},trees:[],root:()=>({updateMatrixWorld(){},traverse(){}})})}catch(e){threw=true}
ok(!threw,'forest with no trees does not throw');
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

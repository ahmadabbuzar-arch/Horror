// Offline test of js/p1-drive.js physics (THREE/DOM stubbed).
const vm=require('vm'),fs=require('fs');let pass=0,fail=0;
function ok(c,m){if(c){pass++;console.log('  PASS '+m)}else{fail++;console.log('  FAIL '+m)}}
const w={THREE:{},console,performance:{now:()=>0},addEventListener(){},document:{createElement:()=>({style:{},}),body:{appendChild(){}}}};w.window=w;
w.P1={cfg:{car:{hoodDeg:12}},car:{ready:true,holder:{position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}},rotation:{y:0}},circles:[],setHood(){}},collideProps:null};
vm.createContext(w);vm.runInContext(fs.readFileSync('js/p1-drive.js','utf8'),w);
const D=w.P1.drive,H=w.P1.car.holder,pos={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}};
D.active=true;D.h=0;
let yaw=Math.PI;for(let i=0;i<180;i++){yaw=D.step(1/60,1,0,pos,[],yaw,null).yaw}
ok(D.v>10&&D.v<=13.0001,'accelerates to ~max speed ('+D.v.toFixed(1)+' m/s)');
ok(H.position.z>15&&Math.abs(H.position.x)<1e-6,'drives straight along +Z ('+H.position.z.toFixed(1)+' m)');
ok(Math.abs(yaw-Math.PI)<1e-6,'camera looks along the car heading');
const h0=D.h;for(let i=0;i<60;i++)yaw=D.step(1/60,1,1,pos,[],yaw,null).yaw;
ok(D.h<h0-0.2,'steering right turns the car clockwise (heading '+h0.toFixed(2)+' -> '+D.h.toFixed(2)+')');
for(let i=0;i<300;i++)yaw=D.step(1/60,-1,0,pos,[],yaw,null).yaw;
ok(D.v<0&&D.v>=-4.0001,'brakes then reverses, limited to '+D.v.toFixed(1)+' m/s');
D.v=10;D.h=0;H.position.set(0,0,0);let n=0;yaw=D.step(1/60,0,0,pos,[],yaw,(x,z,dx,dz,len)=>{n++;return true}).yaw;
ok(D.v<0&&H.position.z===0,'building ahead stops the car and bounces it back');
H.position.set(0,0,0);D.v=8;D.h=0;const tr=[{x:0,z:1.5,r:0.5}];for(let i=0;i<30;i++)yaw=D.step(1/60,1,0,pos,tr,yaw,null).yaw;
ok(Math.hypot(H.position.x-0,H.position.z-1.5)>=1.5-1e-6,'tree circle pushes the car out');
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

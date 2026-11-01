// Offline test of js/p1-drive.js physics (THREE/DOM stubbed).
const vm=require('vm'),fs=require('fs');let pass=0,fail=0;
function ok(c,m){if(c){pass++;console.log('  PASS '+m)}else{fail++;console.log('  FAIL '+m)}}
const w={THREE:{},console,performance:{now:()=>0},addEventListener(){},document:{createElement:()=>({style:{},}),body:{appendChild(){}}},setTimeout};w.window=w;
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
// r8: driver seat is on the +X side (steering wheel at x=+0.37), the door opens before sitting, exit is on the driver side
ok(w.P1.drive&&w.P1.cfg.drive.seat[0]>0.3&&w.P1.cfg.drive.seat[0]<0.5,'r8: driver seat is on +X (steering-wheel side), x='+w.P1.cfg.drive.seat[0]);
{ const dd={state:{cur:0,t:0,x:0.83,z:0.5}};
  w.P1.car.driverDoor=dd;w.P1.car.syncDoors=()=>{};
  w.P1.world={pos:{x:1.2,y:0,z:0.5,set(x,y,z){this.x=x;this.y=y;this.z=z}},notify(m){}};
  D.active=false;D.pending=false;H.position.set(0,0,0);H.rotation.y=0;
  // 'ontouchstart' / DOM stubs: call the public toggle through the key handler is not possible here, so use the exported test hook
  ok(typeof D.toggle==='function','r8: toggle exported for tests');
  D.toggle();
  ok(dd.state.t===1&&D.pending&&!D.active,'r8: closed driver door -> door starts opening, player not seated yet');
  dd.state.cur=1;
  setTimeout(()=>{
    ok(D.active&&dd.state.t===0,'r8: after the door swing the player sits and the door closes');
    D.toggle();
    ok(!D.active&&dd.state.t===1,'r8: getting out opens the door');
    const px=w.P1.world.pos.x;ok(px>0.9,'r8: player is put outside on the +X (driver) side, x='+px.toFixed(2));
    console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
  },w.P1.cfg.drive.doorMs+80);
}


"""Offline check that the player can walk up the watchtower stairs with the game's ground-ray + wall-ray logic (numpy only, no Three.js).
usage: python3 tools/sim_tower_climb.py 4.5 rel 0.3     (x of tower, rel|abs wall-ray heights, wall radius) -> prints max height reached.
0.5 m radius gets stuck at ~1.1 m (stair lanes are 0.95 m wide); 0.3 m reaches the top deck (~9 m)."""
import sys, math, heapq
import os
HERE=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,os.path.join(HERE,'preview'))
import glbinfo as g, numpy as np
js,bn=g.load(os.path.join(HERE,'..','assets','props','watchtower.glb'))
res={}
def fn(ni,n,W,p):
    if 'mesh' in n:
        pr=js['meshes'][n['mesh']]['primitives'][0]
        a=g.accessor(js,bn,pr['attributes']['POSITION']).astype(float)
        idx=g.accessor(js,bn,pr['indices']).astype(int).reshape(-1)
        res['v']=(np.c_[a,np.ones(len(a))]@W.T)[:,:3]; res['t']=idx.reshape(-1,3)
g.walk(js,bn,fn)
v=res['v'];t=res['t']
# placement (config): x=4.5 z=72 yaw=20 scale .85 sink 0, model recentred in x/z, base = min y
import json
cfg=dict(x=float(sys.argv[1]) if len(sys.argv)>1 else 4.5, z=72.0, yaw=20.0, scale=0.85)
c=(v.min(0)+v.max(0))/2
loc=v.copy(); loc[:,0]-=c[0]; loc[:,2]-=c[2]; loc[:,1]-=v[:,1].min()
loc*=cfg['scale']
th=math.radians(cfg['yaw']); cs,sn=math.cos(th),math.sin(th)
w=np.empty_like(loc)
w[:,0]=loc[:,0]*cs+loc[:,2]*sn+cfg['x']; w[:,2]=-loc[:,0]*sn+loc[:,2]*cs+cfg['z']; w[:,1]=loc[:,1]
P0,P1_,P2=w[t[:,0]],w[t[:,1]],w[t[:,2]]
E1=P1_-P0;E2=P2-P0
TMIN=np.minimum(np.minimum(P0,P1_),P2);TMAX=np.maximum(np.maximum(P0,P1_),P2)
def cast(o,d,far):
    o=np.asarray(o,float);d=np.asarray(d,float)
    e=o+d*far
    lo=np.minimum(o,e)-1e-3;hi=np.maximum(o,e)+1e-3
    sel=np.nonzero(((TMAX>=lo)&(TMIN<=hi)).all(1))[0]
    if len(sel)==0: return None
    p0=P0[sel];e1=E1[sel];e2=E2[sel]
    h=np.cross(d,e2);a=(e1*h).sum(1)
    ok=np.abs(a)>1e-9
    f=np.where(ok,1/np.where(ok,a,1),0)
    s=o-p0;u=f*(s*h).sum(1)
    q=np.cross(s,e1);vv=f*(q*d).sum(1)
    tt=f*(e2*q).sum(1)
    m=ok&(u>=0)&(vv>=0)&(u+vv<=1)&(tt>1e-6)&(tt<=far)
    return tt[m].min() if m.any() else None
DIRS=[(math.sin(i*math.pi/4),0,math.cos(i*math.pi/4)) for i in range(8)]
def push(x,z,gy,R=0.5):
    for y in (0.55,1.3):
        for d in DIRS:
            h=cast((x,gy+y,z),d,R)
            if h is not None:
                p=R-h; x-=d[0]*p; z-=d[2]*p
    return x,z
def ground(x,z,gy):
    h=cast((x,gy+0.8,z),(0,-1,0),2.5)
    if h is None: return 0.0
    y=gy+0.8-h
    return max(0.0,y) if y>-0.2 else 0.0
if __name__=='__main__':
    print('world bbox',w.min(0).round(2),w.max(0).round(2))
    RELATIVE = (len(sys.argv)<=2 or sys.argv[2]!='abs')
    WR=float(sys.argv[3]) if len(sys.argv)>3 else 0.5
    STEP=0.3
    def key(x,z,gy): return (round(x/STEP),round(z/STEP),round(gy/0.2))
    start=(4.5+ -0.0, 72-6.0)
    best=0
    seen={};
    import heapq
    q=[]
    def prio(x,z,gy): return (-gy, math.hypot(x-cfg['x'],z-cfg['z']))
    for ang in range(0,360,30):
        sx=cfg['x']+5.5*math.cos(math.radians(ang)); sz=cfg['z']+5.5*math.sin(math.radians(ang))
        k=key(sx,sz,0.0)
        if k not in seen: seen[k]=(sx,sz,0.0,None); heapq.heappush(q,(prio(sx,sz,0.0),(sx,sz,0.0)))
    steps=0; bestpos=None
    while q and steps<12000:
        _,(x,z,gy)=heapq.heappop(q);steps+=1
        if steps%500==0: print('progress',steps,len(q),round(best,2),flush=True)
        for dx,dz in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]:
            n=math.hypot(dx,dz);nx=x+dx*STEP/n;nz=z+dz*STEP/n
            if math.hypot(nx-cfg['x'],nz-cfg['z'])>8.5: continue
            px,pz=push(nx,nz,gy if RELATIVE else 0.0,WR)
            if math.hypot(px-nx,pz-nz)>0.1: continue
            tg=ground(px,pz,gy)
            if tg>gy and tg-gy>1.0: continue
            k=key(px,pz,tg)
            if k in seen: continue
            seen[k]=(px,pz,tg,(x,z,gy)); heapq.heappush(q,(prio(px,pz,tg),(px,pz,tg)))
            if tg>best: best=tg;bestpos=(round(px,2),round(pz,2))
    print('best at',bestpos)
    print('reachable states',len(seen),'max height reached',round(best,2),'m (platform at ~8.4 m)')

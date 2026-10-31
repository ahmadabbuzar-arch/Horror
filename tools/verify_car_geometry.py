#!/usr/bin/env python3
"""Offline numeric check of the car wheel fix (the same maths as js/p1-car.js) on the REAL vertices of assets/vehicles/sedan.glb.
Prints: true axle direction/centre/radius of every wheel before and after the fix, the restored front wheel position,
and the ground height. Does not need Three.js.  usage: verify_car_geometry.py [sedan.glb]"""
import json,struct,sys,numpy as np
path=sys.argv[1] if len(sys.argv)>1 else 'assets/vehicles/sedan.glb'
d=open(path,'rb').read();_,_,L=struct.unpack('<III',d[:12]);o=12
while o<L:
    cl,ct=struct.unpack('<II',d[o:o+8]);c=d[o+8:o+8+cl]
    if ct==0x4E4F534A:j=json.loads(c)
    elif ct==0x004E4942:b=c
    o+=8+cl
N=j['nodes'];acc=j['accessors']
def pos(a):
    ac=acc[a];bv=j['bufferViews'][ac['bufferView']];st=bv.get('byteStride',12)
    arr=np.frombuffer(b,dtype=np.uint8,count=bv['byteLength'],offset=bv.get('byteOffset',0)).tobytes()
    return np.ndarray((ac['count'],3),dtype='<f4',buffer=arr,offset=ac.get('byteOffset',0),strides=(st,4)).astype(float)
def local(n):return np.array(n['matrix']).reshape(4,4).T if 'matrix' in n else np.eye(4)
nodes={}
def walk(i,P,par=''):
    M=P@local(N[i]);n=N[i]
    if 'mesh' in n: nodes[par]=(M,pos(j['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']))
    for c in n.get('children',[]):walk(c,M,n['name'] if 'mesh' not in n else par)
for r in j['scenes'][0]['nodes']:walk(r,np.eye(4))
Mb,_=nodes[[k for k in nodes if k.startswith('KUZA')][0]]
bodyX=Mb[:3,:3]@np.array([1.,0,0]);bodyX/=np.linalg.norm(bodyX)
def rodrigues(a,b):
    a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);v=np.cross(a,b);c=a@b
    if np.linalg.norm(v)<1e-9:return np.eye(3)
    K=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]);return np.eye(3)+K+K@K*(1/(1+c))
def axle(M):  # local X axis in car space
    a=M[:3,:3]@np.array([1.,0,0]);return a/np.linalg.norm(a)
wheels={k:v for k,v in nodes.items() if k.startswith('TEKER')}
print('body axle axis (KUZA local X):',bodyX.round(3))
T={}
for k,(M,V) in wheels.items():
    T[k]=(M.copy(),V,len(V))
tyres={k:v for k,v in T.items() if v[2]>=100};rotor={k:v for k,v in T.items() if v[2]<100}
def info(M,V):
    W=(M[:3,:3]@V.T).T+M[:3,3];lo,hi=V.min(0),V.max(0);R=max(hi[1]-lo[1],hi[2]-lo[2])/2*np.linalg.norm(M[:3,1])
    return M[:3,3].copy(),axle(M),R
print('\nBEFORE'); 
for k,(M,V,n) in T.items():
    c,a,R=info(M,V);sg=1 if a@bodyX>=0 else -1
    print(f' {k:14s} verts {n:3d} centre {c.round(2)} axle off body-axle {np.degrees(np.arccos(np.clip(abs(a@bodyX),0,1))):5.1f}° radius {R:.2f}')
fixed={}
for k,(M,V,n) in tyres.items():
    a=axle(M);tgt=bodyX*(1 if a@bodyX>=0 else -1);Rm=rodrigues(a,tgt);M2=M.copy();M2[:3,:3]=Rm@M[:3,:3];fixed[k]=(M2,V,n)
print('\nAFTER straighten')
for k,(M,V,n) in fixed.items():
    c,a,R=info(M,V);print(f' {k:14s} centre {c.round(2)} axle off body-axle {np.degrees(np.arccos(np.clip(abs(a@bodyX),0,1))):5.2f}°')
# missing corner: classify by centre
def key(c):return ('F' if c[2]>0 else 'R')+('-X' if c[0]<0 else '+X')
corner={key(info(M,V)[0]):k for k,(M,V,n) in fixed.items()}
print('\ncorners present:',sorted(corner),'-> missing:',sorted({'F-X','F+X','R-X','R+X'}-set(corner)))
if 'F-X' not in corner:
    dk=corner['R-X'];fk=corner.get('F+X');dc=info(*fixed[dk][:2])[0];fc=info(*fixed[fk][:2])[0]
    new=np.array([dc[0],dc[1],fc[2]]);print(' restored F-X wheel (clone of',dk,') centre',new.round(2),'| rotor was at',info(*rotor[list(rotor)[0]][:2])[0].round(2))
bottoms=sorted([info(M,V)[0][1]-info(M,V)[2] for k,(M,V,n) in fixed.items()])
print('\ntyre bottoms (model units):',np.round(bottoms,3),'-> ground (median) =',round(bottoms[len(bottoms)//2],3),' x scale 0.2134 =',round(bottoms[len(bottoms)//2]*0.2134,3),'m')
spread=max(bottoms)-min(bottoms);print('bottom spread',round(spread,3),'units =',round(spread*0.2134*100,1),'cm (all three real tyres sit on the same ground within this)')

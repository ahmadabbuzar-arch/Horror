import sys,math,json;sys.path.insert(0,'/home/claude')
from render import R as Rend
from glbinfo import *
import numpy as np
OUT='/home/claude/proj/screenshots/'
js,bn=load('/home/claude/proj/assets/vehicles/sedan.glb')
W={};byname={}
def fn(ni,n,M,p): W[ni]=M;byname[n.get('name')]=ni
walk(js,bn,fn)
def q2R(q):
    x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def rotAbout(axis,a,p):
    c,s=math.cos(a),math.sin(a)
    R=np.eye(4)
    if axis=='x': R[1,1]=c;R[1,2]=-s;R[2,1]=s;R[2,2]=c
    else: R[0,0]=c;R[0,2]=s;R[2,0]=-s;R[2,2]=c
    T=np.eye(4);T[:3,3]=p;U=np.eye(4);U[:3,3]=-np.array(p)
    return T@R@U
cm=lambda M:M.T.flatten().tolist()
SC=4.6/21.56;SS=np.diag([SC,SC,SC,1]);SS[1,3]=-0.049*SC
cmw=lambda M:cm(SS@M@np.linalg.inv(SS))   # post transforms are applied AFTER the pre matrix: express them in world space
def origin(name): return W[byname[name]][:3,3]
def rotof(name):
    M=W[byname[name]][:3,:3];return M/np.linalg.norm(M,axis=0)
post=[]
# hood: bake closed (-phi) then pop 12 deg
R=rotof('KAPOT_1');vy=R@[0,1,0];phi=math.atan2(vy[2],vy[1]);print('hood authored open phi deg',round(math.degrees(phi),1))
post.append({'nodes':'^KAPOT_1$','op':'mat','m':cmw(rotAbout('x',-phi-math.radians(12),origin('KAPOT_1')))})
R=rotof('BAQAJ_4');vy=R@[0,1,0];phi=math.atan2(vy[2],vy[1]);print('trunk authored phi deg',round(math.degrees(phi),1))
post.append({'nodes':'^BAQAJ_4$','op':'mat','m':cmw(rotAbout('x',-phi,origin('BAQAJ_4')))})
for nm in ('ON QAPI_2','ARXA QAPI_3','ON QAPI.001_12','ARXA QAPI.001_13'):
    R=rotof(nm);z=R@[0,0,1];au=math.atan2(z[0],z[2]);side=-1 if nm in('ON QAPI_2','ARXA QAPI_3') else 1
    th=(1 if side<0 else -1)*math.radians(55)*(0.3 if nm=='ON QAPI_2' else 0)
    print(nm,'authored door yaw deg',round(math.degrees(au),1))
    # closed bake: rotY(-authored) about origin; then ajar rotation about origin
    A=rotAbout('y',-au,origin(nm));B=rotAbout('y',th,origin(nm))
    post.append({'nodes':'^'+nm.replace('.','\\.')+'$','op':'mat','m':cmw(B@A)})
# wheels: straighten F+X: find axle of TEKER.004 via PCA smallest axis
def axle(name):
    gi=byname[name];ci=js['nodes'][gi]['children'][0];n=js['nodes'][ci];P=accessor(js,bn,js['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']).astype(float);Pw=(W[ci]@np.c_[P,np.ones(len(P))].T).T[:,:3]
    c=Pw.mean(0);u,s,vt=np.linalg.svd(Pw-c);return vt[2],c
ax,c=axle('TEKER.004_10');ax=ax*np.sign(ax[0]);ang=math.atan2(ax[2],ax[0]);print('F+X wheel axle yaw deg',round(math.degrees(ang),1))
post.append({'nodes':'^TEKER\\.004_10$','op':'mat','m':cmw(rotAbout('y',ang,c))})
ax3,c3=axle('TEKER.003_11')
s=4.6/21.56
# restored front-left tyre = clone of rear-left moved forward to the F+X wheel's z
dz=c[2]-c3[2]
S=np.diag([s,s,s,1]);ground=0.049;S[1,3]=-ground*s
car_post=post
def car(extra=[]):
    base={'url':'/assets/vehicles/sedan.glb','preM':cm(S),'hide':'TEKER\\.002|ZZZ','post':post}
    clone={'url':'/assets/vehicles/sedan.glb','preM':cm(S@np.array([[1,0,0,0],[0,1,0,0],[0,0,1,dz],[0,0,0,1]])),'hide':'^((?!TEKER\\.003).)*$'}
    return [base,clone]
terr={'url':'/assets/models/hut.glb','hide':'Arbol|Cabin','flatPath':{'Plane_4':[.03,.045,.03]}}
light={'sky':[.5,.52,.6],'gnd':[.15,.14,.12],'keyC':[.8,.78,.7],'fillC':[.2,.2,.25],'keyD':[-.5,.7,.5]}
with Rend() as r:
    for tag,eye in (('front_left',[-6.5,1.6,7.5]),('front_right',[6.5,1.6,7.5]),('rear_left',[-6.5,1.8,-7.5]),('side_left',[-9,0.8,0.5])):
        r.render({'w':1000,'h':620,'models':[terr]+car(),'cam':{'eye':eye,'target':[0,0.9,0],'fov':40},'bg':[.05,.06,.1],'fog':.01,'light':light},OUT+f'car_{tag}.png')
print('done')

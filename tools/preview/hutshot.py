import sys,json;sys.path.insert(0,'/home/claude')
from render import R
import numpy as np
def mat(pivot,scale,dy=0):
    T=np.eye(4);T[:3,3]=pivot;S=np.eye(4);S[0,0]=S[1,1]=S[2,2]=scale;T2=np.eye(4);T2[:3,3]=-np.array(pivot)
    M=T@S@T2;M[1,3]+=dy;return M.T.flatten().tolist()
cx,cz=-4.8785,-16.87
before=mat([cx,-0.1428,cz],3.6)
after=mat([cx,-0.0103,cz],3.6,(0-0.03)-(-0.0103))
light={'sky':[.5,.55,.7],'gnd':[.2,.18,.16],'keyC':[.9,.85,.8],'fillC':[.2,.2,.25],'keyD':[-.3,.8,.5]}
def spec(m,eye,tgt,w=1000,h=620):
    return {'w':w,'h':h,'bg':[.05,.06,.1],'fog':0.004,'light':light,'cam':{'eye':eye,'target':tgt,'fov':50,'near':.05},
      'models':[{'url':'/assets/models/hut.glb','hide':'Arbol','flatPath':{'Plane_4':[.05,.12,.04],'Cabin8_5':[.55,.45,.35]},'post':[{'nodes':'^Cabin8_5$','op':'mat','m':m}]}]}
with R() as r:
    # low side-on view along the front wall: the gap (before) vs contact (after)
    for tag,m in (('before',before),('after',after)):
        r.render(spec(m,[cx+22.0,0.15,cz+0.0],[cx+8.0,0.4,cz+0.0]),f'/home/claude/shots_hut_{tag}_A.png')
        r.render(spec(m,[cx+4.0,0.12,cz+16.0],[cx+3.0,0.3,cz+6.0]),f'/home/claude/shots_hut_{tag}_B.png')

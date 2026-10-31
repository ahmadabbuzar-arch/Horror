import sys,math;sys.path.insert(0,'/home/claude')
from render import R
import numpy as np
OUT='/home/claude/proj/screenshots/'
FW={'saaya':(-0.99,-0.12),'raghunath':(0.04,1.0),'kamla':(0.08,1.0),'shyamlal':(0.12,0.99)}
H={'raghunath':1.64,'kamla':1.50,'arvind':1.76,'shyamlal':1.75,'chotu':1.20,'dev':1.72,'saaya':1.95}
F={'raghunath':'raghunath','kamla':'kamla_devi','arvind':'dr_arvind','shyamlal':'shyamlal','chotu':'chotu','dev':'dev','saaya':'saaya'}
def pre(r,k,x,stretch=(1,1,1),z=0):
    url='/assets/characters/'+F[k]+'.glb'
    yaw=0
    if k in FW: yaw=-math.atan2(FW[k][0],FW[k][1])
    c,s=math.cos(yaw),math.sin(yaw)
    Ry=np.array([[c,0,s,0],[0,1,0,0],[-s,0,c,0],[0,0,0,1]])
    # bounds after rotation: measure with rotation applied
    b=r.bounds(url,Ry.T.flatten().tolist())
    h=(b['hi'][1]-b['lo'][1])
    sc=H[k]/h
    St=np.diag([sc*stretch[0],sc*stretch[1],sc*stretch[2],1])
    cx=(b['lo'][0]+b['hi'][0])/2*sc*stretch[0];cz=(b['lo'][2]+b['hi'][2])/2*sc*stretch[2]
    T=np.eye(4);T[0,3]=x-cx;T[1,3]=-b['lo'][1]*sc*stretch[1];T[2,3]=z-cz
    return url,(T@St@Ry).T.flatten().tolist(),sc*stretch[1]*h
HIDE='cigarette|pistol|slide|trigger|clip|bullet|Hats|Teeth|Tongue|Tearline|Occlusion|Cornea|Nails'
night={'sky':[.10,.12,.20],'gnd':[.03,.03,.04],'keyC':[.10,.12,.2],'fillC':[.03,.03,.05],'keyD':[-.4,.8,.45]}
with R() as r:
    # 1) all seven, corrected (neutral-ish light so poses/scale are readable)
    models=[];x=-4.5
    for k in F:
        url,m,h=pre(r,k,x,(0.80,1.07,0.80) if k=='saaya' else (1,1,1))
        d={'url':url,'preM':m,'hide':HIDE}
        if k=='saaya': d.update({'shadow':True,'eyeMat':'material0004','bodyColor':[.027,.031,.043],'hairColor':[.016,.02,.03],'eyeColor':[.18,.19,.23]})
        models.append(d);x+=1.5;print(k,'final height',round(h,2))
    r.render({'w':1800,'h':620,'models':models,'cam':{'eye':[0,1.1,9.8],'target':[0,0.95,0],'fov':27},'bg':[.14,.15,.2],
      'light':{'sky':[.6,.62,.72],'gnd':[.28,.25,.22],'keyC':[.6,.6,.6],'fillC':[.2,.2,.25],'rimC':[.17,.2,.27],'rimS':.55,'rimP':3.4}},OUT+'characters_all_seven.png')
    # 2) SAAYA in the three situations
    url,m,h=pre(r,'saaya',0,(0.80,1.07,0.80))
    sa={'url':url,'preM':m,'shadow':True,'eyeMat':'material0004','bodyColor':[.027,.031,.043],'hairColor':[.016,.02,.03],'eyeColor':[.18,.19,.23]}
    ground={'url':'/assets/models/hut.glb','hide':'Arbol|Cabin','flatPath':{'Plane_4':[.03,.045,.03]}}
    def cam(d,y=1.2,ty=1.0): return {'eye':[0,y,d],'target':[0,ty,0],'fov':40}
    base={'rimC':[.17,.2,.27],'rimS':.55,'rimP':3.4,'sky':[.04,.05,.09],'gnd':[.02,.02,.025],'keyC':[.03,.035,.06],'fillC':[.01,.01,.02]}
    r.render({'w':700,'h':900,'models':[ground,sa],'cam':cam(6.0,1.3,1.0),'bg':[.02,.025,.045],'fog':.03,'fogC':[.03,.04,.07],'light':base},OUT+'saaya_dark_silhouette.png')
    t=dict(base);t.update({'torch':True,'torchP':[0,1.3,5.5],'torchD':[0,-.05,-1],'torchC':[1,.9,.7]})
    r.render({'w':700,'h':900,'models':[ground,sa],'cam':cam(5.5,1.3,1.0),'bg':[.02,.025,.045],'fog':.03,'fogC':[.03,.04,.07],'light':t},OUT+'saaya_torch_beam.png')
    r.render({'w':700,'h':900,'models':[ground,sa],'cam':{'eye':[0,1.75,1.7],'target':[0,1.65,0],'fov':32},'bg':[.02,.025,.045],'fog':.03,'fogC':[.03,.04,.07],'light':t},OUT+'saaya_face_closeup.png')

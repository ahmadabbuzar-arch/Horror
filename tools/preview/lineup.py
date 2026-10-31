import sys,json;sys.path.insert(0,'/home/claude')
from render import R
import numpy as np
H={'raghunath':1.64,'kamla':1.50,'arvind':1.76,'shyamlal':1.75,'chotu':1.20,'dev':1.72,'saaya':1.90}
F={'raghunath':'raghunath','kamla':'kamla_devi','arvind':'dr_arvind','shyamlal':'shyamlal','chotu':'chotu','dev':'dev','saaya':'saaya'}
def pre(s,x,b):
    cx=(b['lo'][0]+b['hi'][0])/2;cz=(b['lo'][2]+b['hi'][2])/2;miny=b['lo'][1]
    m=np.eye(4);m[0,0]=m[1,1]=m[2,2]=s
    m[0,3]=x-cx*s;m[1,3]=-miny*s;m[2,3]=-cz*s
    return m.T.flatten().tolist()  # column-major
def lineup(r,out,files=F,heights=H,extra=None,mode='true'):
    models=[];x=-4.5
    for k,f in files.items():
        url='/'+f if f.startswith('assets') else '/assets/characters/'+f+'.glb'
        b=r.bounds(url)
        h=b['hi'][1]-b['lo'][1]
        s=heights[k]/h
        spec={'url':url,'preM':pre(s,x,b),'hide':'cigarette|pistol|slide|trigger|clip|bullet|Hats|Teeth|Tongue|Tearline|Occlusion|Cornea'}
        if extra and k in extra: spec.update(extra[k])
        models.append(spec);x+=1.5
        print(k,'trueH',round(h,3),'scale',round(s,4),'width',round((b['hi'][0]-b['lo'][0])*s,2))
    return models
if __name__=='__main__':
    with R() as r:
        models=lineup(r,None)
        spec={'w':1800,'h':520,'models':models,'cam':{'eye':[0,1.0,9.5],'target':[0,0.9,0],'fov':28},'bg':[.12,.13,.18],'light':{'sky':[.55,.58,.7],'gnd':[.25,.22,.2],'keyC':[.6,.6,.6],'fillC':[.2,.2,.25]}}
        r.render(spec,'/home/claude/shots_orig_lineup.png')

#!/usr/bin/env python3
"""Generic mobile texture optimiser for GLB files (geometry/UVs/skins/animations untouched).
  optimize_glb.py in.glb out.glb [--base 1024] [--other 512] [--drop nodeName,...]
base  = colour maps (baseColor/diffuse), other = normal/ORM/emissive maps. Textures already <= cap are kept.
Hair-style RGBA cut-outs are palette-quantised PNG; opaque maps become JPEG (q86 colour / q90 normal)."""
import json,struct,io,sys,argparse
from PIL import Image
ap=argparse.ArgumentParser();ap.add_argument('src');ap.add_argument('dst');ap.add_argument('--base',type=int,default=1024);ap.add_argument('--other',type=int,default=512);ap.add_argument('--drop',default='')
a=ap.parse_args()
d=open(a.src,'rb').read();_,_,L=struct.unpack('<III',d[:12]);o=12
while o<L:
    cl,ct=struct.unpack('<II',d[o:o+8]);c=d[o+8:o+8+cl]
    if ct==0x4E4F534A:j=json.loads(c)
    elif ct==0x004E4942:b=c
    o+=8+cl
for n in j['nodes']:
    if n.get('name') in set(filter(None,a.drop.split(','))): n.pop('mesh',None);n.pop('skin',None)
used_mesh=sorted({n['mesh'] for n in j['nodes'] if 'mesh' in n})
def walk_tex(obj,out,key=''):
    if isinstance(obj,dict):
        if 'index' in obj and key.endswith('Texture'): out.append((key,obj))
        for k,v in obj.items(): walk_tex(v,out,k)
    elif isinstance(obj,list):
        for v in obj: walk_tex(v,out,key)
mats=sorted({pr['material'] for m in used_mesh for pr in j['meshes'][m]['primitives'] if 'material' in pr})
refs=[];
for mi in mats: walk_tex(j['materials'][mi],refs)
role={}
for k,r in refs:
    s=j['textures'][r['index']]['source'];base=k in('baseColorTexture','diffuseTexture')
    role[s]='base' if base and role.get(s)!='other' else role.get(s,'other') if not base else 'base'
texs=sorted({r['index'] for k,r in refs});imgs=sorted({j['textures'][t]['source'] for t in texs})
accs=sorted({x for m in used_mesh for pr in j['meshes'][m]['primitives'] for x in list(pr['attributes'].values())+([pr['indices']] if 'indices' in pr else [])})
# animations / skins keep their accessors too
for an in j.get('animations',[]):
    for s in an['samplers']: accs+= [s['input'],s['output']]
for sk in j.get('skins',[]):
    if 'inverseBindMatrices' in sk: accs.append(sk['inverseBindMatrices'])
accs=sorted(set(accs))
mm={x:i for i,x in enumerate(mats)};tm={x:i for i,x in enumerate(texs)};im_={x:i for i,x in enumerate(imgs)};am={x:i for i,x in enumerate(accs)};mshm={x:i for i,x in enumerate(used_mesh)}
nb=bytearray();nbv=[]
def addbv(data,target=None,stride=None):
    while len(nb)%4:nb.append(0)
    e={'buffer':0,'byteOffset':len(nb),'byteLength':len(data)}
    if target:e['target']=target
    if stride:e['byteStride']=stride
    nb.extend(data);nbv.append(e);return len(nbv)-1
bvmap={};nacc=[]
for x in accs:
    ac=dict(j['accessors'][x]);bv=j['bufferViews'][ac['bufferView']];k=ac['bufferView']
    if k not in bvmap: bvmap[k]=addbv(b[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']],bv.get('target'),bv.get('byteStride'))
    ac['bufferView']=bvmap[k];nacc.append(ac)
rep=[];nimgs=[]
for i in imgs:
    im=j['images'][i];bv=j['bufferViews'][im['bufferView']];raw=b[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]
    img=Image.open(io.BytesIO(raw))
    if img.mode=='P': img=img.convert('RGBA')
    w,h=img.size;r=role.get(i,'other');cap=a.base if r=='base' else a.other
    if max(w,h)>cap: s=cap/max(w,h);img=img.resize((max(1,round(w*s)),max(1,round(h*s))),Image.LANCZOS)
    alpha=img.mode in('RGBA','LA') and img.convert('RGBA').getchannel('A').getextrema()[0]<250
    out=io.BytesIO()
    if max(w,h)<=256 and max(w,h)==max(img.size): out.write(raw);mt=im['mimeType']
    elif alpha:
        img=img.convert('RGBA')
        (img.quantize(256,method=Image.FASTOCTREE) if max(img.size)>=512 else img).save(out,'PNG',optimize=True);mt='image/png'
    else: img.convert('RGB').save(out,'JPEG',quality=86 if r=='base' else 90,optimize=True);mt='image/jpeg'
    # adaptive: near-flat maps (tiny when compressed) do not need 1024^2 of GPU memory
    if not alpha and max(img.size)>128 and len(out.getvalue())<24*1024:
        img=img.resize((128,128) if img.size[0]==img.size[1] else (128,max(1,128*img.size[1]//img.size[0])),Image.LANCZOS);out=io.BytesIO();img.convert('RGB').save(out,'JPEG',quality=90,optimize=True);mt='image/jpeg'
    elif not alpha and r=='base' and max(img.size)>512 and len(out.getvalue())<110*1024:
        img=img.resize((512,512) if img.size[0]==img.size[1] else (512,max(1,512*img.size[1]//img.size[0])),Image.LANCZOS);out=io.BytesIO();img.convert('RGB').save(out,'JPEG',quality=88,optimize=True);mt='image/jpeg'
    rep.append((i,r,(w,h),img.size,len(out.getvalue())//1024));nimgs.append({'bufferView':addbv(out.getvalue()),'mimeType':mt})
ntex=[]
for t in texs: tx=dict(j['textures'][t]);tx['source']=im_[tx['source']];ntex.append(tx)
nmat=[]
for mi in mats:
    m=json.loads(json.dumps(j['materials'][mi]));rr=[];walk_tex(m,rr)
    for k,r in rr:r['index']=tm[r['index']]
    nmat.append(m)
nmesh=[]
for m in used_mesh:
    me=json.loads(json.dumps(j['meshes'][m]))
    for pr in me['primitives']:
        pr['attributes']={k:am[v] for k,v in pr['attributes'].items()}
        if 'indices' in pr:pr['indices']=am[pr['indices']]
        if 'material' in pr:pr['material']=mm[pr['material']]
    nmesh.append(me)
for n in j['nodes']:
    if 'mesh' in n:
        n['mesh']=mshm[n['mesh']]
        mn_=nmesh[n['mesh']].get('name')
        if mn_ and (not n.get('name') or n['name'].startswith('Object_')): n['name']=mn_   # GLTFLoader names meshes after their node; keep the descriptive mesh name
for an in j.get('animations',[]):
    for s in an['samplers']: s['input']=am[s['input']];s['output']=am[s['output']]
for sk in j.get('skins',[]):
    if 'inverseBindMatrices' in sk: sk['inverseBindMatrices']=am[sk['inverseBindMatrices']]
j.update(accessors=nacc,bufferViews=nbv,images=nimgs,textures=ntex,materials=nmat,meshes=nmesh,buffers=[{'byteLength':len(nb)}])
js=json.dumps(j,separators=(',',':')).encode()
while len(js)%4:js+=b' '
while len(nb)%4:nb.append(0)
tot=12+8+len(js)+8+len(nb)
open(a.dst,'wb').write(struct.pack('<III',0x46546C67,2,tot)+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(nb),0x004E4942)+bytes(nb))
print(a.src.split('/')[-1],'->',a.dst.split('/')[-1],'| images:',[(r[0],r[1],r[2][0],'->',r[3][0],str(r[4])+'KB') for r in rep],'| total',tot//1024,'KB')

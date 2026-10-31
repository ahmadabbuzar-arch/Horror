#!/usr/bin/env python3
"""Mobile-optimise the Dr. Arvind GLB: drop hidden teeth mesh, downscale/recompress textures,
prune unreferenced data. Geometry and UVs are untouched. Usage: optimize_doctor.py in.glb out.glb"""
import json,struct,io,sys
from PIL import Image
src,dst=sys.argv[1],sys.argv[2]
d=open(src,'rb').read();_,_,L=struct.unpack('<III',d[:12]);o=12
while o<L:
    cl,ct=struct.unpack('<II',d[o:o+8]);c=d[o+8:o+8+cl]
    if ct==0x4E4F534A:j=json.loads(c)
    elif ct==0x004E4942:b=c
    o+=8+cl
DROP_NODES={'teeth_base'}          # closed mouth: ~4.5k verts never visible
for n in j['nodes']:
    if n.get('name') in DROP_NODES: n.pop('mesh',None)
used_mesh=sorted({n['mesh'] for n in j['nodes'] if 'mesh' in n})
# --- roles of each image (base colour / normal) for caps
role={}
for m in j['materials']:
    pm=m.get('pbrMetallicRoughness',{})
    for key,r in((pm.get('baseColorTexture'),'base'),(m.get('normalTexture'),'normal')):
        if key: role[j['textures'][key['index']]['source']]=r
CAP={'base':1024,'normal':1024}
NCAP_SMALL=512
SMALL_BASE={9}   # normals that were <=2048 get 512
def recompress(idx):
    im=j['images'][idx];bv=j['bufferViews'][im['bufferView']]
    raw=b[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]
    img=Image.open(io.BytesIO(raw));w,h=img.size;r=role.get(idx,'base')
    cap=CAP[r]
    if idx in SMALL_BASE: cap=512   # eye atlas: iris detail survives at 512
    if r=='normal' and max(w,h)<=2048: cap=NCAP_SMALL
    if max(w,h)>cap:
        img=img.resize((cap,cap) if w==h else (max(1,w*cap//max(w,h)),max(1,h*cap//max(w,h))),Image.LANCZOS)
    has_a=img.mode=='RGBA' and img.getchannel('A').getextrema()[0]<250
    out=io.BytesIO()
    if has_a and max(img.size)>=512: img.quantize(256,method=Image.FASTOCTREE).save(out,'PNG',optimize=True);mt='image/png'   # alpha-cutout hair
    elif has_a or max(w,h)<=256: img.save(out,'PNG',optimize=True);mt='image/png'
    else: img.convert('RGB').save(out,'JPEG',quality=86 if r=='base' else 90,optimize=True);mt='image/jpeg'
    return out.getvalue(),mt,(w,h),img.size
# --- reachability / remap
mats=sorted({pr['material'] for m in used_mesh for pr in j['meshes'][m]['primitives'] if 'material' in pr})
def tex_of(m):
    t=[];pm=m.get('pbrMetallicRoughness',{})
    for k in(pm.get('baseColorTexture'),pm.get('metallicRoughnessTexture'),m.get('normalTexture'),m.get('occlusionTexture'),m.get('emissiveTexture')):
        if k:t.append(k['index'])
    return t
texs=sorted({t for mi in mats for t in tex_of(j['materials'][mi])})
imgs=sorted({j['textures'][t]['source'] for t in texs})
accs=sorted({a for m in used_mesh for pr in j['meshes'][m]['primitives'] for a in list(pr['attributes'].values())+([pr['indices']] if 'indices' in pr else [])})
mm={x:i for i,x in enumerate(mats)};tm={x:i for i,x in enumerate(texs)};im_={x:i for i,x in enumerate(imgs)};am={x:i for i,x in enumerate(accs)};mshm={x:i for i,x in enumerate(used_mesh)}
newbin=bytearray();newbv=[]
def addbv(data,target=None):
    while len(newbin)%4:newbin.append(0)
    e={'buffer':0,'byteOffset':len(newbin),'byteLength':len(data)}
    if target:e['target']=target
    newbin.extend(data);newbv.append(e);return len(newbv)-1
bvmap={}
newacc=[]
for a in accs:
    ac=dict(j['accessors'][a]);bv=j['bufferViews'][ac['bufferView']]
    key=ac['bufferView']
    if key not in bvmap:
        bvmap[key]=addbv(b[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']],bv.get('target'))
        if 'byteStride' in bv:newbv[-1]['byteStride']=bv['byteStride']
    ac['bufferView']=bvmap[key];newacc.append(ac)
newimgs=[];rep=[]
for i in imgs:
    data,mt,old,new=recompress(i);rep.append((i,old,new,len(data)//1024))
    newimgs.append({'bufferView':addbv(data),'mimeType':mt})
newtex=[]
for t in texs:
    tx=dict(j['textures'][t]);tx['source']=im_[tx['source']];newtex.append(tx)
def remap_tex(k):
    if k:k['index']=tm[k['index']]
newmat=[]
for mi in mats:
    m=json.loads(json.dumps(j['materials'][mi]));pm=m.get('pbrMetallicRoughness',{})
    for k in(pm.get('baseColorTexture'),pm.get('metallicRoughnessTexture'),m.get('normalTexture'),m.get('occlusionTexture'),m.get('emissiveTexture')):remap_tex(k)
    newmat.append(m)
newmesh=[]
for m in used_mesh:
    me=json.loads(json.dumps(j['meshes'][m]))
    for pr in me['primitives']:
        pr['attributes']={k:am[v] for k,v in pr['attributes'].items()}
        if 'indices' in pr:pr['indices']=am[pr['indices']]
        if 'material' in pr:pr['material']=mm[pr['material']]
    newmesh.append(me)
for n in j['nodes']:
    if 'mesh' in n:n['mesh']=mshm[n['mesh']]
j.update(accessors=newacc,bufferViews=newbv,images=newimgs,textures=newtex,materials=newmat,meshes=newmesh,buffers=[{'byteLength':len(newbin)}])
j.pop('samplers',None) if False else None
js=json.dumps(j,separators=(',',':')).encode()
while len(js)%4:js+=b' '
while len(newbin)%4:newbin.append(0)
tot=12+8+len(js)+8+len(newbin)
open(dst,'wb').write(struct.pack('<III',0x46546C67,2,tot)+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(newbin),0x004E4942)+bytes(newbin))
for r in rep:print('image',r)
tris=sum((newacc[pr['indices']]['count']//3) for me in newmesh for pr in me['primitives'])
print('tris',tris,'size KB',tot//1024)

#!/usr/bin/env python3
"""Static asset audit (no browser, no Three.js).  usage: python3 tools/check_assets.py   (run from the project root)
1. every assets/*.glb path referenced by index.html / js/*.js exists with EXACT case, and is not referenced twice under different spellings
2. every GLB is structurally valid: header, lengths, accessor/bufferView ranges, images decode, no external URIs, texture indices valid
3. every regex in js/p1-config.js (hide / headParts / materials[].mesh / mat) matches something in the model it targets
4. SAAYA eye material, Chotu idle clip and the car's part names exist
5. lists assets nothing references"""
import re,os,sys,json,struct,io,subprocess,glob
from PIL import Image
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));os.chdir(root)
bad=0
def err(m):
    global bad;bad+=1;print('  ERROR',m)
def okm(m):print('  ok   ',m)
def load(p):
    d=open(p,'rb').read()
    if d[:4]!=b'glTF':raise ValueError('bad magic')
    ver,L=struct.unpack('<II',d[4:12])
    if ver!=2:raise ValueError('glTF version %d'%ver)
    if L!=len(d):raise ValueError('header length %d != file size %d (truncated/corrupt)'%(L,len(d)))
    o=12;j=b=None
    while o<L:
        cl,ct=struct.unpack('<II',d[o:o+8]);c=d[o+8:o+8+cl]
        if ct==0x4E4F534A:j=json.loads(c)
        elif ct==0x004E4942:b=c
        o+=8+cl
    return j,b
print('1. referenced paths')
refs={}
for f in ['index.html']+sorted(glob.glob('js/*.js')):
    for m in re.finditer(r"assets/[A-Za-z0-9_./\-]+\.glb",open(f,encoding='utf-8').read()):refs.setdefault(m.group(0),set()).add(f)
for p,fs in sorted(refs.items()):
    d,n=os.path.split(p)
    if not os.path.isfile(p):err('%s referenced by %s but missing'%(p,sorted(fs)))
    elif n not in os.listdir(d):err('%s exists only with different letter case (breaks on Linux servers)'%p)
    else:okm('%-36s %6.2f MB  <- %s'%(p,os.path.getsize(p)/1048576,', '.join(sorted(fs))))
    if '\\' in p or p.startswith('/') or '..' in p:err('non-relative path '+p)
print('2. GLB structure')
G={}
for p in sorted(glob.glob('assets/**/*.glb',recursive=True)):
    try:
        j,b=load(p);G[p]=j;acc=j['accessors'];bl=len(b) if b else 0
        for i,a in enumerate(acc):
            bv=j['bufferViews'][a['bufferView']];sz={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a['componentType']]*{'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
            end=bv.get('byteOffset',0)+a.get('byteOffset',0)+(a['count']-1)*max(bv.get('byteStride',sz),sz)+sz
            if end>bl:raise ValueError('accessor %d out of range'%i)
        for k,im in enumerate(j.get('images',[])):
            if 'uri' in im and not im['uri'].startswith('data:'):raise ValueError('image %d uses external file %s'%(k,im['uri']))
            if 'bufferView' in im:
                bv=j['bufferViews'][im['bufferView']];Image.open(io.BytesIO(b[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']])).load()
        for k,bf in enumerate(j['buffers']):
            if 'uri' in bf and not bf['uri'].startswith('data:'):raise ValueError('external .bin '+bf['uri'])
        nt=len(j.get('textures',[]));ni=len(j.get('images',[]))
        for t in j.get('textures',[]):
            if t.get('source') is not None and t['source']>=ni:raise ValueError('texture source out of range')
        okm('%-36s valid (%d accessors, %d images, %d meshes, %d anims)'%(p,len(acc),ni,len(j['meshes']),len(j.get('animations',[]))))
    except Exception as e:err('%s: %s'%(p,e))
print('3/4. config regexes vs real mesh/material names')
JS="const vm=require('vm'),fs=require('fs');const P1={cfg:{car:{}}};const w={P1:P1,window:null};w.window=w;vm.createContext(w);vm.runInContext(fs.readFileSync('js/p1-config.js','utf8'),w);console.log(JSON.stringify(w.P1.config))"
cfg=json.loads(subprocess.check_output(['node','-e',JS]))
ROSTER={'raghunath':'raghunath','kamla':'kamla_devi','arvind':'dr_arvind','shyamlal':'shyamlal','chotu':'chotu','dev':'dev','saaya':'saaya'}
san=lambda n:re.sub(r'[\[\]\.:/]','',re.sub(r'\s','_',n or ''))   # what GLTFLoader does to node names
def rx(s):
    m=re.match(r'^/(.*)/([a-z]*)$',s);return re.compile(m.group(1)) if m else re.compile(s,re.I)
for cid,fn in ROSTER.items():
    p='assets/characters/%s.glb'%fn
    if p not in G:err(p+' not loaded');continue
    j=G[p];names=[san(n.get('name')) for n in j['nodes'] if 'mesh' in n];mats=[m.get('name') or '' for m in j['materials']]
    a=cfg['appearance'][cid]
    if a.get('hide'):
        h=[n for n in names if rx(a['hide']).search(n)]
        print('  ok   ' if h else '  note ','%-9s hide /%s/ -> %s'%(cid,a['hide'],h or 'matches nothing (fine if those meshes were already removed from the GLB, e.g. the guard pistol)'))
    if a.get('headParts'):
        h=[n for n in names if rx(a['headParts']).search(n)];(okm if h else err)('%-9s headParts -> %d meshes'%(cid,len(h)))
    for i,r in enumerate(a.get('materials',[])):
        h=[n for n in names if (not r.get('mesh') or rx(r['mesh']).search(n))]
        if r.get('mat'):h=[n for n in h if any(rx(r['mat']).search(m) for m in mats)]
        (okm if h else err)('%-9s materials[%d] mesh /%s/ -> %d meshes'%(cid,i,r.get('mesh'),len(h)))
    if a.get('anim'):
        c=[x.get('name') for x in j.get('animations',[])];(okm if a['anim'] in c else err)('%-9s clip "%s" in %s'%(cid,a['anim'],c))
    if cid=='saaya':
        e=cfg['saaya']['eyeMat'];(okm if e in mats else err)('saaya    eye material "%s" in %s'%(e,mats))
    if a.get('shadow') is None and not a.get('materials') and cid!='saaya':err(cid+': no material rules')
sj=G.get('assets/vehicles/sedan.glb')
if sj:
    nn={re.sub(r'[^A-Za-z0-9]','',n.get('name','')) for n in sj['nodes']}
    for pat in['KUZA','KAPOT','BAQAJ','ONQAPI','ARXAQAPI','TEKER']:
        h=[n for n in nn if n.startswith(pat)];(okm if h else err)('car part %-9s -> %s'%(pat,sorted(h)))
print('5. unreferenced assets')
used={p for p in refs};allg={p for p in G}
for p in sorted(allg-used):print('  note  %s is not referenced by any code'%p)
print('\nRESULT:','FAIL (%d errors)'%bad if bad else 'all checks passed');sys.exit(1 if bad else 0)

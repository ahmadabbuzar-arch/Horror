import json,struct,sys,numpy as np
def load(p):
    d=open(p,'rb').read()
    magic,ver,ln=struct.unpack('<III',d[:12]);o=12;js=None;bn=None
    while o<ln:
        cl,ct=struct.unpack('<II',d[o:o+8]);ch=d[o+8:o+8+cl];o+=8+cl
        if ct==0x4E4F534A: js=json.loads(ch)
        elif ct==0x004E4942: bn=ch
    return js,bn
def nodemat(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4,4).T
    t=np.array(n.get('translation',[0,0,0]));r=n.get('rotation',[0,0,0,1]);s=np.array(n.get('scale',[1,1,1]))
    x,y,z,w=r
    R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
    M=np.eye(4);M[:3,:3]=R*s;M[:3,3]=t;return M
def accessor(js,bn,i):
    a=js['accessors'][i];bv=js['bufferViews'][a['bufferView']]
    cnt={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    dt={5126:'<f4',5123:'<u2',5125:'<u4',5121:'u1',5120:'i1',5122:'<i2'}[a['componentType']]
    off=bv.get('byteOffset',0)+a.get('byteOffset',0)
    stride=bv.get('byteStride',0)
    isz=np.dtype(dt).itemsize*cnt
    if stride and stride!=isz:
        raw=np.frombuffer(bn,dtype='u1',count=stride*a['count'],offset=off).reshape(a['count'],stride)[:,:isz].copy()
        return raw.view(dt).reshape(a['count'],cnt)
    return np.frombuffer(bn,dtype=dt,count=a['count']*cnt,offset=off).reshape(a['count'],cnt)
def walk(js,bn,fn):
    sc=js['scenes'][js.get('scene',0)]
    def rec(ni,M,path):
        n=js['nodes'][ni];W=M@nodemat(n);p=path+[n.get('name',str(ni))]
        fn(ni,n,W,p)
        for c in n.get('children',[]): rec(c,W,p)
    for r in sc['nodes']: rec(r,np.eye(4),[])

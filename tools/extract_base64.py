#!/usr/bin/env python3
"""Extract the base64 GLBs (V64 = village, B64 = hut) that were embedded in the original HTML.
Usage: extract_base64.py Horror_House___First_Person.html assets/models"""
import re,sys,base64,os
src,outdir=sys.argv[1],sys.argv[2];os.makedirs(outdir,exist_ok=True)
html=open(src,encoding='utf-8').read()
for var,name in(('V64','village.glb'),('B64','hut.glb')):
    m=re.search(r'const '+var+r'="([A-Za-z0-9+/=]+)"',html)
    data=base64.b64decode(m.group(1));assert data[:4]==b'glTF',var
    open(os.path.join(outdir,name),'wb').write(data);print(name,len(data)//1024,'KB')

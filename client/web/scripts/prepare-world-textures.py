#!/usr/bin/env python3
"""Compress world sprites once each, with four bounded offline worker processes."""
import concurrent.futures, hashlib, importlib.util, json, shutil, time
from collections import deque
from pathlib import Path
from PIL import Image
spec=importlib.util.spec_from_file_location('assets',Path(__file__).with_name('prepare-assets.py'))
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
ROOT=Path(__file__).resolve().parents[2]/'dofus3/.cache/dofus3/world'

def encode(item):
    gid,meta=item; source=ROOT/meta['texture'];sig=[source.stat().st_size,source.stat().st_mtime_ns]
    with Image.open(source) as image:
        image=image.convert('RGBA');w,h=image.size
        # Very small sprites don't justify a second resource; retain PNG.
        if w*h<4096 or w>4096 or h>4096:return gid,{'signature':sig,'fallback':True}
        padded=Image.new('RGBA',((w+3)//4*4,(h+3)//4*4));padded.paste(image,(0,0))
        digest=hashlib.sha256(b'giny.bc7.alpha_ultrafast.v1'+str(padded.size).encode()+padded.tobytes()).hexdigest()
        relative=f'optimized/pages/{digest}.ktx2';dest=ROOT/relative
        if not dest.exists():
            if shutil.disk_usage(ROOT).free<4*1024**3:raise RuntimeError('Disk reserve reached')
            a.atomic(dest,a.encode_bc7(padded, profile="alpha_ultrafast"))
        return gid,{'signature':sig,'bc7_texture':relative,'frame':[0,0,w,h]}

def main():
    catalog=json.loads((ROOT/'gfx/_catalog.json').read_bytes());path=ROOT/'texture-variants.json'
    index=json.loads(path.read_bytes()) if path.exists() else {};todo=[]
    for gid,meta in catalog.items():
        p=ROOT/meta['texture'];sig=[p.stat().st_size,p.stat().st_mtime_ns];old=index.get(gid,{})
        if old.get('signature')==sig and (old.get('fallback') or (ROOT/old.get('bc7_texture','missing')).is_file()):continue
        todo.append((gid,meta))
    started=time.monotonic()
    with concurrent.futures.ProcessPoolExecutor(max_workers=4) as executor:
        remaining=iter(todo);pending=deque()
        for _ in range(min(16,len(todo))):pending.append(executor.submit(encode,next(remaining)))
        i=0
        while pending:
            gid,result=pending.popleft().result()
            item=next(remaining,None)
            if item is not None:pending.append(executor.submit(encode,item))
            index[gid]=result
            if i%100==0:
                a.atomic(path,a.compact(index));print(json.dumps({'done':i+1,'total':len(todo),'seconds':round(time.monotonic()-started,1)}),flush=True)
            i+=1
    a.atomic(path,a.compact(index));print(json.dumps({'finished':len(index),'bc7':sum('bc7_texture' in x for x in index.values())}),flush=True)
if __name__=='__main__':main()

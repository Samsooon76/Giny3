#!/usr/bin/env python3
"""Refresh atlas placements in a published world without replacing fresh map data."""
import gzip,hashlib,importlib.util,json,os,shutil
from pathlib import Path
spec=importlib.util.spec_from_file_location('a',Path(__file__).with_name('prepare-assets.py'))
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
base=Path(__file__).resolve().parents[2]/'dofus3';world=base/'.cache/dofus3/world';runtime=base/'.cache/dofus3/runtime'
target=Path(__file__).resolve().parents[1]/'game-data';manifest=json.loads((target/'optimized/manifest.json').read_bytes());old=json.loads((runtime/'optimized/manifest.json').read_bytes());count=0;frames=0
for mid,entry in old['maps'].items():
    doc=a.read_doc(world/f'maps/{mid}.json.gz');previous=a.read_doc(a.source_file([runtime],entry['path']))
    reused=a.reuse_atlas_frames(doc,previous,world,runtime)
    if not reused:continue
    # Keep compressed variants already published for other sprites on this map.
    current=a.read_doc(a.source_file([target],manifest['maps'][mid]['path']))
    for gid,gfx in doc['gfx'].items():
        if not gfx.get('frame'):
            for k in ('frame','bc7_texture'):
                if k in current['gfx'].get(gid,{}):gfx[k]=current['gfx'][gid][k]
        for k in ('texture','bc7_texture'):
            if not gfx.get(k):continue
            dest=target/gfx[k]
            if not dest.exists():
                source=a.source_file([runtime,world],gfx[k]);assert source,gfx[k]
                dest.parent.mkdir(parents=True,exist_ok=True)
                try:os.link(source,dest)
                except OSError:shutil.copy2(source,dest)
    raw=a.compact(doc);digest=hashlib.sha256(raw).hexdigest();relative=f'optimized/maps/{mid}-{digest}.json'
    a.atomic(target/(relative+'.gz'),gzip.compress(raw,compresslevel=6,mtime=0));manifest['maps'][mid]={'path':relative,'hash':digest};count+=1;frames+=reused
manifest.pop('revision',None);manifest['revision']=hashlib.sha256(a.compact(manifest)).hexdigest();a.atomic(target/'optimized/manifest.json',a.compact(manifest))
report=json.loads((target/'release-report.json').read_bytes());report['atlas_maps_reused']=count;report['atlas_frames_verified']=frames;a.atomic(target/'release-report.json',json.dumps(report,indent=2).encode())
print(json.dumps({'maps':count,'frames':frames}))

#!/usr/bin/env python3
"""Prepare ambient map data offline. Immutable documents precede manifest publication."""
import argparse, gzip, hashlib, json, os, sys, time, shutil, math
from pathlib import Path
BASE=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(BASE/'dofus3'))
from extractor.maps.export_map import _index_bundle_maps, resolve_interactive_props, resolve_particles
from extractor.maps.effects import EFFECTS_VERSION, EXPORTER_VERSION, build_effects_document
from extractor.unity_loader import client_version, content_root
WORLD=BASE/'dofus3/.cache/dofus3/world'
TARGET=BASE/'web/game-data'
def safe(x):
 if isinstance(x,float) and not math.isfinite(x):return 'Infinity' if x>0 else '-Infinity' if x<0 else None
 if isinstance(x,list):return [safe(v) for v in x]
 if isinstance(x,dict):return {k:safe(v) for k,v in x.items()}
 return x
def packed(x):return json.dumps(safe(x),allow_nan=False,separators=(',',':'),ensure_ascii=False).encode()
def atomic(p,b):
 p.parent.mkdir(parents=True,exist_ok=True);t=p.with_name(p.name+'.ambient.tmp');t.write_bytes(b);os.replace(t,p)
def read(p):
 if not p.exists():p=Path(str(p)+'.gz')
 b=p.read_bytes();return json.loads(gzip.decompress(b) if p.suffix=='.gz' else b)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--maps');ap.add_argument('--publish',action='store_true');ap.add_argument('--skip-extract',action='store_true');a=ap.parse_args()
 index=read(WORLD/'maps/_bundle_index.json');selected=set(a.maps.split(',')) if a.maps else set(index)
 cache=WORLD/'ambient-v3';done=0;start=time.monotonic()
 source_version=client_version(Path('/Applications/Ankama/Dofus-dofus3')) or 'unknown'
 def cache_key(bundle):
  p=content_root(Path('/Applications/Ankama/Dofus-dofus3'))/'Map'/'Data'/bundle
  stamp=f'{p.stat().st_size}:{int(p.stat().st_mtime)}' if p.exists() else 'missing'
  return hashlib.sha256(f'{source_version}:{EXPORTER_VERSION}:{EFFECTS_VERSION}:{bundle}:{stamp}'.encode()).hexdigest()
 if not a.skip_extract:
  for bundle in sorted({index[m] for m in selected}):
   mids=[m for m in selected if index[m]==bundle]
   key=cache_key(bundle);meta=cache/f'{bundle}.key'
   if meta.exists() and meta.read_text()==key and all((cache/f'{m}.json.gz').exists() for m in mids):continue
   _,trees=_index_bundle_maps(content_root(Path('/Applications/Ankama/Dofus-dofus3'))/'Map/Data'/bundle)
   for mid in mids:
    tree=trees[mid]
    particles=resolve_particles(tree)
    effects=build_effects_document(tree,particles=particles)
    doc={'props':resolve_interactive_props(tree),'particles':effects['particles'],
         'effects_version':effects['effects_version'],'environment':effects['environment'],
         'materials':effects['materials'],'refraction':effects['refraction'],
         'effect_sequences':effects['effect_sequences'],'effect_dependencies':effects['effect_dependencies'],
         'effect_coverage':effects['effect_coverage']}
    atomic(cache/f'{mid}.json.gz',gzip.compress(packed(doc),mtime=0))
   atomic(meta,key.encode());done+=1
   if done%10==0:print(json.dumps({'bundles':done,'seconds':round(time.monotonic()-start)}),flush=True)
 if not a.publish:return
 effects=read(WORLD/'effects/catalog.json')
 catalog=read(WORLD/'gfx/_catalog.json');variants=read(WORLD/'texture-variants.json');manifest=read(TARGET/'optimized/manifest.json')
 report={'maps':0,'animated_instances':0,'particle_systems':0,'missing_textures':{},'ambient_props':{}}
 for mid in sorted(selected,key=int):
  if mid not in manifest['maps']:continue
  ambient=read(cache/f'{mid}.json.gz');doc=read(TARGET/manifest['maps'][mid]['path'])
  old={(p['prop_id'],p['cell_id']):p for p in doc['props'] if not p.get('ambient')}
  for p in ambient['props']:
   if not p['ambient']:p['static']=old.get((p['prop_id'],p['cell_id']),{}).get('static',False)
   else:report['ambient_props'][str(p['prop_id'])]=report['ambient_props'].get(str(p['prop_id']),0)+1
  doc['props']=ambient['props'];doc['particles']=ambient['particles'];doc['ambient_version']=3
  doc['effects_version']=ambient.get('effects_version',EFFECTS_VERSION)
  for key in ('environment','materials','refraction','effect_sequences','effect_dependencies','effect_coverage'):
   if key in ambient:doc[key]=ambient[key]
  doc['elements']=[e for e in doc['elements'] if e['layer']!='animated']
  # Keep authored refraction elements; they are drawn by the refraction pass.
  for particle in doc['particles']:
   for k in ('material','trailMaterial'):
    material=particle[k]
    ref=material.get('textureRef') or {}
    texture=ref.get('path') or f"effects/particles/{material['gfxId']}.png"
    if texture in effects:material['texture']=texture
  for dep in doc.get('effect_dependencies') or []:
   rel=dep.get('path')
   if rel and rel in effects and not (TARGET/rel).exists():
    dest=TARGET/rel;dest.parent.mkdir(parents=True,exist_ok=True)
    if (WORLD/rel).exists():os.link(WORLD/rel,dest)
  ids={str(p[k]['gfxId']) for p in doc['particles'] for k in ('material','trailMaterial') if p[k]['gfxId']>0 and 'texture' not in p[k]}
  refraction_ids={str(e['gfx_id']) for e in doc.get('refraction',[]) if e.get('gfx_id',0)>0}
  ids |= refraction_ids
  for gid in ids:
   if gid not in doc['gfx']:
    if gid not in catalog:
     report['missing_textures'].setdefault(gid,[]).append(int(mid));continue
    gfx=dict(catalog[gid]);v={} if gid in refraction_ids else variants.get(gid,{})
    for k in ('bc7_texture','frame'):
     if k in v:gfx[k]=v[k]
    doc['gfx'][gid]=gfx
   for k in ('texture','bc7_texture'):
    rel=doc['gfx'][gid].get(k)
    if rel and not (TARGET/rel).exists():
     dest=TARGET/rel;dest.parent.mkdir(parents=True,exist_ok=True)
     os.link(WORLD/rel,dest)
  raw=packed(doc);digest=hashlib.sha256(raw).hexdigest();rel=f'optimized/maps/{mid}-{digest}.json';blob=gzip.compress(raw,compresslevel=6,mtime=0)
  atomic(TARGET/(rel+'.gz'),blob);atomic(TARGET/f'maps/{mid}.json.gz',blob)
  # Preserve release atlas/BC7 references in staging and copy their dependencies.
  for gfx in doc['gfx'].values():
   for k in ('texture','bc7_texture'):
    relative=gfx.get(k)
    if relative and not (WORLD/relative).exists():
     dest=WORLD/relative;dest.parent.mkdir(parents=True,exist_ok=True);os.link(TARGET/relative,dest)
  atomic(WORLD/f'maps/{mid}.json.gz',blob)
  manifest['maps'][mid]={'path':rel,'hash':digest};report['maps']+=1;report['animated_instances']+=sum(p.get('ambient',False) for p in doc['props']);report['particle_systems']+=len(doc['particles'])
 for root in (WORLD,TARGET):
  ep=root/'optimized/entities-manifest.json';entities=read(ep)
  unavailable={f'entities/prop_{pid}.json':'source_missing_or_unsupported_animation' for pid in report['ambient_props'] if f'entities/prop_{pid}.json' not in entities['entities']}
  entities.setdefault('unavailable',{}).update(unavailable)
  atomic(ep,packed(entities))
 report['unavailable_ambient_props']=sorted(unavailable)
 manifest.pop('revision',None);manifest['revision']=hashlib.sha256(packed(manifest)).hexdigest()
 atomic(TARGET/'optimized/manifest.json',packed(manifest));atomic(TARGET/'ambient-report.json',packed(report))
 print(json.dumps({k:len(v) if isinstance(v,dict) else v for k,v in report.items()}),flush=True)
if __name__=='__main__':main()

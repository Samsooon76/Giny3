#!/usr/bin/env python3
"""Recover skipped prop clips with the flag decoder, without changing already validated clips."""
import gzip,importlib.util,json,os,sys,tempfile
from pathlib import Path
WEB=Path(__file__).resolve().parents[1];BASE=WEB.parent/'dofus3';sys.path.insert(0,str(BASE))
from extractor.entities.export_bone import export_animated_bundle
spec=importlib.util.spec_from_file_location('prepared',WEB/'scripts/prepare-entities.py');e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
world=BASE/'.cache/dofus3/world';target=WEB/'game-data';source=Path('/Applications/Ankama/Dofus-dofus3/DofusContent/Content/Animations/Props')
changed=[];report={};scratch=world/'ambient-props';scratch.mkdir(exist_ok=True)
for bundle in sorted(source.glob('props_assets_prop_*.bundle')):
 pid=bundle.stem.split('_')[-1];name=f'prop_{pid}.json';oldpath=world/'entities'/(name+'.gz')
 old=e.assets.read_doc(oldpath) if oldpath.exists() else {'animations':{}}
 if old.get('animations') and not old.get('skipped_animations'):continue
 try:
  cached=scratch/'entities'/name
  if not cached.exists():export_animated_bundle(bundle,scratch,int(pid),name,scale=1,animation_filter={'*'},default_idle_walk=False)
  doc=e.assets.read_doc(cached)
  added=set(doc['animations'])-set(old['animations'])
  if not added:report[pid]={'added':0,'remaining':doc['skipped_animations']};continue
  old['animations'].update({k:doc['animations'][k] for k in added});doc['animations']=old['animations']
  blob=gzip.compress(e.assets.compact(doc),compresslevel=6,mtime=0)
  for root in (world,target):
   e.assets.atomic(root/'entities'/(name+'.gz'),blob)
   tex=root/doc['texture']
   if not tex.exists():tex.parent.mkdir(parents=True,exist_ok=True);os.link(scratch/doc['texture'],tex)
  changed.append(name);report[pid]={'added':len(added),'remaining':doc['skipped_animations']}
  print(pid,'recovered',len(added),flush=True)
 except Exception as ex:report[pid]={'error':str(ex)};print(pid,'ERROR',str(ex),flush=True)
if changed:
 e.ROOTS=[world];e.TARGET=target;sys.argv=[sys.argv[0],*changed];e.main()
 current=e.assets.read_doc(target/'optimized/entities-manifest.json');staged=e.assets.read_doc(world/'optimized/entities-manifest.json')
 for name in changed:
  key='entities/'+name;relative=current['entities'].get(key)
  if not relative:continue
  metadata=e.assets.read_doc(target/(relative+'.gz'))
  for asset in [relative,*metadata.get('animation_files',{}).values()]:
   dest=world/(asset+'.gz')
   if not dest.exists():dest.parent.mkdir(parents=True,exist_ok=True);os.link(target/(asset+'.gz'),dest)
  staged['entities'][key]=relative
  current.get('unavailable',{}).pop(key,None);staged.get('unavailable',{}).pop(key,None)
 for root,manifest in [(world,staged),(target,current)]:e.assets.atomic(root/'optimized/entities-manifest.json',e.assets.compact(manifest))
e.assets.atomic(target/'ambient-prop-recovery.json',e.assets.compact(report))
print('Recovered props',len(changed),flush=True)

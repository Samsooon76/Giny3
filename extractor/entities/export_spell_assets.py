"""Prepare official cast/FX clips ahead of combat: --breeds 1 or --all."""
import argparse, gzip, hashlib, json, shutil, tempfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from extractor.entities.export_bone import export_animated_bundle
from extractor.unity_loader import DEFAULT_CLIENT, content_root

def table(output, name):
 p=output/'data'/(name+'.json');return json.loads(p.read_bytes() if p.exists() else gzip.decompress(p.with_suffix('.json.gz').read_bytes()))
def write(output, relative, doc):
 p=output/(relative+'.gz');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(gzip.compress(json.dumps(doc,separators=(',',':')).encode(),compresslevel=6,mtime=0))
def prepare(bundle, output, name, object_id):
 digest=hashlib.sha256(bundle.read_bytes()).hexdigest();relative='entities/'+name+'.json'
 with tempfile.TemporaryDirectory(dir=output) as tmp:
  p=export_animated_bundle(bundle,Path(tmp),object_id,name+'.json',scale=1,animation_filter={'*'},default_idle_walk=False,native=True,customisable=name.startswith('combat_'))
  doc=json.loads(p.read_bytes())
  for texture in (Path(tmp)/'textures').iterdir():shutil.copy2(texture,output/'textures'/texture.name)
  files={};animations={}
  for key,clip in doc['animations'].items():
   # Keep authored mesh transforms/colors; non-drawing skeleton nodes need no rendering.
   clip['frames']=[[n for n in f if n.get('part_ref') is not None and n.get('drawable') is not False and n.get('visible') is not False] for f in clip['frames']]
   if not any(clip['frames']):continue
   clip['frame_rate']=doc['frame_rate'];clip_path=f'entities/spell-clips/{name}/{key}.json'
   write(output,clip_path,clip);files[key]=clip_path;animations[key]={k:v for k,v in clip.items() if k!='frames'}|{'frames':[]}
  if not animations:raise ValueError('No drawable official clips')
  doc['animations']=animations;doc['animation_files']=files;write(output,relative,doc)
 return {'path':relative,'sha256':digest,'bundle':bundle.name,'clips':len(animations),'decoder':'native-v4'}
def main():
 p=argparse.ArgumentParser();p.add_argument('--breeds',default='1');p.add_argument('--all',action='store_true');p.add_argument('--spells',default='');p.add_argument('--workers',type=int,choices=range(1,9),default=1);args=p.parse_args()
 output=Path('output');(output/'textures').mkdir(parents=True,exist_ok=True)
 bones=content_root(DEFAULT_CLIENT)/'Characters/Bones';spells=table(output,'spells');scripts=table(output,'spellscripts');breeds=table(output,'breeds')
 chosen=list(breeds) if args.all or args.breeds=='all' else args.breeds.split(',')
 spell_ids=set(spells) if args.all else {str(s) for b in chosen for s in breeds[b]['breedSpellsId']};spell_ids.update(filter(None,args.spells.split(',')));gfx=set()
 for sid in spell_ids:
  definition=spells.get(sid,{})
  for usage in definition.get('boundScriptUsageData',[])+definition.get('criticalHitBoundScriptUsageData',[]):
   script=scripts.get(str(usage['scriptId']),{});raw=script.get('rawParams','')
   if script.get('type')==9:
    try:sequences=json.loads(raw).get('main',{}).get('sequences',[])
    except ValueError:continue
    gfx.update(int(g['gfxId']) for seq in sequences for g in seq.get('gfxs',[]) if g.get('gfxId'))
   else:
    for part in raw.split(','):
     key,_,value=part.partition(':')
     if 'GfxId' in key and value.isdigit():gfx.add(int(value))
 manifest_path=output/'entities/combat-assets.json';manifest=json.loads(manifest_path.read_bytes()) if manifest_path.exists() else {'format':1,'classes':{},'gfx':{},'unavailable':{}}
 index=table(output,'boneindex')['1']
 jobs=[('classes',int(b),bones/f"bones_assets_bone_{next(v for k,v in index.get(b,{}).items() if k.startswith('AnimAttaque'))}.bundle",f'combat_class_{b}') for b in chosen if any(k.startswith('AnimAttaque') for k in index.get(b,{}))]
 jobs.insert(0, ('classes',0,bones/'bones_assets_bone_1-combat.bundle','combat_shared'))
 jobs += [('gfx',i,bones/f'bones_assets_bone_{i}.bundle',f'spell_gfx_{i}') for i in sorted(gfx)]
 pending=[]
 for kind,id,bundle,name in jobs:
  entry=manifest[kind].get(str(id))
  if entry and entry.get('decoder')=='native-v4' and (output/(entry['path']+'.gz')).exists():continue
  pending.append((kind,id,bundle,name))
 # Workers export distinct bundles/clips. Only the parent writes the shared
 # manifest, atomically, so an open client never reads a partially written JSON.
 def save_manifest():
  temporary=manifest_path.with_suffix('.json.tmp')
  temporary.write_text(json.dumps(manifest,indent=2));temporary.replace(manifest_path)
 with ProcessPoolExecutor(max_workers=args.workers) as pool:
  futures={pool.submit(prepare,bundle,output,name,1 if kind=='classes' else id):(kind,id) for kind,id,bundle,name in pending}
  for future in as_completed(futures):
   kind,id=futures[future];key=str(id)
   try:
    manifest[kind][key]=future.result()
    manifest['unavailable'].pop(f'{kind}/{id}',None)
    print(kind,id,manifest[kind][key]['clips'],flush=True)
   except (FileNotFoundError,RuntimeError,ValueError) as e:manifest['unavailable'][f'{kind}/{id}']=str(e);print('Unavailable',kind,id,str(e),flush=True)
   save_manifest()
 # Preserve the composed look's skin priority and leaf selection for dynamic cast slots.
 manifest['looks']={}
 paths={p.name.removesuffix('.gz'):p for p in (output/'entities').glob('look_1_*.json.gz')}
 paths.update({p.name:p for p in (output/'entities').glob('look_1_*.json')})
 for filename,path in paths.items():
  doc=json.loads(gzip.decompress(path.read_bytes()) if path.suffix=='.gz' else path.read_bytes())
  bindings={}
  for animation in doc.get('animations',{}).values():
   for frame in animation.get('frames',[]):
    for node in frame:
     slot=node.get('slot_name');ref=node.get('part_ref')
     if not slot or not ref:continue
     leaves=node.get('visible_leaf_indices') if node.get('visible') is not False else []
     current=bindings.get(slot)
     if current is None or len(leaves or [])>len(current.get('leaves') or []):bindings[slot]={'part':ref,'leaves':leaves}
  if bindings:
   relative='entities/spell-clips/bindings/'+filename
   write(output,relative,bindings);manifest['looks']['entities/'+filename]=relative
 save_manifest()
 print('Prepared' ,len(manifest['classes']),'classes and',len(manifest['gfx']),'official FX',flush=True)
if __name__=='__main__':main()

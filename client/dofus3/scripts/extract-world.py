#!/usr/bin/env python3
"""Resume local whole-world export. No game installation files are modified."""
import argparse, gc, gzip, json, os, shutil, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from extractor.unity_loader import content_root, load_bundle, client_version
from extractor.maps.export_map import _index_bundle_maps, _mean_luminance, build_map_document
from extractor.entities.export_bone import export_animated_bundle

def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp=path.with_suffix(path.suffix+'.tmp'); tmp.write_bytes(value); os.replace(tmp,path)
def save(path, value): atomic(path,json.dumps(value,separators=(',',':')).encode())
def read(path, default=None):
    return json.loads(path.read_bytes()) if path.exists() else default
def space(root):
    if shutil.disk_usage(root).free < 4*1024**3: raise RuntimeError('Disk reserve reached: less than 4 GiB free; resume after freeing space')
def signature(p): return [p.stat().st_size,p.stat().st_mtime_ns]
def run(args):
    target=args.output; target.mkdir(parents=True,exist_ok=True)
    lock=target/'.extract.lock'
    try: lock.mkdir()
    except FileExistsError: raise RuntimeError('Extraction lock exists. Verify no extractor is running before removing '+str(lock))
    save(lock/'owner.json',{'pid':os.getpid(),'started':time.time()})
    try:
        root=content_root(args.client); state=read(target/'extraction-state.json',{'bundles':{},'errors':{},'format':'giny.world-extraction.v1'})
        state['client_version']=client_version(args.client)
        state['client_root']=str(args.client.resolve())
        def checkpoint(): save(target/'extraction-state.json',state)
        def progress(phase,name,**stats):
            state['progress']={'phase':phase,'item':name,**stats,'at':time.time()};checkpoint();print(json.dumps(state['progress']),flush=True)
        if args.phase in ('all','inventory'):
            registry=target/'data/map-elements.json.gz'
            if not registry.exists():
                from extractor.unity_loader import iter_monobehaviours
                for _,tree in iter_monobehaviours(load_bundle(root/'Map/Data/mapelements_assets_.bundle')):
                    if 'm_elementsMap' in tree: atomic(registry,gzip.compress(json.dumps(tree,separators=(',',':')).encode(),mtime=0))
            index=read(target/'maps/_bundle_index.json',{})
            for i,bundle in enumerate(sorted((root/'Map/Data').glob('*.bundle'))):
                space(target); key='inventory/'+bundle.name
                if state['bundles'].get(key)==signature(bundle): continue
                try:
                    names,trees=_index_bundle_maps(bundle)
                    for mid in names:
                        if mid in index and index[mid]!=bundle.name: raise ValueError('Duplicate map '+mid)
                    index.update(names); save(target/'maps/_bundle_index.json',index)
                    state['bundles'][key]=signature(bundle);state['errors'].pop(key,None)
                    del trees;gc.collect()
                except Exception as e: state['errors'][key]=str(e)
                progress('inventory',bundle.name,bundles=i+1,maps=len(index))
            save(target/'inventory.json',{'version':state['client_version'],'maps':index,'map_count':len(index),'source_bundles':len(list((root/'Map/Data').glob('*.bundle')))})
        if args.phase in ('all','gfx'):
            catalog=read(target/'gfx/_catalog.json',{})
            for i,bundle in enumerate(sorted((root/'Map/Textures/1x').glob('*.bundle')) + sorted((root/'Map/Textures/Effects').glob('*.bundle'))):
                space(target);key='gfx/'+bundle.name
                if state['bundles'].get(key)==signature(bundle): continue
                try:
                    env=load_bundle(bundle)
                    for obj in env.objects:
                        if obj.type.name!='Sprite': continue
                        spr=obj.read()
                        if not spr.m_Name.isdigit(): continue
                        gid=spr.m_Name;dest=target/f'gfx/{gid}.png'
                        image=spr.image
                        # This bundle's signature changed: an existing ID may have new pixels.
                        dest.parent.mkdir(parents=True,exist_ok=True);tmp=dest.with_suffix('.tmp');image.save(tmp,format='PNG');os.replace(tmp,dest)
                        rect=spr.m_Rect
                        catalog[gid]={'id':int(gid),'texture':f'gfx/{gid}.png','width':float(rect.width),'height':float(rect.height),
                            'pivot':[float(spr.m_Pivot.x),float(spr.m_Pivot.y)],'offset':[float(spr.m_Offset.x),float(spr.m_Offset.y)],
                            'pixels_per_unit':float(spr.m_PixelsToUnits),'luminance':round(_mean_luminance(image),2)}
                    save(target/'gfx/_catalog.json',catalog); state['bundles'][key]=signature(bundle);state['errors'].pop(key,None)
                    del env;gc.collect()
                except Exception as e: state['errors'][key]=str(e)
                progress('gfx',bundle.name,bundles=i+1,sprites=len(catalog))
        if args.phase in ('all','maps'):
            catalog={int(k):v for k,v in read(target/'gfx/_catalog.json',{}).items()}
            if not catalog: raise RuntimeError('Run gfx phase first')
            registry=target/'data/map-elements.json.gz'
            if not registry.exists():
                from extractor.unity_loader import iter_monobehaviours
                for _,tree in iter_monobehaviours(load_bundle(root/'Map/Data/mapelements_assets_.bundle')):
                    if 'm_elementsMap' in tree: atomic(registry,gzip.compress(json.dumps(tree,separators=(',',':')).encode(),mtime=0))
            index=read(target/'maps/_bundle_index.json',{}); report=read(target/'maps-report.json',{})
            for i,name in enumerate(sorted(set(index.values()))):
                space(target);bundle=root/'Map/Data'/name;key='maps/'+name
                # Geometry also depends on the current sprite metadata (pivots, dimensions).
                map_signature = signature(bundle) + signature(target/'gfx/_catalog.json')
                if state['bundles'].get(key)==map_signature: continue
                try:
                    _,trees=_index_bundle_maps(bundle)
                    for mid,tree in trees.items():
                        try:
                            doc=build_map_document(args.client,int(mid),target,source=(bundle,tree),sprite_catalog=catalog)
                            atomic(target/f'maps/{mid}.json.gz',gzip.compress(json.dumps(doc,separators=(',',':')).encode(),compresslevel=6,mtime=0))
                            report[mid]={'missing_gfx':doc['missing_gfx'],'props':sorted({p['prop_id'] for p in doc['props'] if not p['static']}),'elements':len(doc['elements'])}
                            state['errors'].pop('map/'+mid,None)
                        except Exception as e:state['errors']['map/'+mid]=str(e)
                    save(target/'maps-report.json',report)
                    if not any('map/'+mid in state['errors'] for mid in trees): state['bundles'][key]=map_signature
                    state['errors'].pop(key,None)
                    del trees;gc.collect()
                except Exception as e:state['errors'][key]=str(e)
                progress('maps',name,bundles=i+1,maps=len(report),total=len(index))
        if args.phase in ('all','props'):
            ids=sorted({pid for r in read(target/'maps-report.json',{}).values() for pid in r['props']} | {int(p.stem.rsplit('_',1)[1]) for p in (root/'Animations/Props').glob('props_assets_prop_*.bundle')})
            for i,pid in enumerate(ids):
                space(target);bundle=root/f'Animations/Props/props_assets_prop_{pid}.bundle';key='prop/'+str(pid)
                if bundle.exists() and state['bundles'].get(key)==signature(bundle):continue
                try:
                    dest=export_animated_bundle(bundle,target,pid,dest_name=f'prop_{pid}.json',scale=1.0,animation_filter={'*'},default_idle_walk=False,extra_fields={'prop_id':pid})
                    atomic(dest.with_suffix('.json.gz'),gzip.compress(dest.read_bytes(),compresslevel=6,mtime=0));dest.unlink()
                    state['bundles'][key]=signature(bundle);state['errors'].pop(key,None);gc.collect()
                except Exception as e:
                    state['errors'][key]=str(e)
                    if bundle.exists():
                        # Preserve source bytes for particle/effect bundles that
                        # have no Animator2D representation in the current renderer.
                        retained=target/'unsupported/props'/bundle.name
                        retained.parent.mkdir(parents=True,exist_ok=True)
                        if not retained.exists():shutil.copy2(bundle,retained)
                progress('props',str(pid),done=i+1,total=len(ids))
        progress('finished',args.phase,errors=len(state['errors']))
    finally:
        (lock/'owner.json').unlink(missing_ok=True);lock.rmdir()

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--client',type=Path,default=Path('/Applications/Ankama/Dofus-dofus3'))
    p.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'.cache/dofus3/world')
    p.add_argument('--phase',choices=['all','inventory','gfx','maps','props'],default='all');run(p.parse_args())

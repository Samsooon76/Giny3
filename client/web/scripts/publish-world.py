#!/usr/bin/env python3
"""Assemble a self-contained, indexed game-data directory from local exports."""
import argparse, gzip, hashlib, importlib.util, json, os, shutil, time
from pathlib import Path
spec=importlib.util.spec_from_file_location('assets',Path(__file__).with_name('prepare-assets.py'))
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
status_spec=importlib.util.spec_from_file_location('effects_release',Path(__file__).with_name('verify-world-effects.py'))
effects_release=importlib.util.module_from_spec(status_spec);status_spec.loader.exec_module(effects_release)
BASE=Path(__file__).resolve().parents[2]/'dofus3'
WORLD=BASE/'.cache/dofus3/world'; RUNTIME=BASE/'.cache/dofus3/runtime'; OLD=BASE/'output'
ROOTS=[WORLD,RUNTIME,OLD]

def main(args):
    destination=args.output.resolve();target=destination.with_name(destination.name+'.staging')
    if destination.exists(): raise RuntimeError('Destination already exists; use --output for another release')
    target.mkdir(parents=True,exist_ok=True)
    linked=set(); missing=[]
    def include(relative,roots=ROOTS):
        if relative in linked:return
        if Path(relative).is_absolute() or '..' in Path(relative).parts:raise ValueError(relative)
        source=a.source_file(roots,relative)
        if not source:missing.append(relative);return
        actual=relative+('.gz' if source.suffix=='.gz' and not relative.endswith('.gz') else '')
        dest=target/actual;dest.parent.mkdir(parents=True,exist_ok=True)
        if not dest.exists():
            try:os.link(source,dest)
            except OSError:shutil.copy2(source,dest)
        linked.add(relative)
    inventory=json.loads((WORLD/'inventory.json').read_bytes())
    reports=json.loads((WORLD/'maps-report.json').read_bytes())
    variants=json.loads((WORLD/'texture-variants.json').read_bytes())
    catalog=json.loads((WORLD/'gfx/_catalog.json').read_bytes())
    if set(catalog)-set(variants):raise RuntimeError('Texture preparation is still incomplete')
    atlas_root = RUNTIME
    old_manifest=json.loads((atlas_root/'optimized/manifest.json').read_bytes())
    manifest={'format':'giny.prepared.v1','maps':{},'pages':[]}
    gaps={};drawable_gaps={};atlas_reused=0;referenced_props=set()
    for i,mid in enumerate(sorted(inventory['maps'],key=int)):
        p=WORLD/f'maps/{mid}.json.gz'
        if not p.exists():missing.append(f'maps/{mid}.json');continue
        doc=a.read_doc(p);raw_doc=doc
        referenced_props.update(prop['prop_id'] for prop in doc.get('props',[]) if not prop.get('static'))
        if len(doc['cells'])!=560 or doc['format']!='giny.dofus3.map.v3':raise ValueError('Invalid map '+mid)
        old_entry=old_manifest['maps'].get(mid)
        old=a.read_doc(a.source_file([atlas_root],old_entry['path'])) if old_entry else None
        # Preserve fresh cells/materials/props; atlas reuse concerns only pixels.
        original_textures={gid:gfx['texture'] for gid,gfx in doc['gfx'].items()}
        if old and a.reuse_atlas_frames(doc,old,WORLD,atlas_root):atlas_reused+=1
        for gid,gfx in doc['gfx'].items():
            if gfx['texture'] != original_textures[gid]:continue
            variant=variants.get(gid,{})
            if variant.get('bc7_texture'):gfx.update({k:variant[k] for k in ('bc7_texture','frame')})
        for gfx in doc['gfx'].values():
            include(gfx['texture'])
            if gfx.get('bc7_texture'):include(gfx['bc7_texture'])
        # Directory copying only finds existing files; the document is the
        # authority for dependencies which must also be reported when absent.
        for dependency in doc.get('effect_dependencies') or []:
            if dependency.get('path'):include(dependency['path'])
        raw=a.compact(doc);digest=hashlib.sha256(raw).hexdigest();relative=f'optimized/maps/{mid}-{digest}.json'
        a.atomic(target/(relative+'.gz'),gzip.compress(raw,compresslevel=6,mtime=0))
        # Keep original, fresh v3 paths for old consumers and availability probes.
        include(f'maps/{mid}.json',[WORLD])
        manifest['maps'][mid]={'path':relative,'hash':digest}
        if reports[mid]['missing_gfx']:gaps[mid]={'missing_gfx':reports[mid]['missing_gfx']}
        missing_drawable=[gid for gid in a.eligible(raw_doc) if gid not in raw_doc['gfx']]
        if missing_drawable:drawable_gaps[mid]=missing_drawable
        if i%500==0:print(json.dumps({'maps':i+1,'total':len(inventory['maps'])}),flush=True)
    # Particle states are optional for legacy exports, but advertised files must all exist.
    particle_manifest_path=WORLD/'optimized/particle-starts-manifest.json'
    if particle_manifest_path.exists():
        particle_manifest=json.loads(particle_manifest_path.read_bytes())
        if particle_manifest.get('format') != 'giny.particle-starts.v1':
            raise ValueError('Invalid particle startup manifest')
        particle_manifest['maps']={mid:entry for mid,entry in particle_manifest['maps'].items() if mid in manifest['maps']}
        for entry in particle_manifest['maps'].values():
            for relative in entry['variants'].values():include(relative,[WORLD])
        a.atomic(target/'optimized/particle-starts-manifest.json',a.compact(particle_manifest))
        manifest['particleStartsManifest']='optimized/particle-starts-manifest.json'
    # Merge pre-existing player/portrait clips with every staged map prop.
    entities={'format':'giny.entity-clips.v1','entities':{},'previews':{}}
    for root in (RUNTIME,WORLD):
        part=json.loads((root/'optimized/entities-manifest.json').read_bytes())
        for kind in ('entities','previews'):entities[kind].update(part.get(kind,{}))
    for relative in set(entities['entities'].values())|set(entities['previews'].values()):
        include(relative);source=a.source_file(ROOTS,relative)
        if not source:continue
        doc=a.read_doc(source)
        for clip in doc.get('animation_files',{}).values():include(clip)
        if doc.get('texture'):include(doc['texture'])
        for part in doc.get('parts',{}).values():
            for leaf in part.get('leaves',part.get('chunks',[])):
                if leaf.get('texture'):include(leaf['texture'])
    # Prop fallback aliases are useful for older local consumers.
    for p in (WORLD/'entities').glob('prop_*.json.gz'):
        include('entities/'+p.name.removesuffix('.gz'))
        raw=a.read_doc(p)
        if raw.get('texture'):include(raw['texture'])
    absent_props=sorted(pid for pid in referenced_props | {pid for r in reports.values() for pid in r['props']} if f'entities/prop_{pid}.json' not in entities['entities'])
    unsupported=json.loads((WORLD/'unsupported-props.json').read_bytes())
    entities['unavailable']={f'entities/prop_{pid}.json':'source_missing_or_unsupported_animation' for pid in set(absent_props)|set(unsupported) if f'entities/prop_{pid}.json' not in entities['entities']}
    # Supporting catalogs/pictograms already used by the client, without audit dumps.
    for directory in ('data','pictos','worldmaps','effects','client/world'):
        for root in (WORLD,RUNTIME,OLD):
            for p in (root/directory).rglob('*'):
                if p.is_file():include(p.relative_to(root).as_posix())
    for p in (WORLD/'unsupported').rglob('*'):
        if p.is_file():include(p.relative_to(WORLD).as_posix())
    for relative in ('inventory.json','unsupported-props.json','effects-coverage.json','effects-test-maps.json','effects/catalog.json','effects/qualified-catalog.json'):
        if a.source_file(ROOTS, relative):include(relative)
    incomplete_props={mid:r['props'] for mid,r in reports.items() if any(pid in absent_props for pid in r['props'])}
    coverage=None
    coverage_path=WORLD/'effects-coverage.json'
    if coverage_path.exists():coverage=json.loads(coverage_path.read_bytes())
    effects_status=effects_release.effect_readiness(coverage,len(inventory['maps']),
        not missing and len(manifest['maps'])==len(inventory['maps']) and not drawable_gaps and not incomplete_props)
    report={'format':'giny.world-release.v1','source_version':inventory['version'],'maps':len(manifest['maps']),
            **effects_status,'effects_version':(coverage or {}).get('effects_version'),
            'expected_maps':len(inventory['maps']),'entities':len(entities['entities']),'atlas_maps_reused':atlas_reused,
            'files_linked':len(linked),'missing_files':sorted(set(missing)),'maps_with_source_gaps':gaps,'absent_props':absent_props,'missing_drawable_gfx':drawable_gaps,'maps_with_unavailable_props':incomplete_props,'unsupported_animation_props':unsupported,
            'maps_ready_for_supported_renderer':len(manifest['maps'])-len(set(drawable_gaps)|set(incomplete_props))}
    manifest['revision']=hashlib.sha256(a.compact(manifest)).hexdigest()
    report['manifest_revision'] = manifest['revision']
    report['entities_manifest_hash'] = hashlib.sha256(a.compact(entities)).hexdigest()
    a.atomic(target/'release-report.json',json.dumps(report,indent=2).encode())
    if missing or len(manifest['maps'])!=len(inventory['maps']):raise RuntimeError('Release incomplete; inspect '+str(target/'release-report.json'))
    a.atomic(target/'optimized/entities-manifest.json',a.compact(entities))
    a.atomic(target/'optimized/manifest.json',a.compact(manifest))
    # Publish only after the complete file dependency closure has been checked.
    target.rename(destination)
    print(json.dumps({k:v for k,v in report.items() if k not in ('maps_with_source_gaps','missing_files','missing_drawable_gfx','maps_with_unavailable_props','unsupported_animation_props')}),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'game-data');main(p.parse_args())

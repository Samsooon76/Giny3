"""Read-only evidence collection for the local client fidelity audit.

Run from client/dofus3: python3 -m extractor.audit_client MODE --dest DIRECTORY.
Only writes reports under --dest; never invokes the production exporters.
The filesystem inventory is exhaustive. Object inspection scope is explicit
in each report; animation decoding uses a deterministic, bounded sample.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path

from extractor.unity_loader import DEFAULT_CLIENT, client_version, content_root, load_bundle, player_data_root


def read_json(path):
    with gzip.open(path, 'rt') if path.suffix == '.gz' else path.open() as stream:
        return json.load(stream)


def shape(value, depth=2):
    if isinstance(value, dict):
        return {str(k): '[redacted]' if 'encryptionkey' in str(k).lower() else shape(v, depth-1) for k, v in value.items()} if depth else {'keys': list(value)}
    if isinstance(value, list):
        return {'length': len(value), 'sample': [shape(v, depth-1) for v in value[:2]]} if depth else {'length': len(value)}
    if isinstance(value, (bytes, bytearray)):
        return {'bytes': len(value)}
    return value[:240] if isinstance(value, str) else value


def inventory(client, output):
    files = []
    for p in sorted(client.rglob('*')):
        if p.is_file():
            files.append({'path': str(p.relative_to(client)), 'bytes': p.stat().st_size})
    outputs = {}
    for base in (output, output.parent / '.cache/dofus3/ui/current'):
        groups = {}
        for p in sorted(base.rglob('*')):
            if not p.is_file():
                continue
            group = p.relative_to(base).parts[0]
            record = groups.setdefault(group, {'files': 0, 'bytes': 0})
            record['files'] += 1
            record['bytes'] += p.stat().st_size
        outputs[str(base)] = groups
    return {'scope': 'All regular files in the installed client; output directory counts', 'files': files, 'outputs': outputs}


def core(client, output):
    data = player_data_root(client)
    paths = sorted((data / 'StreamingAssets/aa/StandaloneOSX').glob('*.bundle'))
    paths += [data / name for name in ('globalgamemanagers', 'globalgamemanagers.assets', 'resources.assets', 'sharedassets0.assets', 'level0') if (data/name).exists()]
    paths += sorted((content_root(client)/'Map').rglob('*effects*.bundle'))
    paths += sorted((content_root(client)/'Map/Data').glob('*.bundle'))
    paths = [p for p in paths if not p.name.startswith('mapdata_assets_world_')]
    reports = []
    for path in paths:
        report = {'path': str(path.relative_to(client)), 'objects': {}, 'assets': [], 'errors': []}
        try:
            env = load_bundle(path)
            report['objects'] = dict(Counter(o.type.name for o in env.objects))
            for obj in env.objects:
                if 'certificates' in path.name:
                    continue
                if obj.type.name not in ('MonoBehaviour', 'Shader', 'Material', 'AnimationClip', 'Texture2D', 'Font', 'TextAsset', 'SpriteAtlas'):
                    continue
                try:
                    tree = obj.read_typetree()
                    asset = {'path_id': obj.path_id, 'type': obj.type.name, 'name': tree.get('m_Name', ''), 'keys': list(tree)}
                    if obj.type.name == 'MonoBehaviour':
                        refs = (tree.get('references') or {}).get('RefIds') or []
                        asset['ref_types'] = dict(Counter(str(r.get('type')) for r in refs))
                        if not any(k in tree for k in ('m_VisualElementAssets', 'rules', 'm_GlyphTable', 'm_CharacterTable')):
                            asset['sample'] = shape(tree, 3)
                    elif obj.type.name == 'Material':
                        asset['sample'] = shape(tree, 4)
                    elif obj.type.name == 'Shader':
                        asset['parsed_form'] = shape(tree.get('m_ParsedForm'), 3)
                    elif obj.type.name == 'Texture2D':
                        asset['settings'] = {k: tree.get(k) for k in ('m_Width','m_Height','m_TextureFormat','m_MipCount','m_TextureSettings','m_ColorSpace')}
                    elif obj.type.name == 'Font':
                        asset['font_bytes'] = len(tree.get('m_FontData') or [])
                    report['assets'].append(asset)
                except Exception as exc:
                    report['errors'].append({'path_id': obj.path_id, 'type': obj.type.name, 'error': str(exc)[:250]})
        except Exception as exc:
            report['error'] = str(exc)
        reports.append(report)
        print(path.name, report['objects'], flush=True)
    return {'scope': 'All 25 standalone bundles, selected player files, all non-world Map/Data and map effects bundles; schema only, no image/audio export', 'bundles': reports}


def maps(client, output):
    counts = Counter(); fields = Counter(); nonempty = Counter(); refs = Counter(); shaders = {}; examples = {}; map_index = {}; errors = []
    bundles = sorted((content_root(client)/'Map/Data').glob('mapdata_assets_world_*.bundle'))
    for bi, path in enumerate(bundles):
        try:
            env = load_bundle(path)
            counts['bundles'] += 1
            for obj in env.objects:
                if obj.type.name != 'MonoBehaviour':
                    continue
                tree = obj.read_typetree(); md = tree.get('mapData')
                if not isinstance(md, dict):
                    continue
                counts['maps'] += 1
                map_id = tree.get('m_Name', '').removeprefix('map_'); map_index[map_id] = path.name
                for k,v in md.items():
                    fields[k] += 1
                    if v:
                        nonempty[k] += 1
                    if isinstance(v, list):
                        counts[k+'_entries'] += len(v)
                    if k not in examples and v:
                        examples[k] = {'map': map_id, 'value': shape(v, 3)}
                for ref in (tree.get('references') or {}).get('RefIds') or []:
                    typ = (ref.get('type') or {}).get('class', '')
                    refs[typ] += 1
                    if typ not in shaders:
                        shaders[typ] = {'map': map_id, 'data': shape(ref.get('data'), 4)}
        except Exception as exc:
            errors.append({'bundle': path.name, 'error': str(exc)})
        if bi % 40 == 0:
            print('map bundles', bi+1, '/', len(bundles), 'maps', counts['maps'], flush=True)
    cache_counts=Counter(); cache_examples={}; cached_ids=set()
    candidates = sorted((output/'maps').glob('*.json*'))
    # Match the serving priority: plain JSON shadows gzip for the same map id.
    documents = {p.name.removesuffix('.gz').removesuffix('.json'): p for p in sorted(candidates, key=lambda p: p.suffix == '.json') if p.name.split('.')[0].isdigit()}
    for ident,p in documents.items():
        doc=read_json(p); cached_ids.add(ident)
        cache_counts['maps'] += 1; cache_counts['format:'+str(doc.get('format','absent'))] += 1
        for e in doc.get('elements',[]):
            for k in ('layer','blend','shader'):
                cache_counts[k+':'+str(e.get(k,'absent'))] += 1
            if str(e.get('gfx_id')) not in doc.get('gfx_catalog',{}):
                cache_counts['elements_without_gfx_catalog_entry'] += 1
            if e.get('uniforms'):
                cache_counts['elements_with_uniforms'] += 1
        for k in ('props','neighbours','background_color_u32'):
            if k not in doc:
                cache_counts['missing:'+k] += 1
                cache_examples.setdefault('missing:'+k,ident)
    return {'scope':'All installed world map bundles and all cached numeric maps (plain JSON takes precedence)', 'counts':counts,'fields':fields,'nonempty_fields':nonempty,'ref_types':refs,'type_examples':shaders,'field_examples':examples,'map_index':map_index,'errors':errors,'cache_counts':cache_counts,'cache_examples':cache_examples,'uncached_maps':len(set(map_index)-cached_ids)}


def ui(client, output):
    from extractor.ui.integrity import audit_cache
    from extractor.ui.catalog import catalog_fingerprint
    root=output.parent/'.cache/dofus3/ui/current';manifest=read_json(root/'manifest.json')
    report=audit_cache(root,manifest)
    report['manifest_summary']={k:shape(v,1) for k,v in manifest.items() if k not in ('trees','styles','tokens','sprites')}
    report['current_fingerprint']=catalog_fingerprint(client)
    types=Counter(); full_types=Counter(); props=Counter(); properties=Counter()
    def walk(node):
        types[str(node.get('type'))]+=1;full_types[str(node.get('full_type'))]+=1
        properties.update((node.get('properties') or {}).keys())
        for s in [node.get('style') or {}, *(node.get('states') or {}).values()]:
            if isinstance(s,dict):props.update(s.keys())
        for ch in node.get('children') or []:walk(ch)
    for rel in manifest.get('trees',{}).values():walk(read_json(root/rel))
    report.update(types=types,full_types=full_types,style_properties=props,node_properties=properties)
    return report


def animations(client, output):
    from extractor.animations.decoder import decode_animation
    from extractor.entities.export_bone import _as_bytes
    paths=[]
    for directory,pattern in [('Characters/Bones','bones_assets_bone_*.bundle'),('Characters/Skins','skins_assets_skin_*.bundle'),('Animations/Props','props_assets_prop_*.bundle')]:
        all_paths=sorted((content_root(client)/directory).glob(pattern))
        sample=[p for p in all_paths if p.stem.rsplit('_',1)[-1] in {'1','10','563','2012'}]
        sample += sorted(all_paths,key=lambda p:hashlib.sha256(p.name.encode()).digest())[:20]
        sample += sorted(all_paths,key=lambda p:p.stat().st_size,reverse=True)[:3]
        paths+=sorted(set(sample))
    reports=[]
    for p in paths:
        report={'bundle':str(p.relative_to(client)),'animations':[],'skin_assets':[]}
        try:
            env=load_bundle(p)
            for obj in env.objects:
                if obj.type.name!='MonoBehaviour':continue
                tree=obj.read_typetree()
                if 'animations' in tree and 'graphics' in tree:
                    report['aod']=shape({k:v for k,v in tree.items() if k not in ('animations','graphics')},3)
                    for anim in tree['animations']:
                        record={'name':anim['name'],'source_keys':list(anim),'bytes':len(anim.get('dataBytes') or [])}
                        try:
                            decoded=decode_animation(_as_bytes(anim.get('dataBytes')),anim['name'])
                            record.update(frames=decoded.frame_count,records=decoded.record_count,flags=decoded.format_flags,events=[{'frame':e.frame,'text':e.text} for e in decoded.events])
                        except Exception as exc:record['error']=str(exc)
                        report['animations'].append(record)
                if 'vertices' in tree and 'm_values' in tree:
                    masks=Counter();tx=Counter()
                    for part in tree.get('m_values') or []:
                        for ch in part.get('skinChunks') or []:
                            masks[str(ch.get('maskState'))]+=1;tx[str(ch.get('textureIndex'))]+=1
                    verts=tree.get('vertices') or []
                    report['skin_assets'].append({'name':tree.get('m_Name'),'keys':list(tree),'textures':len(tree.get('textures') or []),'mask_states':masks,'texture_indices':tx,'vertex_multipliers':dict(Counter(str(v.get('multiplicativeColor')) for v in verts).most_common(12)),'vertex_additives':dict(Counter(str(v.get('additiveColor')) for v in verts).most_common(12))})
        except Exception as exc:report['error']=str(exc)
        reports.append(report)
        print(p.name,len(report['animations']),'clips',sum('error' in a for a in report['animations']),'errors',flush=True)
    return {'scope':'Per family: 20 SHA256-name-selected bundles + 3 largest + available ids 1,10,563,2012. All clips decoded in these bundles; not a population estimate.','bundles':reports}


def pictos(client, output):
    index=read_json(output/'pictos/index.json.gz')
    indexed={v['bundle']:k for k,v in index['kinds'].items()}
    reports=[]
    for p in sorted((content_root(client)/'Picto').rglob('*.bundle')):
        report={'bundle':str(p.relative_to(client)), 'indexed_kind':indexed.get(p.name)}
        try:
            env=load_bundle(p)
            report['objects']=dict(Counter(o.type.name for o in env.objects))
            names=[];sizes=Counter();filters=Counter()
            for obj in env.objects:
                if obj.type.name=='Sprite':
                    spr=obj.read();names.append(spr.m_Name)
                    sizes[str((spr.m_Rect.width,spr.m_Rect.height))]+=1
                elif obj.type.name=='Texture2D':
                    tree=obj.read_typetree()
                    filters[str(tree.get('m_TextureSettings'))]+=1
            report.update(unique_sprite_names=len(set(names)),size_distribution=sizes,texture_settings=filters,sample_names=names[:12])
            kind=report['indexed_kind']
            if kind:
                exported=index['kinds'][kind]['sprites']
                report['source_names_not_indexed']=sorted(set(names)-set(exported))
                report['indexed_names_absent_from_source']=sorted(set(exported)-set(names))
        except Exception as exc:report['error']=str(exc)
        reports.append(report)
        print(p.name,report.get('objects'),flush=True)
    return {'scope':'All local Picto bundles; sprite metadata, not image pixels. Index coverage excludes other caches such as client/spell-icons and worldmaps.','index_counts':{k:{'bundle':v['bundle'],'count':v['count']} for k,v in index['kinds'].items()},'bundles':reports}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode',choices=['inventory','core','maps','ui','animations','pictos'])
    parser.add_argument('--client',type=Path,default=DEFAULT_CLIENT)
    parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'output')
    parser.add_argument('--dest',type=Path,required=True)
    args=parser.parse_args()
    report=globals()[args.mode](args.client,args.output)
    report['client_version']=client_version(args.client)
    report['collected_at']=datetime.now(timezone.utc).isoformat()
    report['client_root']=str(args.client)
    args.dest.mkdir(parents=True,exist_ok=True)
    path=args.dest/(args.mode+'.json')
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2,default=str))
    print('Wrote',path,flush=True)


if __name__=='__main__':main()

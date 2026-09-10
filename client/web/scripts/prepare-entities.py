#!/usr/bin/env python3
"""Split locally exported looks/props into geometry metadata and immutable clips."""
import gc
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

spec = importlib.util.spec_from_file_location('prepare_assets', Path(__file__).with_name('prepare-assets.py'))
assets = importlib.util.module_from_spec(spec); spec.loader.exec_module(assets)
BASE = Path(__file__).resolve().parents[2] / 'dofus3'
ROOTS = [BASE / '.cache/dofus3/runtime', BASE / 'output']
TARGET = ROOTS[0]


def write_document(kind, doc):
    raw = assets.compact(doc); digest = hashlib.sha256(raw).hexdigest()
    relative = f'optimized/{kind}/{digest}.json'
    path = TARGET / (relative + '.gz')
    if not path.exists(): assets.atomic(path, gzip.compress(raw, compresslevel=6, mtime=0))
    return relative, len(raw)


def main():
    names = sorted({p.name.removesuffix('.gz') for root in ROOTS for pattern in ('look_*.json*', 'prop_*.json*') for p in (root / 'entities').glob(pattern)})
    if len(sys.argv) > 1: names = [s if s.endswith('.json') else s+'.json' for s in sys.argv[1:]]
    manifest = {'format': 'giny.entity-clips.v1', 'entities': {}, 'previews': {}}
    report = []
    for name in names:
        path = assets.source_file(ROOTS, 'entities/' + name)
        if not path: continue
        doc = assets.read_doc(path)
        if doc.get('format') != 'giny.dofus3.entity.v2': continue
        metadata = {k: v for k, v in doc.items() if k in ('format','bone_id','scale','look','frame_rate','parts','texture','default_animation_name','color_encoding')}
        metadata['animations'] = {}; metadata['animation_files'] = {}
        total = 0
        for key, animation in doc.get('animations', {}).items():
            frames = []
            for frame in animation.get('frames', []):
                nodes = []
                for node in frame:
                    ref = next((node[k] for k in ('part_ref', 'partRef', 'graphic') if node.get(k) is not None), None)
                    if ref is None or node.get('visible') is False or node.get('drawable') is False: continue
                    nodes.append({k:v for k,v in node.items() if k in ('slot','node','part_ref','partRef','graphic','transform','color','color_u32','colorU32','visible_leaf_indices','visibleLeafIndices','slot_name')})
                frames.append(nodes)
            if not any(frames): continue
            clip = {'name':key,'frame_count':len(frames),'frame_rate':animation.get('frame_rate',doc.get('frame_rate',25)),'frames':frames}
            relative, size = write_document('clips',clip); total += size
            metadata['animations'][key] = {**clip,'frames':[]}
            metadata['animation_files'][key] = relative
        if not metadata['animations']: continue
        relative, size = write_document('entities', metadata)
        manifest['entities']['entities/'+name] = relative
        if name == 'look_1_10_2012.json':
            # Portrait composition needs slot/skin metadata from the raw static
            # frame, but never all 88 animation documents.
            preview = {**metadata,'animation_files':{}}
            preview['animations'] = {k:v for k,v in doc['animations'].items() if k.startswith('AnimStatique')}
            manifest['previews']['entities/'+name] = write_document('previews',preview)[0]
        report.append({'entity':name,'metadata_bytes':size,'all_clips_bytes':total,'clips':len(metadata['animations'])})
        print(json.dumps(report[-1]),flush=True)
        del doc, metadata
        gc.collect()
    previous_path = TARGET/'optimized/entities-manifest.json'
    if len(sys.argv) > 1 and previous_path.exists():
        previous = json.loads(previous_path.read_bytes())
        if previous.get('format') == manifest['format']:
            if 'unavailable' in previous: manifest['unavailable'] = previous['unavailable']
            for kind in ('entities', 'previews'):
                manifest[kind] = {**previous[kind], **manifest[kind]}
    assets.atomic(previous_path,assets.compact(manifest))
    assets.atomic(TARGET/'optimized/entities-report.json',json.dumps(report,indent=2).encode())

if __name__ == '__main__': main()

#!/usr/bin/env python3
"""Restore omitted refraction gfx metadata from the existing local sprite catalog.
No extraction. Writes only changed immutable maps and publishes the manifest last.
"""
import gzip
import hashlib
import json
import os
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
WORLD = BASE / 'dofus3/.cache/dofus3/world'
TARGET = BASE / 'web/game-data'

def read(path):
    if not path.exists():
        path = Path(str(path) + '.gz')
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw)

def packed(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()

def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + '.repair.tmp')
    temp.write_bytes(data)
    os.replace(temp, path)

def main():
    catalog = read(WORLD / 'gfx/_catalog.json')
    manifest = read(TARGET / 'optimized/manifest.json')
    updated, missing = [], []
    instances = 0
    for mid, entry in manifest['maps'].items():
        doc = read(TARGET / entry['path'])
        changed = False
        for effect in doc.get('refraction', []):
            instances += 1
            gid = str(effect['gfx_id'])
            if gid in doc['gfx']:
                continue
            info = catalog.get(gid)
            if not info:
                missing.append({'map': mid, 'gfx': gid})
                continue
            rel = info['texture']
            if not (TARGET / rel).exists():
                if not (WORLD / rel).exists():
                    missing.append({'map': mid, 'gfx': gid, 'path': rel})
                    continue
                (TARGET / rel).parent.mkdir(parents=True, exist_ok=True)
                os.link(WORLD / rel, TARGET / rel)
            # Preserve the original PNG's dimensions/pivot. A cropped GPU
            # variant must not be combined with unadjusted original metadata.
            doc['gfx'][gid] = dict(info)
            changed = True
        if not changed:
            continue
        raw = packed(doc)
        digest = hashlib.sha256(raw).hexdigest()
        relative = f'optimized/maps/{mid}-{digest}.json'
        blob = gzip.compress(raw, compresslevel=6, mtime=0)
        atomic(TARGET / (relative + '.gz'), blob)
        atomic(TARGET / f'maps/{mid}.json.gz', blob)
        atomic(WORLD / f'maps/{mid}.json.gz', blob)
        manifest['maps'][mid] = {'path': relative, 'hash': digest}
        updated.append(int(mid))
    if updated:
        manifest.pop('revision', None)
        manifest['revision'] = hashlib.sha256(packed(manifest)).hexdigest()
        atomic(TARGET / 'optimized/manifest.json', packed(manifest))
    report = {'maps_checked': len(manifest['maps']), 'refraction_instances': instances,
              'maps_repaired': updated, 'missing': missing}
    atomic(TARGET / 'refraction-repair-report.json', packed(report))
    print(json.dumps({**report, 'maps_repaired': len(updated)}))
    if missing:
        raise SystemExit(1)

if __name__ == '__main__':
    main()

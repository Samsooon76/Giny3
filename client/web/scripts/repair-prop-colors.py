#!/usr/bin/env python3
"""Offline repair of exported prop colours; publish new immutable clips, manifest last.

The raw export retains per-node tags, alpha bytes and packed colours. Re-fold
these channels independently without touching geometry or reading Unity bundles.
Run from anywhere: python3 scripts/repair-prop-colors.py [--prop 660].
"""
import argparse
import gzip
import importlib.util
import json
import os
from pathlib import Path
import sys
import shutil
import struct

WEB = Path(__file__).resolve().parents[1]
EXTRACTOR = WEB.parent / 'dofus3'
sys.path.insert(0, str(EXTRACTOR))
from extractor.animations.decoder import prop_node_color, _parse_record

ENCODING = 'signed-rgba-flags-v2'


def repair(doc):
    if doc.get('color_encoding') == ENCODING:
        return False
    for animation in doc.get('animations', {}).values():
        states = {}
        for frame in animation.get('frames', []):
            for node in frame:
                slot = node['node']
                colors = node.get('color_u32')
                if 'payload_hex' in node:
                    # color_u32 in a snapshot may be inherited from an older
                    # record. Use only the colours actually present in this
                    # record's payload, exactly as a fresh export does.
                    record = struct.pack('<HBB', slot, node.get('tag', 0), node.get('extra', 0)) + bytes.fromhex(node['payload_hex'])
                    colors = _parse_record(record, 0).color_u32
                color = prop_node_color(states.get(slot), node.get('tag', 0),
                                        node.get('extra', 0), colors)
                states[slot] = color
                node['color'] = color
    doc['color_encoding'] = ENCODING
    return True


def sync_prepared_source(source, release, names, atomic, compact):
    """Keep staging consistent so a later publish cannot restore stale clips."""
    current = json.loads((release / 'optimized/entities-manifest.json').read_bytes())
    destination = source / 'optimized/entities-manifest.json'
    staged = json.loads(destination.read_bytes())
    for name in names:
        key = 'entities/' + name
        relative = current['entities'][key]
        metadata = json.loads(gzip.decompress((release / (relative + '.gz')).read_bytes()))
        for asset in [relative, *metadata.get('animation_files', {}).values()]:
            target = source / (asset + '.gz')
            if target.exists():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            try:
                os.link(release / (asset + '.gz'), target)
            except OSError:
                shutil.copy2(release / (asset + '.gz'), target)
        staged['entities'][key] = relative
    atomic(destination, compact(staged))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prop', type=int)
    parser.add_argument('--source', type=Path, default=EXTRACTOR / '.cache/dofus3/world')
    parser.add_argument('--release', type=Path, default=WEB / 'game-data')
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('prepared_entities', WEB / 'scripts/prepare-entities.py')
    prepared = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prepared)
    manifest = json.loads((args.release / 'optimized/entities-manifest.json').read_bytes())
    names = sorted(k.removeprefix('entities/') for k in manifest['entities'] if k.startswith('entities/prop_'))
    if args.prop is not None:
        names = [f'prop_{args.prop}.json']
    # Work on the preparation source first. Atomic replacement also avoids
    # modifying hardlinked published files in place.
    for name in names:
        source = args.source / 'entities' / (name + '.gz')
        doc = json.loads(gzip.decompress(source.read_bytes()))
        repair(doc)
        raw = gzip.compress(prepared.assets.compact(doc), compresslevel=6, mtime=0)
        prepared.assets.atomic(source, raw)
        prepared.assets.atomic(args.release / 'entities' / (name + '.gz'), raw)
    prepared.ROOTS = [args.source]
    prepared.TARGET = args.release
    sys.argv = [sys.argv[0], *names]
    prepared.main()
    sync_prepared_source(args.source, args.release, names, prepared.assets.atomic, prepared.assets.compact)
    prepared.assets.atomic(args.release / 'prop-colors-report.json',
                           prepared.assets.compact({'encoding': ENCODING, 'props': names}))


if __name__ == '__main__':
    main()

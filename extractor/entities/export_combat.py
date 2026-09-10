"""Export shared combat clips resolved by the official BoneIndex class 0.

Run with the configured UnityPy interpreter:
  python -m extractor.entities.export_combat
"""
from pathlib import Path
import gzip
import json
from extractor.entities.export_bone import export_animated_bundle
from extractor.unity_loader import DEFAULT_CLIENT, content_root


def export_combat(client=DEFAULT_CLIENT, output=Path('output')):
    index = json.loads((output / 'data/boneindex.json').read_text())
    bundle_id = index['1']['0']['AnimTacle']
    bundle = content_root(client) / 'Characters/Bones' / f'bones_assets_bone_{bundle_id}.bundle'
    path = export_animated_bundle(bundle, output, 1, 'combat_1.json',
        animation_filter={'AnimTacle*', 'AnimHit*', 'AnimMort*'}, default_idle_walk=False)
    data = json.loads(path.read_text())
    assert any(k.startswith('AnimTacle_') for k in data['animations']), 'Missing official tackle clips'
    raw = json.dumps(data, separators=(',', ':')).encode()
    path.write_bytes(raw)
    path.with_suffix('.json.gz').write_bytes(gzip.compress(raw, mtime=0))
    print(f'{path}: {len(data["animations"])} official clips from {bundle.name}')
    return path


if __name__ == '__main__': export_combat()

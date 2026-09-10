#!/usr/bin/env python3
"""Extract the installed client's ten URP film-grain textures without resampling."""
import argparse
import hashlib
import io
import json
import os
import sys
from pathlib import Path

DOFUS = Path(__file__).resolve().parents[2] / 'dofus3'
sys.path.insert(0, str(DOFUS))
from extractor.unity_loader import DEFAULT_CLIENT, client_version, load_bundle, player_data_root

# Both FilmGrainLookup and AleCore FilmGrainType enumerate these presets 0..9.
NAMES = ('Thin01', 'Thin02', 'Medium01', 'Medium02', 'Medium03', 'Medium04',
         'Medium05', 'Medium06', 'Large01', 'Large02')


def atomic(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.tmp')
    tmp.write_bytes(payload)
    os.replace(tmp, path)


def prepare(client, output):
    source = player_data_root(client) / 'globalgamemanagers.assets'
    env = load_bundle(source)
    found = {}
    for obj in env.objects:
        if obj.type.name != 'Texture2D':
            continue
        texture = obj.read()
        if texture.m_Name not in NAMES:
            continue
        if texture.m_Name in found:
            raise ValueError(f'Duplicate grain texture: {texture.m_Name}')
        if texture.m_TextureFormat != 1:
            raise ValueError(f'Expected Alpha8 grain texture: {texture.m_Name}')
        image = texture.image.convert('RGBA')
        data = io.BytesIO()
        image.save(data, 'PNG')
        payload = data.getvalue()
        # Verify the saved alpha field, including its orientation and transparent pixels.
        from PIL import Image
        with Image.open(io.BytesIO(payload)) as decoded:
            if decoded.getchannel('A').tobytes() != image.getchannel('A').tobytes():
                raise ValueError(f'Grain alpha changed: {texture.m_Name}')
        found[texture.m_Name] = (payload, {'name': texture.m_Name, 'pathId': obj.path_id,
            'width': image.width, 'height': image.height, 'sha256': hashlib.sha256(payload).hexdigest(),
            'alphaSha256': hashlib.sha256(image.getchannel('A').tobytes()).hexdigest()})
    if set(found) != set(NAMES):
        raise ValueError(f'Missing grain textures: {sorted(set(NAMES) - set(found))}')
    report = {'format': 'giny.film-grain.v1', 'sourceVersion': client_version(client),
              'source': str(source), 'textures': {}}
    for index, name in enumerate(NAMES):
        payload, entry = found[name]
        relative = f'effects/grain/{index}.png'
        atomic(output / relative, payload)
        report['textures'][str(index)] = {**entry, 'path': relative}
    atomic(output / 'effects/grain/manifest.json', json.dumps(report, indent=2).encode())
    print(json.dumps({'textures': len(found), 'output': str(output), 'bytes': sum(len(v[0]) for v in found.values())}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client', type=Path, default=DEFAULT_CLIENT)
    parser.add_argument('--output', type=Path, default=DOFUS / '.cache/dofus3/world')
    args = parser.parse_args()
    prepare(args.client, args.output)

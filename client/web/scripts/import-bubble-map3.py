"""Reproducibly isolate Bubble Map3 from the user-provided ASAR; no login or API.
Run from any directory: python3 client/web/scripts/import-bubble-map3.py
"""
from pathlib import Path
import hashlib
import json
import re
import struct
import subprocess
import tempfile
ROOT = Path(__file__).resolve().parents[3]
ARCHIVE = ROOT / 'resources/app.asar'
OUT = ROOT / 'client/web/public/bubble/runtime'
EXPECTED = '9d2bd53656e91c52b20db881225617625222d74b41f965dd961bfd35d7301a8f'

def main():
    if hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() != EXPECTED:
        raise ValueError('Bubble archive changed: review the dependency slice before importing')
    with tempfile.TemporaryDirectory(prefix='giny-map3-') as temp, ARCHIVE.open('rb') as archive:
        directory = Path(temp)
        header = struct.unpack('<4I', archive.read(16))
        tree = json.loads(archive.read(header[3]))
        entries = tree['files']['dist']['files']['assets']['files']
        queue = ['character-preview-render-D01yieWl.js', 'x-D8TUb0j1.js', 'index-BP60ZkRz.js', 'index-AJmcKxRp.js', 'map3_actor_batcher-DlTqz3p7.wasm']
        verified = {}
        while queue:
            name = queue.pop()
            if name in verified: continue
            entry = entries[name]
            archive.seek(8 + header[1] + int(entry['offset']))
            raw = archive.read(entry['size'])
            digest = hashlib.sha256(raw).hexdigest()
            if digest != entry['integrity']['hash']: raise ValueError(f'Invalid archive module: {name}')
            verified[name] = digest
            (directory / name).write_bytes(raw)
            if name.endswith('.js'):
                queue.extend(n for n in re.findall(r'"\./([^"/]+)"', raw.decode()) if n in entries)
        OUT.mkdir(parents=True, exist_ok=True)
        subprocess.run(['node', str(ROOT/'client/web/scripts/slice-bubble-map3.cjs'), str(directory), str(directory/'sliced')], cwd=ROOT, check=True)
        wasm = 'map3_actor_batcher-DlTqz3p7.wasm'
        sliced = directory/'sliced'
        (sliced/wasm).write_bytes((directory/wasm).read_bytes())
        app = (sliced/'app-CgRsD63L.js').read_text()
        if any(word in app for word in ['access_token', 'refresh_token', 'play-bubble.net', 'window.desktop']):
            raise ValueError('Unexpected application lifecycle dependency in native slice')
        for p in sliced.glob('*.js'):
            for name in re.findall(r'from \"\./([^\"]+)\"', p.read_text()):
                if not (sliced/name).exists(): raise ValueError(f'Missing dependency {name}')
        output = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sliced.iterdir() if p.is_file()}
        previous = OUT.parent/'runtime-provenance.json'
        old = json.loads(previous.read_text()).get('output_sha256', {}) if previous.exists() else {}
        for name in old:
            if name not in output: (OUT/name).unlink(missing_ok=True)
        for p in sliced.iterdir(): (OUT/p.name).write_bytes(p.read_bytes())
        provenance = {'version':'0.1.328','archive_sha256':EXPECTED,'root_class':'Y_ / BubbleMapScene + Ae / Entity + Xe / AssetLoader + Xr / LookRenderer + native movement',
            'method':'Dependency declarations selected from verified source; native shader and function bodies preserved. App dependency restricted to native oH/lH enums and the explicit pathfinding declaration allowlist.',
            'source_modules':{name:verified[name] for name in output if name in verified}, 'output_sha256':output}
        (OUT.parent/'runtime-provenance.json').write_text(json.dumps(provenance, indent=2)+'\n')
        print(f'Isolated {len(output)} files; SHA-256 provenance recorded')

if __name__ == '__main__': main()

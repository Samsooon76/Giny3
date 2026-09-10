#!/usr/bin/env python3
"""Check every prepared map atlas crop against its local source, without a GPU."""
import gzip
import importlib.util
import json
from pathlib import Path
import struct
from PIL import Image, ImageChops
import zstandard

spec = importlib.util.spec_from_file_location('prepare_assets', Path(__file__).with_name('prepare-assets.py'))
a = importlib.util.module_from_spec(spec); spec.loader.exec_module(a)
base = Path(__file__).resolve().parents[2] / 'dofus3'
roots = [base/'.cache/dofus3/runtime', base/'output']
target = roots[0]
manifest = json.loads((target/'optimized/manifest.json').read_bytes())
checked = set(); rows = []; page_images = {}
for mid, entry in manifest['maps'].items():
    raw = a.read_doc(a.source_file(roots, f'maps/{mid}.json'))
    doc = a.read_doc(a.source_file(roots, entry['path']))
    old_urls = set(); new_urls = set(); bc7_urls = set()
    for key in a.eligible(raw):
        if key not in raw['gfx']: continue
        source = raw['gfx'][key]; gfx = doc['gfx'][key]
        old_urls.add(source['texture']); new_urls.add(gfx['texture'])
        bc7_urls.add(gfx.get('bc7_texture') or gfx['texture'])
        assert {k:v for k,v in gfx.items() if k not in ('texture','frame','bc7_texture')} == {k:v for k,v in source.items() if k != 'texture'}
        if 'frame' not in gfx: continue
        identity = (gfx['texture'], tuple(gfx['frame']), source['texture'])
        if identity in checked: continue
        atlas = page_images.get(gfx['texture'])
        if atlas is None:
            atlas = Image.open(target/gfx['texture']).convert('RGBA'); page_images[gfx['texture']] = atlas
        x,y,w,h = gfx['frame']
        with Image.open(a.source_file(roots,source['texture'])) as im:
            assert ImageChops.difference(atlas.crop((x,y,x+w,y+h)), im.convert('RGBA')).getbbox(alpha_only=False) is None, identity
        checked.add(identity)
    assert doc['elements'] == raw['elements'] and doc['cells'] == raw['cells']
    def gpu_size(url):
        p = a.source_file(roots,url)
        if url.endswith('.ktx2'):
            data=p.read_bytes(); offset,length,expanded=struct.unpack_from('<3Q',data,80)
            assert len(zstandard.ZstdDecompressor().decompress(data[offset:offset+length])) == expanded
            return expanded
        with Image.open(p) as im: return im.width*im.height*4
    rows.append({'map':int(mid),'source_textures':len(old_urls),'prepared_textures':len(new_urls),
                 'source_rgba_bytes':sum(gpu_size(u) for u in old_urls),'prepared_bc7_bytes':sum(gpu_size(u) for u in bc7_urls)})
report={'maps':len(rows),'exact_lossless_crops':len(checked),'pages':len(page_images),'results':rows}
out=Path(__file__).resolve().parents[1]/'output/performance';out.mkdir(parents=True,exist_ok=True)
(out/'assets-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='results'}))
print(json.dumps([row for row in rows if row['map'] in (154644,153878788,153880836)],indent=2))

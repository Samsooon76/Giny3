#!/usr/bin/env python3
"""Independent BC7 decoding sample, compared with original premultiplied pixels."""
import texture2ddecoder
import json, struct, sys
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(next((BASE/'.venv-assets/lib').glob('python*/site-packages'))))
import zstandard
from PIL import Image, ImageChops, ImageStat
root=BASE/'.cache/dofus3/world';variants=json.loads((root/'texture-variants.json').read_bytes())
keys=sorted(k for k,v in variants.items() if 'bc7_texture' in v)
results=[]
for gid in keys[::max(1,len(keys)//48)]:
    v=variants[gid];data=(root/v['bc7_texture']).read_bytes();w,h=struct.unpack_from('<II',data,20)
    offset,size,expanded=struct.unpack_from('<3Q',data,80)
    blocks=zstandard.ZstdDecompressor().decompress(data[offset:offset+size]);assert len(blocks)==expanded==w*h
    rgba=texture2ddecoder.decode_bc7(blocks,w,h)
    decoded=Image.frombytes('RGBA',(w,h),rgba,'raw','BGRA')
    with Image.open(root/f'gfx/{gid}.png') as original:
        expected=Image.frombytes('RGBA',original.size,original.convert('RGBa').tobytes())
        decoded=decoded.crop((0,0,original.width,original.height))
        mean=ImageStat.Stat(ImageChops.difference(expected,decoded)).mean
        results.append({'gfx':gid,'mean_absolute_error_rgba_255':mean})
report={'samples':len(results),'worst_mean_channel_error':max(max(x['mean_absolute_error_rgba_255']) for x in results),'results':results}
(root/'compression-quality.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='results'}))

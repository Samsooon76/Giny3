#!/usr/bin/env python3
"""Prepare immutable map documents and shared atlases, entirely from local files.

Run using client/dofus3/.venv-assets/bin/python. Existing exports are never edited.
--extract explicitly prepares the selected maps with the regular extractor first.
The manifest is published atomically only after all referenced assets exist.
"""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import struct
import sys
import time
from PIL import Image, ImageChops
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor
from collections import deque

VERSION = 'giny.prepared.v1'
PAGE_SIZE = 2048
PADDING = 4
MAGIC = b'\xabKTX 20\xbb\r\n\x1a\n'


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.tmp')
    tmp.write_bytes(data)
    os.replace(tmp, path)


def compact(value):
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode()


def encode_bc7_blocks(rgba, width, height, profile="alpha_basic"):
    """Encode repeated 4x4 blocks once; restore their original raster order.

    BC7 blocks are independent. Deduplication changes neither the chosen
    profile nor the encoded bytes, and all scratch state belongs to one page.
    """
    import ispc_texcomp
    settings = ispc_texcomp.BC7EncSettings.from_profile(profile)
    if width <= 0 or height <= 0 or width % 4 or height % 4:
        raise ValueError('BC7 atlas dimensions must be multiples of four')
    if len(rgba) != width * height * 4:
        raise ValueError('BC7 atlas pixel buffer has an invalid length')
    unique, seen, indices = [], {}, []
    stride = width * 4
    for y in range(0, height, 4):
        for x in range(0, width, 4):
            start = y * stride + x * 4
            block = b''.join(rgba[start + row * stride:start + row * stride + 16] for row in range(4))
            index = seen.get(block)
            if index is None:
                index = len(unique)
                seen[block] = index
                unique.append(block)
            indices.append(index)
    # Dense pages gain too little from repacking; keep the direct encoder.
    if len(unique) > len(indices) * .9:
        return ispc_texcomp.compress_blocks_bc7(ispc_texcomp.RGBASurface(rgba, width, height), settings)
    columns = 64
    packed_stride = columns * 16
    packed_height = ((len(unique) + columns - 1) // columns) * 4
    packed = bytearray(packed_stride * packed_height)
    for index, block in enumerate(unique):
        start = (index // columns) * 4 * packed_stride + (index % columns) * 16
        for row in range(4):
            packed[start + row * packed_stride:start + row * packed_stride + 16] = block[row * 16:row * 16 + 16]
    encoded = ispc_texcomp.compress_blocks_bc7(
        ispc_texcomp.RGBASurface(bytes(packed), columns * 4, packed_height), settings)
    return b''.join(encoded[index * 16:index * 16 + 16] for index in indices)


def encode_bc7(image, profile="alpha_basic"):
    import zstandard
    # Pixi's shaders expect premultiplied texels. Compressed uploads cannot ask
    # WebGL to premultiply them, so do it here, before encoding.
    rgba = image.convert('RGBa').tobytes()
    blocks = encode_bc7_blocks(rgba, image.width, image.height, profile)
    payload = zstandard.ZstdCompressor(level=9).compress(blocks)
    # Khronos basic DFD: BC7/BT709/linear, premultiplied alpha, 4x4 blocks.
    dfd = struct.pack('<IIHH4B4B8B', 44, 0, 2, 40, 134, 1, 1, 1, 3, 3, 0, 0, 16, 0, 0, 0, 0, 0, 0, 0)
    dfd += struct.pack('<HBB4BII', 0, 127, 0, 0, 0, 0, 0, 0, 0xffffffff)
    header = struct.pack('<12s13I2Q', MAGIC, 145, 1, image.width, image.height, 0, 0, 1, 1, 2, 104, len(dfd), 0, 0, 0, 0)
    return header + struct.pack('<3Q', 104 + len(dfd), len(payload), len(blocks)) + dfd + payload


@lru_cache(maxsize=12)
def _atlas_pixels(path):
    with Image.open(path) as image: return image.convert('RGBA')

def reuse_atlas_frames(doc, previous, source_root, atlas_root):
    """Reuse existing atlas placement only after exact source pixel verification."""
    reused = 0
    for gid, gfx in doc['gfx'].items():
        old = previous.get('gfx', {}).get(gid, {})
        if not old.get('frame'): continue
        if any(gfx.get(k) != old.get(k) for k in ('width','height','pivot','offset','pixels_per_unit')): continue
        x,y,w,h = old['frame']
        atlas = _atlas_pixels(str(atlas_root / old['texture']))
        with Image.open(source_root / gfx['texture']) as source:
            if source.size != (w,h): continue
            if ImageChops.difference(atlas.crop((x,y,x+w,y+h)), source.convert('RGBA')).getbbox(alpha_only=False) is not None: continue
        for k in ('texture','frame','bc7_texture'):
            if k in old: gfx[k] = old[k]
        reused += 1
    return reused


def eligible(doc):
    keys = set()
    for e in doc['elements']:
        if e['layer'] in ('animated', 'refraction', 'particles', 'unknown') or e.get('blend') == 'none':
            continue
        if e.get('display_behaviour') == 1 and e.get('blend', 'normal') == 'normal':
            continue
        keys.add(str(e['gfx_id']))
    for prop in doc.get('props', []):
        if prop.get('static'):
            keys.add(str(prop['prop_id']))
    return keys


def source_file(roots, relative):
    for root in roots:
        for suffix in ('', '.gz'):
            p = root / (relative + suffix)
            if p.is_file():
                return p
    return None


def read_doc(file):
    b = file.read_bytes()
    return json.loads(gzip.decompress(b) if file.suffix == '.gz' else b)


def encode_page(atlas, target, relative_page, ktx_relative):
    """Write one immutable page pair; each submitted atlas has a single owner."""
    page_path = target / relative_page
    if not page_path.exists():
        data = io.BytesIO()
        atlas.save(data, 'WEBP', lossless=True, method=4, exact=True)
        atomic(page_path, data.getvalue())
    if ktx_relative and not (target / ktx_relative).exists():
        atomic(target / ktx_relative, encode_bc7(atlas))


def prepare(args):
    started = time.monotonic()
    dofus = Path(__file__).resolve().parents[2] / 'dofus3'
    roots = [Path(args.source).resolve(), dofus / '.cache/dofus3/runtime'] if args.source else [dofus / '.cache/dofus3/runtime', dofus / 'output']
    target = Path(args.output).resolve() if args.output else roots[0]
    selected = set(args.maps.split(',')) if args.maps else {p.name.split('.')[0] for root in roots for p in (root / 'maps').glob('*.json*') if p.name.split('.')[0].isdigit()}
    if not all(s.isdigit() for s in selected):
        raise ValueError('Map IDs must be positive integer identifiers')
    if args.extract:
        if not args.maps:
            raise ValueError('--extract requires an explicit --maps list')
        sys.path.insert(0, str(dofus))
        from extractor.maps.export_map import export_map
        for mid in sorted(selected, key=int):
            export_map(Path(args.client), int(mid), roots[1])
    documents = {}
    skipped = []
    for mid in sorted(selected, key=int):
        p = source_file(roots, f'maps/{mid}.json')
        if p is None:
            skipped.append({'id': mid, 'reason': 'missing'}); continue
        doc = read_doc(p)
        if doc.get('format') != 'giny.dofus3.map.v3' or len(doc.get('cells', [])) != 560:
            skipped.append({'id': mid, 'reason': 'requires extraction'}); continue
        documents[mid] = doc
    if not documents:
        raise ValueError('No ready v3 map; use --extract --maps ID,... first')
    # Small neighbourhood cohorts bound irrelevant page residency while avoiding
    # hundreds of tiny atlases for every distinct combination of map references.
    groups = {}
    remaining = set(documents)
    while remaining:
        seed = min(remaining, key=int); cohort = [seed]; remaining.remove(seed)
        for mid in cohort:
            for neighbour in documents[mid].get('neighbours', {}).values():
                key = str(neighbour)
                if key in remaining and len(cohort) < 4:
                    cohort.append(key); remaining.remove(key)
        names = set()
        for mid in cohort:
            doc = documents[mid]
            for key in eligible(doc):
                gfx = doc['gfx'].get(key)
                if gfx: names.add(gfx['texture'])
        groups[tuple(cohort)] = sorted(names)
    replacements = {}
    pages = []
    workers = min(4, os.cpu_count() or 1)
    pending = deque()
    submitted = set()
    # Retain at most four encoding jobs, not the entire world's RGBA pages.
    # The manifest is written only after every encoder succeeds.
    with ThreadPoolExecutor(max_workers=workers) as encoder:
        for map_ids, names in groups.items():
            items = []
            for relative in names:
                p = source_file(roots, relative)
                if p is None:
                    raise ValueError(f'Missing map dependency: {relative}')
                with Image.open(p) as im:
                    w, h = im.size
                # Large veils remain standalone; no downscaling or crop changes.
                if w + PADDING * 2 > PAGE_SIZE or h + PADDING * 2 > PAGE_SIZE:
                    continue
                items.append((relative, p, w, h))
            items.sort(key=lambda x: (-x[3], -x[2], x[0]))
            chunks = []; chunk = []; x = y = row = used_x = 0
            for item in items:
                w, h = item[2] + PADDING * 2, item[3] + PADDING * 2
                if x + w > PAGE_SIZE:
                    y += row; x = row = 0
                if y + h > PAGE_SIZE:
                    chunks.append((chunk, used_x, y + row)); chunk = []; x = y = row = used_x = 0
                chunk.append((item, x + PADDING, y + PADDING)); x += w; row = max(row, h); used_x = max(used_x, x)
            if chunk:
                chunks.append((chunk, used_x, y + row))
            for chunk, w, h in chunks:
                w = (w + 3) // 4 * 4; h = (h + 3) // 4 * 4
                atlas = Image.new('RGBA', (w, h))
                for (relative, p, iw, ih), x, y in chunk:
                    with Image.open(p) as im:
                        im = im.convert('RGBA'); atlas.paste(im, (x, y))
                        # Extrude borders for filtering and isolate BC7 blocks.
                        for d in range(1, PADDING + 1):
                            atlas.paste(im.crop((0, 0, iw, 1)), (x, y-d))
                            atlas.paste(im.crop((0, ih-1, iw, ih)), (x, y+ih+d-1))
                            atlas.paste(im.crop((0, 0, 1, ih)), (x-d, y))
                            atlas.paste(im.crop((iw-1, 0, iw, ih)), (x+iw+d-1, y))
                digest = hashlib.sha256(compact([VERSION, w, h, args.bc7]) + atlas.tobytes()).hexdigest()
                relative_page = f'optimized/pages/{digest}.webp'
                ktx_relative = f'optimized/pages/{digest}.ktx2' if args.bc7 else None
                # Identical pages can occur in multiple neighbourhood cohorts.
                # One writer per content hash also protects atomic .tmp paths.
                missing = not (target / relative_page).exists() or (ktx_relative and not (target / ktx_relative).exists())
                if missing and digest not in submitted:
                    if len(pending) >= workers:
                        pending.popleft().result()
                    submitted.add(digest)
                    pending.append(encoder.submit(encode_page, atlas, target, relative_page, ktx_relative))
                for (relative, p, iw, ih), x, y in chunk:
                    for mid in map_ids:
                        replacements[(mid, relative)] = {'texture': relative_page, 'frame': [x, y, iw, ih], 'bc7_texture': ktx_relative}
                pages.append({'texture': relative_page, 'bc7': ktx_relative, 'width': w, 'height': h, 'maps': map_ids,
                    'rgba_bytes': w*h*4, 'bc7_bytes': w*h if args.bc7 else 0})
                print(f'page {len(pages)}: {w}x{h}, {len(chunk)} GFX', flush=True)
        for future in pending:
            future.result()
    prepared_page_count = len(pages)
    manifest = {'format': VERSION, 'maps': {}, 'pages': pages}
    for mid, doc in documents.items():
        for gfx in doc['gfx'].values():
            replacement = replacements.get((mid, gfx['texture']))
            if replacement: gfx.update(replacement)
            # Standalone sprites can already reference compressed pages from the
            # source pack. Keep those dependencies in the new page namespace too.
            for key in ('texture', 'bc7_texture'):
                relative = gfx.get(key)
                if not relative or not relative.startswith('optimized/pages/'):
                    continue
                destination = target / relative
                if destination.exists(): continue
                source = source_file(roots, relative)
                if source is None: raise ValueError(f'Missing retained page: {relative}')
                atomic(destination, source.read_bytes())
        raw = compact(doc); digest = hashlib.sha256(raw).hexdigest()
        relative = f'optimized/maps/{mid}-{digest}.json'
        atomic(target / (relative + '.gz'), gzip.compress(raw, compresslevel=6, mtime=0))
        manifest['maps'][mid] = {'path': relative, 'hash': digest}
    # A partial preparation updates selected maps without dropping other maps.
    previous_path = target / 'optimized/manifest.json'
    if args.maps and previous_path.exists():
        previous = json.loads(previous_path.read_bytes())
        if previous.get('format') == VERSION:
            manifest['maps'] = {**previous['maps'], **manifest['maps']}
            for page in previous.get('pages', []):
                retained = [mid for mid in page['maps'] if mid not in documents]
                if retained: manifest['pages'].append({**page, 'maps': retained})
    # Old immutable assets stay valid for open clients; cleanup is offline.
    manifest['revision'] = hashlib.sha256(compact(manifest)).hexdigest()
    atomic(target / 'optimized/manifest.json', compact(manifest))
    report = {'maps': len(documents), 'pages': prepared_page_count, 'skipped': skipped, 'seconds': round(time.monotonic()-started, 2), 'revision': manifest['revision']}
    atomic(target / 'optimized/preparation-report.json', json.dumps(report, indent=2).encode())
    print(json.dumps({**report, 'skipped': len(skipped)}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--maps', help='Comma-separated map IDs; default: all current v3 exports')
    parser.add_argument('--source'); parser.add_argument('--output')
    parser.add_argument('--bc7', action='store_true', help='Also encode BC7/Zstd KTX2 (requires ispc_texcomp and zstandard)')
    parser.add_argument('--extract', action='store_true')
    parser.add_argument('--client', default=os.environ.get('GINY_DOFUS_CLIENT', '/Applications/Ankama/Dofus-dofus3'))
    prepare(parser.parse_args())

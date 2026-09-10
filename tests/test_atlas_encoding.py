"""Offline atlas publication: deterministic pixels, bounded writers, atomic failure."""
import importlib.util
import json
import random
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[2] / 'web/scripts/prepare-assets.py'
spec = importlib.util.spec_from_file_location('atlas_assets', SCRIPT)
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)


class AtlasEncodingTests(unittest.TestCase):
    def test_deduplicated_bc7_is_byte_identical_for_sparse_dense_and_partial_rows(self):
        import ispc_texcomp
        rng = random.Random(20260908)
        cases = [(4, 4, bytes(64)), (12, 8, bytes([120, 50, 90, 255]) * 96)]
        cases.append((36, 32, rng.randbytes(36 * 32 * 4)))
        # More than one packed row, with repeated blocks and a partial last row.
        width, height = 68, 36
        raw = bytearray(width * height * 4)
        blocks = [rng.randbytes(64) for _ in range(67)]
        for index in range(width * height // 16):
            block = blocks[index % len(blocks)]
            start = (index // (width // 4)) * 4 * width * 4 + (index % (width // 4)) * 16
            for row in range(4):
                raw[start + row * width * 4:start + row * width * 4 + 16] = block[row * 16:row * 16 + 16]
        cases.append((width, height, bytes(raw)))
        for width, height, raw in cases:
            expected = ispc_texcomp.compress_blocks_bc7(ispc_texcomp.RGBASurface(raw, width, height),
                                                       ispc_texcomp.BC7EncSettings.from_profile('alpha_basic'))
            self.assertEqual(a.encode_bc7_blocks(raw, width, height), expected)
        with self.assertRaises(ValueError):
            a.encode_bc7_blocks(bytes(64), 3, 4)
        with self.assertRaises(ValueError):
            a.encode_bc7_blocks(bytes(63), 4, 4)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'source'
        (self.source / 'maps').mkdir(parents=True)
        (self.source / 'gfx').mkdir()
        for gid in range(4):
            image = a.Image.new('RGBA', (40, 40), (gid * 50, 80, 120, 255))
            image.putpixel((0, 0), (255, gid, 0, 0))
            image.save(self.source / f'gfx/{gid}.png')
        for mid in range(8):
            doc = {'format': 'giny.dofus3.map.v3', 'id': mid, 'cells': [0] * 560,
                   'neighbours': {'right': mid + 1} if mid % 4 != 3 else {}, 'props': [],
                   'elements': [{'layer': 'sortable', 'gfx_id': gid} for gid in range(4)],
                   'gfx': {str(gid): {'texture': f'gfx/{gid}.png', 'width': 40, 'height': 40} for gid in range(4)}}
            (self.source / f'maps/{mid}.json').write_text(json.dumps(doc))

    def prepare(self, target):
        with patch.object(a, 'PAGE_SIZE', 64), patch.object(a.os, 'cpu_count', return_value=4):
            a.prepare(SimpleNamespace(source=str(self.source), output=str(target),
                                      maps=','.join(map(str, range(8))), bc7=True, extract=False))

    def test_parallel_output_matches_serial_and_has_one_writer_per_page(self):
        serial, parallel = self.root / 'serial', self.root / 'parallel'
        with patch.object(a, 'ThreadPoolExecutor', lambda **_: ThreadPoolExecutor(max_workers=1)):
            self.prepare(serial)
        encode = a.encode_page
        gate = threading.Barrier(4, timeout=10)
        calls = []
        lock = threading.Lock()
        def simultaneous(image, target, relative, compressed):
            with lock:
                calls.append(relative)
            gate.wait()
            return encode(image, target, relative, compressed)
        with patch.object(a, 'encode_page', simultaneous):
            self.prepare(parallel)
        self.assertEqual(len(calls), 4)
        self.assertEqual(len(set(calls)), 4)
        def files(root):
            return {str(p.relative_to(root)): p.read_bytes() for p in (root / 'optimized').rglob('*')
                    if p.is_file() and p.name != 'preparation-report.json'}
        self.assertEqual(files(serial), files(parallel))
        manifest = json.loads((parallel / 'optimized/manifest.json').read_text())
        for entry in manifest['maps'].values():
            doc = a.read_doc(a.source_file([parallel], entry['path']))
            for gid, gfx in doc['gfx'].items():
                with a.Image.open(parallel / gfx['texture']) as atlas, a.Image.open(self.source / f'gfx/{gid}.png') as original:
                    x, y, w, h = gfx['frame']
                    self.assertEqual(atlas.convert('RGBA').crop((x, y, x + w, y + h)).tobytes(), original.tobytes())

    def test_encoder_failure_never_replaces_manifest(self):
        target = self.root / 'failed'
        manifest = target / 'optimized/manifest.json'
        manifest.parent.mkdir(parents=True)
        previous = b'{"format":"giny.prepared.v1","maps":{},"pages":[]}'
        manifest.write_bytes(previous)
        with patch.object(a, 'encode_page', side_effect=RuntimeError('encoder failed')):
            with self.assertRaisesRegex(RuntimeError, 'encoder failed'):
                self.prepare(target)
        self.assertEqual(manifest.read_bytes(), previous)


if __name__ == '__main__':
    unittest.main()

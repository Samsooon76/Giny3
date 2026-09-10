"""Inventory arena-like maps using floor assets visually checked against a real fight.

No gameplay config is changed. A matching zone is metadata membership, not proof
of official server pool selection. Run from any directory; output is cached so
classification and gallery generation need not decompress the catalogue again.
"""
import collections
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'client/web/game-data'
OUT = ROOT / 'output/audits/official-combat-maps'
FAMILIES = {
    'beige': [71364, 71365, 71289, 71290, 71291, 71292],
    'grass': [71366, 71367, 71368, 71369, 71370],
    'ice_blue': list(range(71519, 71522)),
    'ice_pale': list(range(71522, 71525)),
    'white': list(range(74444, 74450)),
    'grey': list(range(90124, 90130)),
    'stone_patterned': list(range(401526, 401538)),
    'pale_extra': [71525, 68646, 68647, 68648, 68649, 800343, 800608],
    'metal': [71811, 71814],
    'wood': [401422, 401423, 47670],
    'glass_light': [69361, 69272],
    'raised_colored': [30785, 31014],
}


def main():
    manifest = json.loads((DATA/'optimized/manifest.json').read_text())
    cells = {r['map_id']: r for r in json.loads((OUT/'cells.json').read_text())}
    tile_ids = {i for ids in FAMILIES.values() for i in ids}
    result = []
    errors = []
    for n, (key, entry) in enumerate(manifest['maps'].items()):
        try:
            with gzip.open(DATA/(entry['path']+'.gz')) as f:
                doc = json.load(f)
            mid = int(key)
            if doc['id'] != mid:
                raise ValueError('Manifest/document id mismatch')
            elements = doc['elements']
            counts = collections.Counter(e['gfx_id'] for e in elements)
            tiles = [e for e in elements if e['gfx_id'] in tile_ids]
            positions = [(e['transform']['m31'], e['transform']['m32']) for e in tiles]
            raw = cells.get(mid, {})
            walk = [c['id'] for c in doc['cells'] if c.get('mov') and not c.get('non_walkable_during_fight')]
            result.append({'map_id': mid, 'tile_count': len(tiles),
                'families': {name: sum(counts[i] for i in ids) for name, ids in FAMILIES.items() if any(counts[i] for i in ids)},
                'tile_gfx_counts': {str(i): counts[i] for i in sorted(tile_ids) if counts[i]},
                'tile_center_bounds': [min(x for x,y in positions), min(y for x,y in positions), max(x for x,y in positions), max(y for x,y in positions)] if positions else None,
                'nonambient_props': sum(not p.get('ambient', False) for p in doc.get('props', [])),
                'prop_ids': sorted({p['gfx_id'] for p in doc.get('props', []) if not p.get('ambient', False)}),
                'exit_cells': raw.get('exit_cells'), 'fight_walkable': raw.get('fight_walkable'),
                'walkable_outer_ring': sum(c//14 in (0,39) or c%14 in (0,13) for c in walk),
                'placement_red': len(raw.get('red', [])), 'placement_blue': len(raw.get('blue', [])),
                'gfx_counts': dict(counts), 'top_repeated_gfx': counts.most_common(16)})
        except Exception as exc:
            errors.append({'map_id': key, 'error': str(exc)})
        if n % 1000 == 0:
            print(f'{n}/{len(manifest["maps"])} maps', flush=True)
    output = {'format': 'giny.arena-discovery.features.v1', 'manifest_revision': manifest.get('revision'),
        'visually_checked_floor_families': FAMILIES, 'maps': result, 'errors': errors}
    (OUT/'arena-features.json').write_text(json.dumps(output, separators=(',', ':')))
    print('Completed', len(result), 'errors', len(errors), flush=True)


if __name__ == '__main__':
    main()

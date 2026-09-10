"""Inspect official raw Unity metadata and placement cells, without changing gameplay."""
import argparse
import json
from pathlib import Path
from extractor.unity_loader import DEFAULT_CLIENT, content_root, client_version, load_bundle, iter_monobehaviours
from extractor.maps.export_map import _index_bundle_maps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/audits/official-combat-maps'
OUT.mkdir(parents=True, exist_ok=True)
base = content_root(DEFAULT_CLIENT)
metadata = {}
parser = argparse.ArgumentParser()
parser.add_argument('--metadata-only', action='store_true', help='Export metadata tables without rescanning map bundles.')
args = parser.parse_args()
for name, cls in [('mapsinformation', 'MapInformationData'), ('subareas', 'SubAreaData'), ('dungeons', 'DungeonData')]:
    records = []
    for _, tree in iter_monobehaviours(load_bundle(base / 'Data' / f'data_assets_{name}dataroot.asset.bundle')):
        records.extend(r['data'] for r in tree.get('references', {}).get('RefIds', []) if r.get('type', {}).get('class') == cls)
    metadata[name] = records
    (OUT / (name + '.json')).write_text(json.dumps(records, indent=2))
if args.metadata_only:
    print(json.dumps({name: len(rows) for name, rows in metadata.items()}), flush=True)
    raise SystemExit(0)
positions = {r['id']: r for r in metadata['mapsinformation']}
rows = []
errors = []
paths = sorted((base / 'Map/Data').glob('mapdata*.bundle'))
for i, path in enumerate(paths):
    try:
        _, trees = _index_bundle_maps(path)
        for mid, tree in trees.items():
            if 'mapData' not in tree:
                errors.append({'bundle': path.name, 'entry': mid, 'error': 'not a mapData object'})
                continue
            data = tree['mapData']; cells = data['cellsData']; position = positions.get(int(mid), {})
            rows.append({'map_id': int(mid), 'bundle': path.name, 'subarea_id': position.get('subAreaId'),
                'red': [c['cellNumber'] for c in cells if c.get('red')],
                'blue': [c['cellNumber'] for c in cells if c.get('blue')],
                'exit_cells': sum(bool(c.get('mapChangeData')) for c in cells),
                'rp_walkable': sum(bool(c.get('mov') and not c.get('nonWalkableDuringRP')) for c in cells),
                'fight_walkable': sum(bool(c.get('mov') and not c.get('nonWalkableDuringFight')) for c in cells),
                'neighbours': {d: data.get(d+'NeighbourId') for d in ['top','bottom','left','right']},
                'elements': sum(len(data.get(k, [])) for k in ['backgroundElements','sortableElements','foregroundElements']),
            })
    except Exception as exc:
        errors.append({'bundle': path.name, 'error': str(exc)})
    if i % 100 == 0: print(f'{i}/{len(paths)} bundles; {len(rows)} maps', flush=True)
summary = {'client_version': client_version(), 'bundles': len(paths), 'maps': len(rows),
    'map_information_rows': len(positions), 'subareas': len(metadata['subareas']),
    'with_red_and_blue': sum(bool(r['red'] and r['blue']) for r in rows),
    'with_any_placement': sum(bool(r['red'] or r['blue']) for r in rows),
    'errors': errors}
(OUT/'cells.json').write_text(json.dumps(rows, indent=2))
(OUT/'summary.json').write_text(json.dumps(summary, indent=2))
print(json.dumps(summary), flush=True)

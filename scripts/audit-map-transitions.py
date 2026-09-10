#!/usr/bin/env python3
"""Compare an exported server topology with the active client manifest (read-only)."""
import argparse
import gzip
import json
from pathlib import Path

DIRECTIONS = {'left': 'LeftMap', 'right': 'RightMap', 'top': 'TopMap', 'bottom': 'BottomMap'}


def audit(server, manifest, root):
    maps = {m['Id']: m for m in server['maps']}
    overrides = {m['MapId']: m for m in server['scroll_actions']}
    result = {'server_maps': len(maps), 'client_maps': len(manifest['maps']),
              'compared_maps': 0, 'mismatches': [], 'missing_client_maps': [],
              'missing_server_destinations': [], 'missing_documents': [], 'client_exit_missing_server_destinations': []}
    for mid, row in maps.items():
        entry = manifest['maps'].get(str(mid))
        if not entry:
            result['missing_client_maps'].append(mid)
            continue
        path = root / entry['path']
        if not path.exists():
            path = Path(str(path) + '.gz')
        if not path.exists():
            result['missing_documents'].append(mid)
            continue
        with (gzip.open(path, 'rt') if path.suffix == '.gz' else path.open()) as stream:
            document = json.load(stream)
        result['compared_maps'] += 1
        for direction, column in DIRECTIONS.items():
            target = overrides.get(mid, {}).get(column + 'Id') or row[column] or 0
            client = document.get('neighbours', {}).get(direction, 0)
            if target > 0 and target not in maps:
                issue = {'map': mid, 'direction': direction, 'target': target}
                result['missing_server_destinations'].append(issue)
                mask = {'left': 16, 'right': 1, 'top': 64, 'bottom': 4}[direction]
                if any(cell.get('map_change_data', 0) & mask and cell.get('mov') == 1
                       and not cell.get('non_walkable_during_rp', 0) for cell in document.get('cells', [])):
                    result['client_exit_missing_server_destinations'].append(issue)
            if target != client and (target > 0 or client > 0):
                result['mismatches'].append({'map': mid, 'direction': direction, 'client': client, 'server': target})
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server', type=Path, required=True)
    parser.add_argument('--game-data', type=Path, default=Path('client/web/game-data'))
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = audit(json.loads(args.server.read_text()), json.loads((args.game_data / 'optimized/manifest.json').read_text()), args.game_data)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: len(v) if isinstance(v, list) else v for k, v in report.items()}))

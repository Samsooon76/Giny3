"""Produce candidate pools, explicitly not an official combat-map association."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
out = root / 'output/audits/official-combat-maps'
read = lambda name: json.loads((out / name).read_text())
rows = read('cells.json'); summary = read('summary.json')
subareas = {r['id']: r for r in read('subareas.json')}
server = {r['Id'] for r in json.loads((root/'.local/map-topology-server.json').read_text())['maps']}
client = set(json.loads((root/'client/web/game-data/optimized/manifest.json').read_text())['maps'])
placements = [r for r in rows if r['red'] and r['blue']]
candidates = []
for row in placements:
    area = subareas.get(row['subarea_id'])
    if area is None or area.get('dungeonId', -1) > 0 or row['exit_cells']:
        continue
    if len(row['red']) < 8 or len(row['blue']) < 8 or set(row['red']) & set(row['blue']):
        continue
    candidates.append({**row, 'server_map_exists': row['map_id'] in server, 'client_artwork_exists': str(row['map_id']) in client})
pools = {}
for row in candidates:
    pools.setdefault(str(row['subarea_id']), []).append(row)
summary.update({'both_placements_with_subarea': sum(r['subarea_id'] is not None for r in placements),
    'both_placements_zone_count': len({r['subarea_id'] for r in placements if r['subarea_id'] is not None}),
    'both_placements_no_exits': sum(r['exit_cells'] == 0 for r in placements),
    'both_placements_dungeons': sum(subareas.get(r['subarea_id'], {}).get('dungeonId', -1) > 0 for r in placements),
    'filtered_candidates': len(candidates), 'candidate_zones': len(pools),
    'candidates_present_in_server_and_client': sum(r['server_map_exists'] and r['client_artwork_exists'] for r in candidates),
    'status': 'Candidate inventory only. No gameplay configuration changed; placement compatibility and visual validation still required.'})
(out/'candidate-pools.json').write_text(json.dumps({'status':summary['status'],'by_subarea':pools},indent=2))
(out/'summary.json').write_text(json.dumps(summary,indent=2))
print(json.dumps({k:v for k,v in summary.items() if k!='errors'},ensure_ascii=False))
print('Subarea 95:',[(r['map_id'],r['server_map_exists'],r['client_artwork_exists']) for r in pools.get('95',[])])

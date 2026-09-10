"""Inventory maps sharing visually verified floor tiles with user-observed arena 153890816.

Run from the repository root. Shared assets are a candidate signal only.
"""
import gzip,json,collections
from pathlib import Path
base=Path('output/audits/official-combat-maps');meta={r['id']:r for r in json.load(open(base/'mapsinformation.json'))};cells={r['map_id']:r for r in json.load(open(base/'cells.json'))};out=[]
for p in Path('client/web/game-data/optimized/maps').glob('*.json.gz'):
 with gzip.open(p) as f:d=json.load(f)
 gfx=d.get('gfx',{})
 if not any(str(i) in gfx for i in [71364,71365]):continue
 es=d.get('elements',[])
 counts=collections.Counter(e.get('gfx_id',e.get('gfxId')) for e in es)
 r=meta.get(d['id'],{});c=cells.get(d['id'],{})
 out.append({'map_id':d['id'],'tile_counts':{str(i):counts[i] for i in [71364,71365]},'metadata':r,'exit_cells':c.get('exit_cells'),'fight_walkable':c.get('fight_walkable')})
report={'observed_transition':{'source_map_id':153880835,'fight_map_id':153890816,'evidence':'User official-client screenshots and /mapid logs, 2026-09-09 08:29–08:30; one observed transition, not exhaustive pool.'},'seed_tile_gfx_ids':[71364,71365],'status':'Shared tile assets are candidates, not confirmed combat maps. No red/blue placement requirement.','matches':out}
(base/'confirmed-seed-153890816.json').write_text(json.dumps(report,indent=2))
print('matches',len(out),'zones',len({r['metadata'].get('subAreaId') for r in out}));print('seed',next(r for r in out if r['map_id']==153890816));print('zone450',[(r['map_id'],r['tile_counts']) for r in out if r['metadata'].get('subAreaId')==450])

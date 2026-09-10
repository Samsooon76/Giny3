"""Import official challenge icons from Bubble's local cache; no downloads."""
import gzip,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
cache=ROOT/'bubble/BubbleGame';dest=ROOT/'client/web/public/combat-assets/challenges';dest.mkdir(exist_ok=True)
entries={}
for p in cache.glob('sources/*/manifests/*/objects/*.json'):
    raw=p.read_bytes()
    if raw[:2]==b'\x1f\x8b':raw=gzip.decompress(raw)
    if b'data/challenge_icons/' not in raw:continue
    try:d=json.loads(raw)
    except ValueError:continue
    entries.update({k:v for k,v in d.get('assets',{}).items() if k.startswith('data/challenge_icons/')})
provenance={}
for path,e in entries.items():
    c=e['carrier'];sha=c['packHash'];pack=cache/f'packs/sha256/{sha[:2]}/{sha}.pack'
    if not pack.exists():continue
    with pack.open('rb') as f:f.seek(c['offset']);raw=f.read(c['length'])
    assert hashlib.sha256(raw).hexdigest()==e['hash']
    (dest/Path(path).name).write_bytes(raw);provenance[path]=e
rows=json.loads((ROOT/'client/web/game-data/data/challenges.json').read_text())
icons={str(r['id']):f"/combat-assets/challenges/{r['iconId']}.png" for r in rows.values() if (dest/f"{r['iconId']}.png").exists()}
(ROOT/'client/web/src/ui/game/challengeIcons.json').write_text(json.dumps(icons,separators=(',',':')))
(dest/'provenance.json').write_text(json.dumps(provenance,indent=2))
print(f'Imported {len(provenance)} verified challenge icons; mapped {len(icons)} challenges.')

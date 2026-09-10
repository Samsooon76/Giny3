"""Inventory official dungeon identities independently from arena heuristics."""
import json
import html


def write_inventory(out, dungeons, translations, zones, metadata, candidates):
    records = []
    for did, dungeon in sorted(dungeons.items()):
        name = translations.get(str(dungeon['nameId']), f'Donjon {did}')
        if name.casefold().startswith('expédition'):
            continue
        subareas = [z for z in zones if z['dungeon_id'] == did]
        exact = set(dungeon.get('mapIds', []))
        associations = []
        for row in candidates:
            mid = row['map_id']
            if mid in exact:
                associations.append({'mapId': mid, 'evidence': 'Salle explicitement listée dans DungeonData'})
            elif any(row['subarea_id'] == z['subarea_id'] for z in subareas):
                associations.append({'mapId': mid, 'evidence': 'Sous-zone officiellement rattachée au donjon ; plateau candidat'})
        records.append({
            'id': did, 'name': name,
            'level': dungeon.get('optimalPlayerLevel'), 'bossIds': dungeon.get('bosses', []),
            'roomMapIds': sorted(exact), 'entranceMapId': dungeon.get('entranceMapId'),
            'exitMapId': dungeon.get('exitMapId'),
            'subareas': [{'id': z['subarea_id'], 'name': z['name']} for z in subareas],
            'arenaCandidates': associations,
            'roomMetadataMissing': sorted(mid for mid in exact if mid not in metadata),
        })
    summary = {'dungeons': len(records), 'withArenaCandidates': sum(bool(r['arenaCandidates']) for r in records),
               'withoutArenaCandidates': sum(not r['arenaCandidates'] for r in records)}
    (out/'dungeon-inventory.json').write_text(json.dumps({'summary':summary,'dungeons':records},ensure_ascii=False,indent=2)+'\n')
    data = json.dumps(records, ensure_ascii=False).replace('<','\\u003c')
    page = '''<!doctype html><meta charset="utf-8"><title>Donjons officiels</title>
<style>body{background:#141d25;color:#ecede8;font:16px system-ui;margin:32px;padding:0 20px}a{color:#91d7dd;display:inline-block;margin:4px}input,select{padding:12px;margin:8px;background:#233340;color:white;border:1px solid #6b8495}table{width:100%;border-collapse:collapse}td,th{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #33434d}th{position:sticky;top:0;background:#141d25}small,p{color:#b9c4cc}</style>
<h1>Donjons officiels</h1><p>SUMMARY</p>
<p>Chaque ligne vient de DungeonData. Les salles sont explicitement listées ; les plateaux détachés restent des candidats lorsque seule leur sous-zone les rattache au donjon. Les rapprochements fondés uniquement sur les IDs ou le décor sont exclus de cette vue.</p>
<p><a href="arena-zones.html">Inventaire des plateaux</a> · <a href="dungeon-inventory.json">Données JSON</a></p>
<input id="search" placeholder="Nom du donjon, sous-zone ou ID"><select id="coverage"><option value="all">Tous les donjons</option><option value="found">Avec plateaux candidats</option><option value="missing">Sans plateau candidat</option></select><p id="count"></p>
<table><thead><tr><th>Donjon</th><th>Sous-zones officielles</th><th>Salles officielles</th><th>Plateaux candidats</th><th>Entrée / sortie</th></tr></thead><tbody id="rows"></tbody></table>
<script>const inventory=DATA;
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function links(ids){const td=document.createElement('td');for(const id of ids){if(!id)continue;const a=document.createElement('a');a.textContent=id;a.href='http://127.0.0.1:5184/?map='+id+'&benchmark=1';a.target='_blank';td.append(a)}if(!td.childNodes.length)td.textContent='Aucun identifié';return td}
function render(){const q=norm(document.querySelector('#search').value).trim(), mode=document.querySelector('#coverage').value;const selected=inventory.filter(d=>(mode==='all'||(mode==='found'?d.arenaCandidates.length:!d.arenaCandidates.length))&&norm([d.name,d.id,...d.subareas.map(s=>s.name),...d.roomMapIds,...d.arenaCandidates.map(a=>a.mapId)].join(' ')).includes(q));document.querySelector('#count').textContent=selected.length+' donjons affichés';const rows=document.querySelector('#rows');rows.replaceChildren();for(const d of selected){const tr=document.createElement('tr'),name=document.createElement('td'),zone=document.createElement('td');name.textContent=d.name+' · #'+d.id+' · niveau '+d.level;zone.textContent=d.subareas.map(s=>s.name+' (#'+s.id+')').join(', ')||'Aucun rattachement exporté';const arenas=links(d.arenaCandidates.map(a=>a.mapId));for(const a of arenas.querySelectorAll('a'))a.title=d.arenaCandidates.find(r=>String(r.mapId)===a.textContent).evidence;tr.append(name,zone,links(d.roomMapIds),arenas,links([...new Set([d.entranceMapId,d.exitMapId])]));rows.append(tr)}}document.querySelector('#search').addEventListener('input',render);document.querySelector('#coverage').addEventListener('change',render);render();</script>'''
    text = f"{summary['dungeons']} donjons · {summary['withArenaCandidates']} avec plateaux candidats · {summary['withoutArenaCandidates']} sans plateau candidat identifié"
    (out/'dungeons.html').write_text(page.replace('SUMMARY',html.escape(text)).replace('DATA',data))
    return summary

"""Build a reviewable, per-subarea inventory, not an official server pool config."""
import collections
import csv
import gzip
import html
import json
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'output/audits/official-combat-maps'
VISUAL = {153890816,153883648,153883906,153883908,153883910,153891074,153891076,153891078,
          158468098,54157650,237778950,237240579,208666630,55837188,119276039,88607748,88090890,88090892,88090894,88090896,88090898,154144769,197004296,239087873,189925377,189925379,189925381,189925383,189925385,189926915}
ID_GAP_THRESHOLD = 256
STRICT_ID_GAP_THRESHOLD = 4
DUNGEON_ID_GAP_THRESHOLD = 2048


def group_ids(rows, threshold=ID_GAP_THRESHOLD):
    """Group nearby IDs; this is a review signal, never an official pool."""
    ids = sorted(r['map_id'] for r in rows)
    if not ids:
        return []
    groups, current = [], [ids[0]]
    for map_id in ids[1:]:
        if map_id - current[-1] <= threshold:
            current.append(map_id)
        else:
            groups.append(current)
            current = [map_id]
    groups.append(current)
    by_id = {r['map_id']: r for r in rows}
    result = []
    for index, members in enumerate(groups, 1):
        gaps = [b - a for a, b in zip(members, members[1:])]
        result.append({
            'group_index': index,
            'map_ids': members,
            'size': len(members),
            'span': members[-1] - members[0],
            'gaps': gaps,
            'max_gap': max(gaps) if gaps else 0,
            'classification': ('tight_id_group' if threshold <= STRICT_ID_GAP_THRESHOLD else 'id_block') if len(members) >= 2 else 'isolated_id',
            'accepted_by_user_count': sum(by_id[mid]['association_status'] == 'accepted_by_user' for mid in members),
            'withheld_count': sum(by_id[mid]['association_status'] == 'rejected_by_user_for_this_zone' for mid in members),
            'visual_reviewed_count': sum(by_id[mid]['visually_reviewed'] for mid in members),
        })
    return result


def classify_group(group, zone, review):
    """Classify one ID family; exact manual reviews override subarea metadata."""
    members = sorted(group['map_ids'])
    for override in review.get('group_reviews', []):
        if sorted(override.get('map_ids', [])) == members:
            return {
                'bucket': override['bucket'],
                'bucket_confidence': override.get('confidence', 'review'),
                'bucket_source': override.get('source', 'Manual group review'),
                'bucket_dungeon_id': override.get('dungeon_id'),
                'bucket_dungeon_name': override.get('dungeon_name'),
            }
    if zone.get('dungeonId', -1) > 0:
        return {
            'bucket': 'dungeon',
            'bucket_confidence': 'metadata',
            'bucket_source': 'SubAreaData.dungeonId',
            'bucket_dungeon_id': zone.get('dungeonId'),
            'bucket_dungeon_name': None,
        }
    if zone.get('monsters'):
        if group['size'] == 1:
            return {
                'bucket': 'other',
                'bucket_confidence': 'heuristic',
                'bucket_source': 'ID isolé dans une sous-zone à monstres ; aucun pool de cartes associé.',
                'bucket_dungeon_id': None,
                'bucket_dungeon_name': None,
            }
        return {
            'bucket': 'zone',
            'bucket_confidence': 'metadata',
            'bucket_source': 'Suite d’IDs dans une sous-zone extérieure avec monstres',
            'bucket_dungeon_id': None,
            'bucket_dungeon_name': None,
        }
    return {
        'bucket': 'other',
        'bucket_confidence': 'metadata',
        'bucket_source': 'Aucune association donjon ou zone à monstres',
        'bucket_dungeon_id': None,
        'bucket_dungeon_name': None,
    }


def main():
    features = json.loads((OUT/'arena-features.json').read_text())
    metadata = {r['id']:r for r in json.loads((OUT/'mapsinformation.json').read_text())}
    zones = {r['id']:r for r in json.loads((OUT/'subareas.json').read_text())}
    dungeons = {r['id']:r for r in json.loads((OUT/'dungeons.json').read_text())}
    active = json.loads((ROOT/'.local/catalog/active-runtime.json').read_text())
    translation_path = ROOT/'.local/catalog/snapshots'/active['snapshot']/'i18n/fr.json.gz'
    with gzip.open(translation_path) as f:
        translations = json.load(f)['by_id']
    server_ids = {r['Id'] for r in json.loads((ROOT/'.local/map-topology-server.json').read_text())['maps']}
    reviews_path = OUT/'association-reviews.json'
    reviews = json.loads(reviews_path.read_text()) if reviews_path.exists() else {}
    withheld = []
    flags = metadata[153890816]['m_flags']
    candidates, unresolved, excluded = [], [], []
    for f in features['maps']:
        mid = f['map_id']; m = metadata.get(mid, {})
        tiles = f['tile_count'] >= 16
        closed = f['exit_cells'] == 0 and f['nonambient_props'] == 0
        same_flags = m.get('m_flags') == flags
        zero_coords = m.get('posX') == m.get('posY') == 0
        signals = {'repeated_floor_tiles': tiles, 'no_edge_exit': f['exit_cells'] == 0,
                   'no_resolved_interactive_props': f['nonambient_props'] == 0,
                   'zero_metadata_coordinates': zero_coords, 'flags_match_observed_arena': same_flags}
        row = {**f, 'subarea_id': m.get('subAreaId'), 'server_id_exists': mid in server_ids,
               'signals': signals, 'visually_reviewed': mid in VISUAL,
               'visual_assessment': 'atypical_blank_grid' if mid == 154144769 else 'arena_layout_match' if mid in VISUAL else 'not_reviewed'}
        if mid == 153890816:
            row['status'] = 'observed_in_official_fight'
        elif tiles and closed and zero_coords and same_flags:
            row['status'] = 'strong_candidate'
        elif tiles and f['exit_cells'] == 0 and (closed or zero_coords):
            row['status'] = 'review_candidate'
        elif same_flags and closed:
            row['status'] = 'unresolved_floor'; unresolved.append(row); continue
        elif tiles:
            row['status'] = 'excluded_from_shortlist'; excluded.append(row); continue
        else:
            continue
        review = reviews.get(str(row['subarea_id']), {})
        if mid in review.get('rejected_map_ids', []):
            row['association_status'] = 'rejected_by_user_for_this_zone'
            row['association_evidence'] = review
            withheld.append(row)
            continue
        row['association_status'] = 'accepted_by_user' if mid in review.get('accepted_map_ids', []) else 'metadata_only'
        candidates.append(row)
    by_zone = collections.defaultdict(list)
    for row in candidates:
        by_zone[row['subarea_id']].append(row)
    records = []
    known_zone_ids = set(zones) | {r['subAreaId'] for r in metadata.values()}
    for zid in sorted(known_zone_ids):
        zone = zones.get(zid, {})
        rows = sorted(by_zone[zid], key=lambda r:r['map_id'])
        dungeon = zone.get('dungeonId', -1) > 0
        monster_zone = bool(zone.get('monsters')) and not dungeon
        id_filter_applies = monster_zone and len(rows) >= 5
        id_gap_threshold = DUNGEON_ID_GAP_THRESHOLD if dungeon else ID_GAP_THRESHOLD
        # Every candidate is exposed in a group for review. The automatic
        # isolated-ID filter still applies only from five candidates onward.
        id_groups = group_ids(rows, id_gap_threshold) if rows else []
        strict_id_groups = group_ids(rows, STRICT_ID_GAP_THRESHOLD) if len(rows) >= 5 else []
        zone_review = reviews.get(str(zid), {})
        for group in id_groups:
            group.update(classify_group(group, zone, zone_review))
        # Once a subarea has enough candidates, isolated IDs are usually maps
        # from another special location sharing the same floor family. Keep
        # multi-map ID blocks as the automatic shortlist. Explicit evidence
        # (official observation, user acceptance, or a visual arena match)
        # overrides that heuristic so known valid singleton maps survive.
        grouped_ids = {mid for group in id_groups if group['size'] >= 2 for mid in group['map_ids']}
        retained_ids, review_ids, id_filtered_ids = [], [], []
        for row in rows:
            mid = row['map_id']
            explicit = (row['status'] == 'observed_in_official_fight'
                        or row['association_status'] == 'accepted_by_user'
                        or row['visual_assessment'] == 'arena_layout_match')
            if row['association_status'] == 'accepted_by_user' or row['status'] == 'observed_in_official_fight':
                retained_ids.append(mid)
            elif row['status'] == 'strong_candidate':
                # Dungeon maps use a different ID stride (usually +1024 or
                # +2048), so the outdoor singleton filter must not remove them.
                if not id_filter_applies or mid in grouped_ids or explicit:
                    retained_ids.append(mid)
                else:
                    id_filtered_ids.append(mid)
            elif row['status'] == 'review_candidate':
                review_ids.append(mid)
        dungeon_id = zone.get('dungeonId') if dungeon else None
        dungeon_data = dungeons.get(dungeon_id, {})
        records.append({'subarea_id':zid, 'name':translations.get(str(zone.get('nameId')),f'Sous-zone {zid}'),
            'area_id':zone.get('areaId'), 'dungeon_id':zone.get('dungeonId'),
            'dungeon_name':translations.get(str(dungeon_data.get('nameId'))) if dungeon_data else None,
            'category':'dungeon' if dungeon else 'monster_zone' if monster_zone else 'other',
            'status':'candidates_found' if rows else 'unresolved_floor' if any(r['subarea_id']==zid for r in unresolved) else 'no_candidate_identified',
            'candidate_count':len(rows), 'strong_count':sum(r['status'] in ('strong_candidate','observed_in_official_fight') for r in rows),
            'visually_reviewed_count':sum(r['visually_reviewed'] for r in rows),
            'user_accepted_count':sum(r['association_status']=='accepted_by_user' for r in rows),
            'withheld_map_ids':[r['map_id'] for r in withheld if r['subarea_id']==zid],
            'id_filter_applied':id_filter_applies,
            'id_grouping':(f'gap<={id_gap_threshold} (strict<=4 also recorded; dungeon stride)' if dungeon else 'gap<=256 (strict<=4 also recorded)') if id_groups else 'no_candidate',
            'id_groups':id_groups,
            'strict_id_groups':strict_id_groups,
            'retained_map_ids':retained_ids,
            'review_map_ids':review_ids,
            'id_filtered_map_ids':id_filtered_ids,
            'map_ids':[r['map_id'] for r in rows]})
    records_by_subarea = {record['subarea_id']: record for record in records}
    dungeon_writer = runpy.run_path(str(ROOT/'scripts/dungeon-inventory.py'))['write_inventory']
    dungeon_writer(OUT, dungeons, translations, records, metadata, candidates)
    group_by_map_id = {mid: group for zone in records for group in zone['id_groups'] for mid in group['map_ids']}
    combat_map_flags = []
    for row in sorted(candidates + withheld, key=lambda item: item['map_id']):
        zone = records_by_subarea.get(row['subarea_id'], {})
        retained = row['map_id'] in zone.get('retained_map_ids', [])
        explicitly_rejected = row['association_status'] == 'rejected_by_user_for_this_zone'
        needs_review = (row['map_id'] in zone.get('review_map_ids', [])
                        or row['map_id'] in zone.get('id_filtered_map_ids', []))
        if row['status'] == 'observed_in_official_fight':
            confidence = 'Confirmed'
        elif retained:
            confidence = 'Strong'
        else:
            confidence = 'Review'
        category = zone.get('category', 'other')
        map_group = group_by_map_id.get(row['map_id'], {})
        group_bucket = map_group.get('bucket', {'monster_zone':'zone', 'dungeon':'dungeon'}.get(category, 'other'))
        combat_map_type = ('Unknown' if explicitly_rejected else
            {'zone':'Classic', 'dungeon':'Dungeon', 'other':'Special'}.get(group_bucket, 'Special'))
        combat_map_flags.append({
            'mapId': row['map_id'],
            'isCombatMap': True if retained else None,
            'combatMapType': combat_map_type,
            'subAreaId': row['subarea_id'],
            'subAreaName': zone.get('name'),
            'dungeonId': map_group.get('bucket_dungeon_id') or (zone.get('dungeon_id') if group_bucket == 'dungeon' else None),
            'dungeonName': map_group.get('bucket_dungeon_name') or (zone.get('dungeon_name') if group_bucket == 'dungeon' else None),
            'groupBucket': group_bucket,
            'groupBucketConfidence': map_group.get('bucket_confidence'),
            'groupBucketSource': map_group.get('bucket_source'),
            'confidence': confidence,
            'decision': ('association_rejected' if explicitly_rejected else 'retained' if retained else
                         'review' if needs_review else 'candidate'),
            'candidateStatus': row['status'],
            'associationStatus': row['association_status'],
            'visuallyReviewed': row['visually_reviewed'],
            'serverMapExists': row['server_id_exists'],
            'signals': row['signals'],
        })
    summary = {'scanned_graphic_maps':len(features['maps']), 'scan_errors':features['errors'],
        'metadata_subareas':len(records), 'candidate_maps':len(candidates), 'withheld_associations':len(withheld),
        'retained_maps':sum(len(z['retained_map_ids']) for z in records),
        'retained_subareas':sum(bool(z['retained_map_ids']) for z in records),
        'review_maps':sum(len(z['review_map_ids']) for z in records),
        'id_filtered_maps':sum(len(z['id_filtered_map_ids']) for z in records),
        'subareas_with_id_filter':sum(bool(z['id_filtered_map_ids']) for z in records),
        'strong_candidates':sum(r['status']=='strong_candidate' for r in candidates),
        'officially_observed_maps':1, 'visually_reviewed_maps':len(VISUAL),
        'subareas_with_candidates':sum(bool(z['map_ids']) for z in records),
        'subareas_grouped_by_id':sum(bool(z['id_groups']) for z in records),
        'id_groups':sum(len(z['id_groups']) for z in records),
        'id_blocks':sum(sum(g['classification']=='id_block' for g in z['id_groups']) for z in records),
        'strict_id_groups':sum(len(z['strict_id_groups']) for z in records),
        'largest_id_group':max((g['size'] for z in records for g in z['id_groups']), default=0),
        'monster_subareas':sum(z['category']=='monster_zone' for z in records),
        'monster_subareas_with_candidates':sum(z['category']=='monster_zone' and bool(z['map_ids']) for z in records),
        'dungeon_candidate_maps':sum(len(by_zone[z['subarea_id']]) for z in records if z['category']=='dungeon'),
        'unresolved_floor_maps':len(unresolved), 'excluded_floor_maps':len(excluded),
        'unassigned_candidate_maps':len(by_zone[None]),
        'candidate_ids_existing_on_server':sum(r['server_id_exists'] for r in candidates)}
    result = {'summary':summary, 'seed':{'source_map_id':153880835,'fight_map_id':153890816,'subarea_id':450},
        'limitations':['Subarea membership does not prove official server pool assignment or random weighting.',
            'Only the seed has an official combat observation; visual and static matching are candidate signals.',
            'Floor variants were manually inspected; other assets or small/atypical arenas may be missed.',
            'Maps with nonambient props are review-only when coordinates are 0/0: a prop is not proof of a map exit. Unresolved props may be absent from this export.',
            'Server id existence does not validate cell topology or fight placement; no runtime config changed.'],
        'screenshot_layout_matches':{'88090892':'User Photo 2: Coin des Bouftous; visual layout match, no logged ID in that image.', '189925385':'User Photo 1: Champs d Astrub; visual layout match, no logged ID in that image.'},
        'floor_families':features['visually_checked_floor_families'],
        'association_reviews':reviews, 'withheld_associations':withheld,
        'zones':records,'candidates':candidates,'unresolved_floor_maps':unresolved,
        'excluded_floor_maps':excluded,'maps_without_subarea':[r['map_id'] for r in by_zone[None]]}
    (OUT/'arena-discovery.json').write_text(json.dumps(result,indent=2)+'\n')
    (OUT/'arena-discovery-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    flag_summary = {
        'total': len(combat_map_flags),
        'flagged_true': sum(row['isCombatMap'] is True for row in combat_map_flags),
        'flagged_false': sum(row['isCombatMap'] is False for row in combat_map_flags),
        'flagged_unknown': sum(row['isCombatMap'] is None for row in combat_map_flags),
        'by_type': dict(collections.Counter(row['combatMapType'] for row in combat_map_flags)),
        'by_confidence': dict(collections.Counter(row['confidence'] for row in combat_map_flags)),
    }
    (OUT/'combat-map-flags.json').write_text(json.dumps({
        'format': 'giny.combat-map-flags.v1',
        'summary': flag_summary,
        'semantics': {
            'isCombatMap_true': 'Retained by the static classifier or observed in an official fight.',
            'isCombatMap_false': 'Reserved for a map explicitly proven not to be a combat arena; none are emitted from association-only rejections.',
            'isCombatMap_null': 'Candidate requiring review or rejected only for the proposed zone association; no definitive negative conclusion.',
            'ownership': 'MapInformation.subAreaId -> SubAreaData.dungeonId. DungeonData identifies exact dungeon rooms, entrance, exit and boss but usually does not list detached combat arenas.',
        },
        'maps': combat_map_flags,
    }, indent=2, ensure_ascii=False)+'\n')
    with (OUT/'combat-map-flags.csv').open('w') as fp:
        fields = ['mapId','isCombatMap','combatMapType','subAreaId','subAreaName','dungeonId','dungeonName',
                  'groupBucket','groupBucketConfidence','groupBucketSource',
                  'confidence','decision','candidateStatus','associationStatus','visuallyReviewed','serverMapExists']
        writer = csv.DictWriter(fp, fieldnames=fields)
        writer.writeheader()
        writer.writerows({key: row[key] for key in fields} for row in combat_map_flags)
    (OUT/'arena-id-groups.json').write_text(json.dumps({
        'algorithm': {'max_gap': ID_GAP_THRESHOLD, 'strict_max_gap': STRICT_ID_GAP_THRESHOLD,
                      'dungeon_max_gap': DUNGEON_ID_GAP_THRESHOLD,
                      'applied_when_candidate_count_at_least': 5,
                      'meaning': 'Monster-zone primary groups use the 256-ID block pattern; dungeon groups use a 2048-ID stride to preserve +1024/+1536/+2048 sequences. Strict groups use <=4. The isolated-ID filter applies only to monster subareas outside dungeons; dungeon and other-category groups remain visible without that filter.'},
        'zones': {str(z['subarea_id']): {'name': z['name'], 'groups': z['id_groups'], 'strict_groups': z['strict_id_groups']} for z in records if z['id_groups']}
    }, indent=2, ensure_ascii=False)+'\n')
    with (OUT/'arena-zones.csv').open('w') as fp:
        writer=csv.DictWriter(fp,fieldnames=list(records[0]));writer.writeheader()
        writer.writerows({**r,'map_ids':' '.join(map(str,r['map_ids']))} for r in records)
    # Static report: names and IDs remain visible even without the local preview server.
    flags_by_id = {row['mapId']: row for row in combat_map_flags}
    details=json.dumps({r['map_id']:{'status':r['status'],'visual':r['visually_reviewed'],
        'server':r['server_id_exists'],'confidence':flags_by_id[r['map_id']]['confidence'],
        'type':flags_by_id[r['map_id']]['combatMapType']} for r in candidates})
    data=json.dumps(records,ensure_ascii=False).replace('<','\\u003c')
    body='''<!doctype html><meta charset="utf-8"><title>Inventaire des plateaux de combat</title>
<style>body{background:#141d25;color:#ecede8;font:16px system-ui;max-width:1700px;margin:32px auto;padding:0 24px}h1{font-size:30px}p{color:#b9c4cc;line-height:1.5}input,select{background:#233340;color:#fff;border:1px solid #6b8495;border-radius:5px;padding:12px;margin:5px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:14px 10px;border-bottom:1px solid #33434d;vertical-align:top}a{color:#91d7dd;display:inline-block;margin:2px 9px 2px 0}small{color:#aab5bd}.stats{font-size:22px;color:#f2db9e}th{position:sticky;top:0;background:#141d25}.map-group{background:#1c2933;border:1px solid #3a4b57;border-radius:7px;margin:0 0 8px;padding:7px 9px;min-width:190px}.map-group.review{border-color:#98783e}.map-group small{display:block;margin-top:4px}.empty{color:#71818c}</style>
<h1>Plateaux de combat — inventaire par sous-zone</h1>
<p><a href="zone-combat-maps.html">Voir les séries de cartes de zone hors donjons</a></p>
<p><a href="dungeons.html">Voir chaque donjon officiel et ses salles</a></p>
<p class="stats">SUMMARY</p>
<p><a href="arena-retained.html">Ouvrir uniquement les cartes retenues</a> · <a href="combat-map-flags.json">Télécharger les flags JSON</a> · <a href="combat-map-flags.csv">Télécharger les flags CSV</a></p>
<p>Recherche à partir de la carte 153890816 observée en combat. Les IDs ci-dessous sont des candidates, pas des pools officiels confirmés. Les donjons sont identifiés séparément. « Aucun identifié » ne signifie pas qu'aucun plateau n'existe.</p>
<p>Pour les sous-zones à monstres hors donjon avec au moins cinq candidates, les IDs sont regroupés par blocs de 256 maximum ; les groupes stricts (écart ≤ 4) sont conservés dans le JSON et les IDs isolés sont écartés de la vue retenue. Les donjons utilisent une séquence différente, souvent par pas de 1024 à 2048 ; les autres catégories peuvent aussi avoir leur propre logique. Leur filtre d'IDs isolés est donc désactivé et les candidates fortes restent visibles.</p>
<p>Chaque famille d’IDs est rangée dans DJ, Zone ou Autre. Dans une sous-zone à monstres, un ID isolé passe automatiquement dans Autre ; une suite reste dans Zone. Une bordure dorée et la mention « à confirmer » indiquent un classement heuristique ou manuel. Tous les IDs sont affichés par défaut et ouvrent le rendu local (Vite sur le port 5184).</p>
<input id="query" placeholder="Zone, sous-zone ou map ID…" size="40"><select id="category"><option value="">Toutes catégories</option><option value="monster_zone">Zones à monstres hors donjon</option><option value="dungeon">Donjons</option><option value="other">Autres zones</option></select><select id="coverage"><option value="found">Avec candidates</option><option value="all">Toutes les sous-zones</option><option value="missing">Sans candidate identifiée</option></select><select id="view"><option value="all">Toutes les candidates</option><option value="retained">Cartes retenues</option><option value="review">À revoir</option><option value="id_filtered">Écartées par filtre ID</option></select><div id="count"></div>
<table><thead><tr><th>Sous-zone</th><th>Statut</th><th>DJ</th><th>Zone</th><th>Autre</th></tr></thead><tbody id="rows"></tbody></table>
<script>const zones=DATA;const details=DETAILS;const labels={monster_zone:'Zone à monstres',dungeon:'Donjon',other:'Autre'};
function groupCell(z,bucket,shown){const td=document.createElement('td');for(const g of z.id_groups.filter(x=>x.bucket===bucket)){const ids=g.map_ids.filter(id=>shown.has(id));if(!ids.length)continue;const uncertain=['review','heuristic'].includes(g.bucket_confidence);const box=document.createElement('div');box.className='map-group'+(uncertain?' review':'');for(const id of ids){const a=document.createElement('a');a.href='http://127.0.0.1:5184/?map='+id+'&benchmark=1';const detail=details[id];a.textContent=id+(detail.status==='review_candidate'?' ⚑':'');a.title=detail.type+' · '+detail.confidence+' · '+detail.status+' · aperçu vérifié : '+detail.visual+' · ID serveur : '+detail.server;a.target='_blank';box.append(a)}const why=document.createElement('small');why.textContent=(uncertain?'à confirmer · ':'')+g.bucket_source;box.append(why);td.append(box)}if(!td.childElementCount){const empty=document.createElement('span');empty.className='empty';empty.textContent='—';td.append(empty)}return td}
function render(){const q=document.querySelector('#query').value.toLowerCase();const c=document.querySelector('#category').value;const mode=document.querySelector('#coverage').value;const view=document.querySelector('#view').value;const filtered=zones.filter(z=>(!c||z.category===c)&&(mode==='all'||(mode==='found'?z.candidate_count>0:z.candidate_count===0))&&[z.name,z.subarea_id,...z.map_ids].join(' ').toLowerCase().includes(q));document.querySelector('#count').textContent=filtered.length+' sous-zones';const tbody=document.querySelector('#rows');tbody.replaceChildren();for(const z of filtered){const tr=document.createElement('tr');const name=document.createElement('td');name.textContent=z.name+' · '+z.subarea_id+(z.dungeon_name?' · '+z.dungeon_name:'');const status=document.createElement('td');status.textContent=labels[z.category]+(z.dungeon_id>0?' #'+z.dungeon_id:'')+' · '+z.candidate_count+' candidates ('+z.strong_count+' fortes)'+(z.user_accepted_count?' · '+z.user_accepted_count+' validées par toi':'')+(z.withheld_map_ids.length?' · '+z.withheld_map_ids.length+' écartées de ce groupe':'')+(z.id_filtered_map_ids.length?' · '+z.id_filtered_map_ids.length+' écartées par filtre ID':'');const shownIds=view==='retained'?z.retained_map_ids:view==='review'?z.review_map_ids:view==='id_filtered'?z.id_filtered_map_ids:z.map_ids;const shown=new Set(shownIds);tr.append(name,status,groupCell(z,'dungeon',shown),groupCell(z,'zone',shown),groupCell(z,'other',shown));tbody.append(tr)}}for(const selector of ['#query','#category','#coverage','#view'])document.querySelector(selector).addEventListener('input',render);render();</script>'''
    body=body.replace('SUMMARY',f"{summary['retained_maps']} cartes retenues · {summary['retained_subareas']} sous-zones · {summary['review_maps']} à revoir · {summary['id_filtered_maps']} écartées par filtre ID · {summary['scanned_graphic_maps']} cartes analysées").replace('DATA',data).replace('DETAILS',details)
    ui_script = (ROOT/'scripts/combat-map-report-ui.js').read_text()
    body += '<script>' + ui_script + '</script>'
    (OUT/'arena-zones.html').write_text(body)
    # Exclude dungeon locations by exact IDs as well as subarea ownership.
    dungeon_exclusions = {mid for dungeon in dungeons.values()
                          for mid in [*dungeon.get('mapIds', []), dungeon.get('entranceMapId'), dungeon.get('exitMapId')]
                          if mid is not None}
    dungeon_exclusions.update(mid for zone in records for group in zone['id_groups']
                              if zone['category'] == 'dungeon' or group['bucket'] == 'dungeon'
                              for mid in group['map_ids'])
    outdoor_records = []
    candidate_by_id = {row['map_id']: row for row in candidates}
    for zone in records:
        if zone['category'] != 'monster_zone':
            continue
        members = [candidate_by_id[mid] for group in zone['id_groups'] if group['bucket'] == 'zone'
                   for mid in group['map_ids'] if mid not in dungeon_exclusions]
        groups = group_ids(members)
        groups = [g for g in groups if g['size'] >= 2]
        for group in groups:
            group.update(bucket='zone', bucket_confidence='heuristic',
                         bucket_source='Écarts successifs : '+', '.join('+'+str(gap) for gap in group['gaps'])+' ; attribution à la zone à confirmer')
        ids = [mid for group in groups for mid in group['map_ids']]
        if not ids:
            continue
        outdoor_records.append({**zone, 'id_groups':groups, 'map_ids':ids, 'candidate_count':len(ids),
                                **{key:[mid for mid in zone[key] if mid in ids]
                                   for key in ['retained_map_ids','review_map_ids','id_filtered_map_ids']}})
    outdoor_summary = {'subareas':len(outdoor_records),
                       'groups':sum(len(z['id_groups']) for z in outdoor_records),
                       'maps':sum(len(z['map_ids']) for z in outdoor_records)}
    (OUT/'zone-combat-maps.json').write_text(json.dumps({'summary':outdoor_summary,
        'rule':'Exclude official dungeon rooms, entrance/exit, dungeon subareas and groups provisionally classified as dungeon; keep ID chains with gap <=256 and at least two maps.',
        'zones':outdoor_records},ensure_ascii=False,indent=2)+'\n')
    outdoor_data = json.dumps(outdoor_records,ensure_ascii=False).replace('<','\\u003c')
    outdoor_body = body.replace(data, outdoor_data).replace('Plateaux de combat — inventaire par sous-zone',
        'Cartes de combat des zones — hors donjons')
    start = outdoor_body.index('<p class="stats">')
    end = outdoor_body.index('</p>',start)+4
    outdoor_body = outdoor_body[:start] + f'<p class="stats">{outdoor_summary["maps"]} cartes candidates · {outdoor_summary["groups"]} séries d’IDs · {outdoor_summary["subareas"]} sous-zones</p>' + outdoor_body[end:]
    outdoor_body += '<style>th:nth-child(3),td:nth-child(3),th:nth-child(5),td:nth-child(5){display:none}</style>'
    outdoor_body += '<script>document.querySelector("#category").closest("label").hidden=true;</script>'
    (OUT/'zone-combat-maps.html').write_text(outdoor_body)
    retained_html = ['<!doctype html><meta charset="utf-8"><title>Cartes de combat retenues</title>',
        '<style>body{background:#141d25;color:#ecede8;font:16px system-ui;max-width:1400px;margin:32px auto;padding:0 24px}h1{font-size:30px}p{color:#b9c4cc}.zone{border-top:1px solid #40515d;padding:16px 0}.zone h2{font-size:20px;margin:0 0 10px}.zone a{color:#91d7dd;display:inline-block;margin:4px 12px 4px 0}</style>',
        f'<h1>Cartes de combat retenues</h1><p>{summary["retained_maps"]} cartes dans {summary["retained_subareas"]} sous-zones. Chaque ID ouvre le rendu local.</p><p><a href="arena-zones.html">Retour à l’inventaire complet</a></p>']
    for zone in records:
        if not zone['retained_map_ids']:
            continue
        links = ' '.join(f'<a href="http://127.0.0.1:5184/?map={mid}&benchmark=1" target="_blank">{mid}</a>' for mid in zone['retained_map_ids'])
        retained_html.append(f'<section class="zone"><h2>{html.escape(zone["name"])} · sous-zone {zone["subarea_id"]}</h2><div>{links}</div></section>')
    (OUT/'arena-retained.html').write_text(''.join(retained_html))
    print(json.dumps(summary,indent=2))


if __name__=='__main__':
    main()

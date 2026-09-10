import { catalogJson } from './catalogSource'
import { useEffect, useMemo, useState } from 'react'
import type { CharacterHud } from '../../giny/types'
import type { BindingResolver } from '../official/types'
import type { Repeater, RepeaterItem } from '../official/repeaters'
import { itemIcon } from './catalog'

type RecordRow = { id: number; nameId?: number; name?: string; [key: string]: unknown }
export type Monster = RecordRow & { look: string; race: number; subareas: number[]; grades: { level: number }[]; drops: { objectId: number; hasCriterions?: number; criterions?: string }[] }
export type EncyclopediaItem = RecordRow & { typeId: number; iconId: number; level: number }
type Territory = RecordRow & { areaId: number; mapIds: number[] }
type Data = { monsters: Monster[]; items: EncyclopediaItem[]; races: Record<string, RecordRow>; types: Record<string, RecordRow>; areas: Record<string, RecordRow>; worlds: Record<string, RecordRow>; territories: Territory[] }
export const ENCYCLOPEDIA_TABS = ['Bestiaire', 'Équipements', 'Consommables', 'Ressources', 'Cosmétique']
export const ITEM_CATEGORIES = [0, 1, 2, 5] as const
const LOOT_CATEGORIES: Record<string, number> = { tgl_questItems: 3, tgl_equipments: 0, tgl_consumables: 1, tgl_resources: 2, tgl_cosmetics: 5 }
const LIMIT = 40
let pending: Promise<Data> | undefined
async function table<T>(file: string): Promise<Record<string, T>> {
  return catalogJson<Record<string, T>>(`/game-data/data/${file}.json`)
}
export function loadEncyclopediaData(): Promise<Data> {
  return pending ??= Promise.all([table<Monster>('monsters'), table<EncyclopediaItem>('items'), table<RecordRow>('monsterraces'), table<RecordRow>('itemtypes'), table<Territory>('subareas'), table<RecordRow>('areas'), table<RecordRow>('superareas'), catalogJson<{ by_id?: Record<string, string> }>('/game-data/client/i18n.json')])
    .then(([monsters, items, races, types, territories, areas, worlds, i18n]) => {
      const name = <T extends RecordRow>(row: T): T => ({ ...row, name: i18n.by_id?.[String(row.nameId)] ?? row.name ?? `#${row.id}` })
      return { areas: Object.fromEntries(Object.entries(areas).map(([id,row])=>[id,name(row)])), worlds: Object.fromEntries(Object.entries(worlds).map(([id,row])=>[id,name(row)])), monsters: Object.values(monsters).map(name), items: Object.values(items).map(name), territories: Object.values(territories).map(name), races: Object.fromEntries(Object.entries(races).map(([id, row]) => [id, name(row)])), types: Object.fromEntries(Object.entries(types).map(([id, row]) => [id, name(row)])) }
    }).catch(error => { pending = undefined; throw error })
}
export function filterMonsters(rows: Monster[], search: string, territory: number | null, race: number | null): Monster[] {
  const query = search.trim().toLocaleLowerCase('fr')
  return rows.filter(row => (!query || row.name?.toLocaleLowerCase('fr').includes(query)) && (territory == null || row.subareas.includes(territory)) && (race == null || row.race === race))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'fr'))
}

/** C# AddTab/OpenTab/SetData controller. Every visible body and row is an
 * extracted VisualTreeAsset; only the runtime controls have shared adapters. */
export function useEncyclopedia(active: boolean, hud: CharacterHud | null) {
  const [data, setData] = useState<Data>()
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)
  const [search, setSearch] = useState('')
  const [territory, setTerritory] = useState<number | null>(null)
  const [maxLevel, setMaxLevel] = useState<number | null>(null)
  const [region, setRegion] = useState<number | null>(null)
  const [world, setWorld] = useState<number | null>(null)
  const [resistance, setResistance] = useState<number | null>(null)
  const [itemType, setItemType] = useState<number | null>(null)
  const [race, setRace] = useState<number | null>(null)
  const [expanded, setExpanded] = useState('territoryFilter')
  const [conditional, setConditional] = useState(true)
  const [hiddenLoot, setHiddenLoot] = useState<number[]>([])
  const [page, setPage] = useState(0)
  const [sortLevel, setSortLevel] = useState(false)
  useEffect(() => {
    if (!active || data) return
    let alive = true
    void loadEncyclopediaData().then(value => { if (alive) setData(value) }).catch(e => { if (alive) setError(String(e.message)) })
    return () => { alive = false }
  }, [active, data])
  const current = useMemo(() => data?.territories.find(row => row.mapIds.includes(hud?.map.id ?? -1))
    ?? data?.territories.find(row => row.name === hud?.map.subarea_name)
    ?? data?.territories.find(row => row.id === hud?.map.subarea_id), [data, hud?.map.id, hud?.map.subarea_id, hud?.map.subarea_name])
  useEffect(() => { if (current) setTerritory(current.id) }, [current])
  useEffect(() => { setPage(0) }, [search, territory, race, tab])
  const itemById = useMemo(() => new Map(data?.items.map(item => [item.id, item])), [data])
  const territoryById = useMemo(() => new Map(data?.territories.map(area => [area.id, area])), [data])
  const { monsters, items, total, category } = useMemo(() => {
    const monsters = filterMonsters(data?.monsters ?? [], search, territory, race).filter(row => {
      if (maxLevel != null && Math.min(...row.grades.map(grade=>grade.level)) > maxLevel) return false
      if (resistance != null && !row.grades.some(grade => Number((grade as unknown as Record<string, number>)[['neutralResistance','earthResistance','fireResistance','waterResistance','airResistance'][resistance]]) < 0)) return false
      if (region != null && !row.subareas.some(id => territoryById.get(id)?.areaId === region)) return false
      if (world != null && !row.subareas.some(id => data?.areas[territoryById.get(id)?.areaId ?? -1]?.superAreaId === world)) return false
      return true
    })
    if (sortLevel) monsters.sort((a,b) => Math.min(...a.grades.map(g=>g.level)) - Math.min(...b.grades.map(g=>g.level)))
    const category = ITEM_CATEGORIES[tab - 1]
    const items = (data?.items ?? []).filter(item => data?.types[item.typeId]?.categoryId === category && !!data?.types[item.typeId]?.isInEncyclopedia && (itemType == null || item.typeId === itemType) && (maxLevel == null || item.level <= maxLevel) && (!search || item.name?.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))))
    items.sort(sortLevel ? (a,b)=>a.level-b.level : (a,b)=>(a.name ?? '').localeCompare(b.name ?? '', 'fr'))
    const total = tab === 0 ? monsters.length : items.length
    return { monsters, items, total, category }
  }, [data, search, territory, race, maxLevel, resistance, region, world, sortLevel, tab, itemType, territoryById])
  return useMemo(() => {
    const reset = () => { setTerritory(null); setRace(null); setRegion(null); setWorld(null); setMaxLevel(null); setResistance(null); setItemType(null); setSearch(''); setPage(0) }
    const changeSearch = (value: string) => { setSearch(value); setPage(0) }
    const baseResolve: BindingResolver = binding => {
      if (binding === 'tabs') return { style: { flexDirection: 'row', justifyContent: 'center' } }
      if (binding === 'uiCtr') return { style: { flex: 1, minHeight: 0, overflow: 'hidden' } }
      return undefined
    }
    const resolve: BindingResolver = binding => {
      if (binding === 'sidePanel') return { style: { flexShrink: 0, height: '100%' } }
      if (binding in LOOT_CATEGORIES) return { checked: !hiddenLoot.includes(LOOT_CATEGORIES[binding]), onClick: () => setHiddenLoot(previous => previous.includes(LOOT_CATEGORIES[binding]) ? previous.filter(id => id !== LOOT_CATEGORIES[binding]) : [...previous, LOOT_CATEGORIES[binding]]) }
      if (binding === 'inp_search') return { text: search, placeholder: 'Rechercher', onInput: event => changeSearch(event.target.value) }
      if (binding === 'btn-resetFilters') return { onClick: reset }
      if (binding === 'btn_resetCurrentSubarea') return { hidden: tab !== 0, text: 'Monstres du territoire', onClick: () => { setTerritory(current?.id ?? null); setSearch('') } }
      if (binding === 'lbl_noResult') return { hidden: total > 0, text: error || (!data ? 'Chargement du catalogue…' : 'Aucun élément ne correspond à votre recherche') }
      if (binding === 'ctr_noResult') return { hidden: total > 0 }
      if (binding === 'lbl_searchResultCount' || binding === 'nbOfItems') return { text: `${total} élément(s) correspondant à vos critères${total > LIMIT ? ` · Page ${page + 1}/${Math.ceil(total / LIMIT)} · Suivante ›` : ''}`, onClick: total > LIMIT ? () => setPage(value => (value + 1) % Math.ceil(total / LIMIT)) : undefined }
      if (binding === 'chbx_displayConditionalLoot') return { checked: conditional, onClick: () => setConditional(value => !value) }
      if (binding === 'chbx_displayMatchedCriterions') return { disabled: true, tooltip: { tree: 'TextTooltip', text: 'Le serveur ne fournit pas encore l’éligibilité aux conditions de butin.' } }
      if (binding === 'tch_level') return { onClick: () => setSortLevel(value => !value) }
      if (binding === 'tch_name') return { onClick: () => setSortLevel(false) }
      if (binding === 'btn_searchFilter') return { onClick: () => setExpanded(value => value ? '' : 'territoryFilter') }
      if (binding === 'tx_filterOn') return { hidden: territory == null && race == null }
      if (binding.startsWith('filters')) return { hidden: binding !== ['filtersEquipment','filtersConsumables','filtersResources','filtersCosmetics'][tab - 1], style: { height: '100%', flexShrink: 0 } }
      if (binding === 'gd_list') return { style: { overflowY: 'auto', flex: 1, minHeight: 0 } }
      return undefined
    }
    const filters: Repeater = {}
    for (const [host, title] of Object.entries({ levelFilter: 'Niveau', monsterTypeFilter: 'Catégories', resistanceFilter: 'Résistances', superAreaFilter: 'Monde', areaFilter: 'Région', territoryFilter: 'Territoires' })) {
      const selected = host === 'levelFilter' ? maxLevel : host === 'resistanceFilter' ? resistance : host === 'superAreaFilter' ? world : host === 'areaFilter' ? region : host === 'territoryFilter' ? territory : tab === 0 ? race : itemType
      const choose = (id: number) => { setPage(0); const value = selected === id ? null : id
        if (host === 'levelFilter') setMaxLevel(value)
        else if (host === 'resistanceFilter') setResistance(value)
        else if (host === 'superAreaFilter') { setWorld(value); setRegion(null); setTerritory(null) }
        else if (host === 'areaFilter') { setRegion(value); setTerritory(null) }
        else if (host === 'territoryFilter') setTerritory(value)
        else if (tab === 0) setRace(value); else setItemType(value)
      }
      const choices: RecordRow[] = host === 'levelFilter' ? [20,50,100,150,200].map(id=>({id,name: `Niveau ≤ ${id}`}))
        : host === 'resistanceFilter' ? ['Neutre','Terre','Feu','Eau','Air'].map((name,id)=>({id,name: `Faiblesse ${name}`}))
        : host === 'superAreaFilter' ? Object.values(data?.worlds ?? {})
        : host === 'areaFilter' ? Object.values(data?.areas ?? {}).filter(row=>world == null || row.superAreaId === world)
        : host === 'territoryFilter' ? data?.territories.filter(row => region != null ? row.areaId === region : world != null ? data?.areas[row.areaId]?.superAreaId === world : !current || row.areaId === current.areaId) ?? []
        : Object.values(tab === 0 ? data?.races ?? {} : data?.types ?? {}).filter(row=>tab === 0 || row.categoryId === category)
      const hidden = tab !== 0 && !['levelFilter','monsterTypeFilter'].includes(host)
      filters[host] = [{ key: host, template: 'GenericFilterCategory', resolve: binding => {
        if (binding === 'filter') return { hidden }
        if (binding === 'filter_header') return { onClick: () => setExpanded(value => value === host ? '' : host) }
        if (binding === 'filter_title') return { text: title.toUpperCase() }
        if (binding === 'filter_toggle') return { text: expanded === host ? '−' : '+' }
        if (binding === 'filter_options') return { hidden: expanded !== host }
        if (binding === 'filter_hint') return { text: choices.length ? '' : data ? 'Aucun choix disponible' : 'Chargement…', hidden: choices.length > 0 }
        return undefined
      }, repeaters: { filter_choices: choices.map(row => ({ key: String(row.id), template: 'FilterChoice', resolve: binding => {
        if (binding === 'choice_label') return { text: row.name }
        if (binding === 'choice') return { checked: selected === row.id, onClick: () => choose(row.id) }
        return undefined
      } })) } }]
    }
    const rows: RepeaterItem[] = tab === 0 ? monsters.slice(page * LIMIT, (page + 1) * LIMIT).map(monster => ({
      key: String(monster.id), template: 'bestiaryTabItem', resolve: binding => {
        if (binding === 'parentLoots') return { style: { gap: 4, alignItems: 'center', alignContent: 'center', flexWrap: 'nowrap' } }
        if (binding === 'lbl_monsterName') return { text: monster.name }
        if (binding === 'lbl_monsterRace') return { text: data?.races[monster.race]?.name }
        if (binding === 'lbl_monsterLevel') { const levels = monster.grades.map(g=>g.level); return { text: `${Math.min(...levels)} à ${Math.max(...levels)}` } }
        if (binding === 'tx_monster') return { look: monster.look, lookMode: 'fit' }
        if (['tx_aggro','tx_category','tx_bounty','btn_linkTo'].includes(binding)) return { hidden: true }
        if (binding === 'btn_monsterLocation') return { tooltip: { tree: 'TextTooltip', text: monster.subareas.map(id => data?.territories.find(row=>row.id===id)?.name).filter(Boolean).join(', ') } }
        return undefined
      }, repeaters: { parentLoots: monster.drops.filter(drop => (conditional || !drop.hasCriterions) && !hiddenLoot.includes(Number(data?.types[itemById.get(drop.objectId)?.typeId ?? -1]?.categoryId))).map((drop,index)=>({ key: `${drop.objectId}-${index}`, template: 'EncyclopediaLootSlot', resolve: binding => {
        if (binding !== 'loot_slot') return undefined
        const item = itemById.get(drop.objectId)
        return { sprite: itemIcon({ gid: drop.objectId, icon_id: item?.iconId }), style: { outline: drop.hasCriterions ? '1px solid #f0cf5b' : undefined }, tooltip: { tree: 'TextTooltip', text: `${item?.name ?? drop.objectId}${drop.hasCriterions ? ' · Butin conditionné' : ''}` } }
      } })) },
    })) : items.slice(page * LIMIT, (page + 1) * LIMIT).map(item => ({ key: String(item.id), template: 'encyclopediaItem', resolve: binding => {
      if (binding === 'lbl_name') return { text: item.name }
      if (binding === 'tx_itemIcon') return { sprite: itemIcon({ gid: item.id, icon_id: item.iconId }) }
      if (binding === 'lbl_type') return { text: data?.types[item.typeId]?.name }
      if (binding === 'lbl_level') return { text: String(item.level) }
      if (binding === 'lbl_price') return { text: '—' }
      if (binding === 'ctr_obtaining' || binding === 'btn_inSet') return { hidden: true }
      return undefined
    } }))
    return { resolve: baseResolve, repeaters: {
      tabs: ENCYCLOPEDIA_TABS.map((label,index)=>({ key: String(index), template: 'DofusTab', resolve: binding => binding === 'tab_label' ? { text: label.toUpperCase() } : binding === '' ? { checked: tab === index, className: `large ${tab === index ? 'activeTrue' : 'activeFalse'}`, onClick: () => { setTab(index); setSearch(''); setItemType(null); setExpanded(index === 0 ? 'territoryFilter' : 'monsterTypeFilter'); setPage(0) } } : undefined })),
      uiCtr: [{ key: `encyclopedia-${tab}`, template: tab === 0 ? 'bestiaryTab' : 'encyclopediaList', resolve, repeaters: { ...filters, ...(tab === 0 ? {} : { [['filtersEquipment','filtersConsumables','filtersResources','filtersCosmetics'][tab-1]]: [{ key: 'item-filters', template: 'bestiaryTab#sidePanel', resolve, repeaters: filters }] }), gd_list: rows } }],
    } satisfies Repeater }
  }, [data, error, tab, search, territory, race, expanded, conditional, page, current, sortLevel, maxLevel, resistance, region, world, itemType, hiddenLoot, monsters, items, total, itemById, category])
}

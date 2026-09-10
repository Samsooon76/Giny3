import { catalogJson, resetCatalogSources } from './catalogSource'
import { joinQuestObjectives } from './questData'
/** Read-only Dofus 3 catalogue: DataRoot id → picto 1x. Never builds a URL. */

import { decodePattern, effectPatternParams } from './patternDecoder'

export type CatalogItem = {
  id: number
  iconId: number
  name?: string
  description?: string
  picto?: string
  realWeight?: number
  typeId?: number
  criteria?: string
  itemSetId?: number
  possibleEffects?: CatalogEffectInstance[]
}

export type CatalogAchievement = {
  id: number
  iconId: number
  name?: string
  description?: string
  categoryId?: number
  points?: number
  order?: number
  picto?: string
}

export type CatalogCategory = {
  id: number
  name?: string
  parentId?: number
  achievementIds?: number[]
  /** DisplayOrderDataRoot / AchievementCategoryDataRoot order field. */
  order?: number
  picto?: string
}

export type CatalogJob = {
  id: number
  iconId?: number
  name?: string
  picto?: string
}

export type CatalogRecipe = {
  resultId: number
  name?: string
  resultLevel?: number
  jobId?: number
  ingredientIds?: number[]
  quantities?: number[]
}

export type CatalogQuest = {
  id: number
  name?: string
  categoryId?: number
  levelMin?: number
  levelMax?: number
  isDungeonQuest?: boolean | number
  isPartyQuest?: boolean | number
  repeatType?: number
  followable?: boolean | number
}

/** ``QuestCategoriesDataRoot`` / ``QuestCategoryData``. Header rows on
    encyclopaedia ``lv_questList`` keep UXML ``.category``; stamp the name only. */
export type CatalogQuestCategory = {
  id: number
  name?: string
  order?: number
  questIds?: number[]
}

export type CatalogSpell = {
  id: number
  scriptId?: number
  scriptIdCritical?: number
  boundScriptUsageData?: Array<{ scriptId: number; order?: number; spellLevels?: number[]; criterion?: string; targetMask?: string; casterMask?: string; targetZone?: string }>
  criticalHitBoundScriptUsageData?: Array<{ scriptId: number; order?: number; spellLevels?: number[]; criterion?: string; targetMask?: string; casterMask?: string; targetZone?: string }>
  iconId?: number
  name?: string
  description?: string
  picto?: string
}

export type CatalogEffectInstance = {
  zoneDescr?: { shape: number; param1: number; param2: number; damageDecreaseStepPercent?: number; maxDamageDecreaseApplyCount?: number; isStopAtTarget?: number }
  rawZone?: string
  targetMask?: string
  effectId: number
  value?: number
  diceNum?: number
  diceSide?: number
  duration?: number
}

export type CatalogSpellLevel = {
  playAnimation?: boolean
  id: number
  spellId: number
  grade: number
  apCost?: number
  minRange?: number
  range?: number
  criticalHitProbability?: number
  maxCastPerTurn?: number
  maxCastPerTarget?: number
  minCastInterval?: number
  castInDiagonal?: boolean
  castInLine?: boolean
  castTestLos?: boolean
  effects?: CatalogEffectInstance[]
  criticalEffect?: CatalogEffectInstance[]
}

export type CatalogEffect = {
  id: number
  descriptionId?: number
  description?: string
  characteristic?: number
  useDice?: number
  showInTooltip?: number
}

export type CatalogCharacteristic = {
  id: number
  keyword?: string
  nameId?: number
  name?: string
  asset?: string
}

export type CatalogWorldmap = {
  id: number
  nameId?: number
  name?: string
  width?: number
  height?: number
  origineX?: number
  origineY?: number
  mapWidth?: number
  mapHeight?: number
  totalWidth?: number
  totalHeight?: number
  /** Zoom steps the bundle actually ships tiles for, largest first. */
  zoom?: number[]
  minScale?: number
  maxScale?: number
  startScale?: number
  /** 0 for a world map the official picker does not list (dungeon interiors). */
  visibleOnMap?: number
}

/** One `hints.json` pin: a place the official world map paints on the
    parchment. `gfx` names a sprite of `uidarkstone_assets_all`, `x` / `y` are
    map coordinates and `categoryId` is what the filter checkboxes switch. */
export type CatalogHint = {
  id: number
  categoryId: number
  gfx: number
  nameId?: number
  name?: string
  mapId?: number
  x: number
  y: number
  subareaId?: number
  worldMapId: number
  level?: number
}

export type CatalogHintCategory = {
  id: number
  nameId?: number
  name?: string
}

export type CatalogOrnament = {
  id: number
  assetId?: number
  name?: string
  picto?: string
  order?: number
}

export type CatalogTitle = {
  id: number
  name?: string
}

export type CatalogSpellVariant = {
  id: number
  breedId: number
  spellIds: number[]
}

/** SpellLevelsDataRoot.minPlayerLevel, ordered by grade. Zero is omitted. */
export type CatalogSpellObtention = {
  id: number
  minPlayerLevels: number[]
}

/** First ``QuestData.stepIds`` step, formatted via type nameId + PatternDecoder. */
export type CatalogQuestObjective = {
  id: number
  text: string
}

export type CatalogQuestObjectives = {
  id: number
  stepId?: number
  /** First-step ``QuestStepData.descriptionId``. Encyclopaedia ``#lbl_questDescription``. */
  description?: string
  objectives: CatalogQuestObjective[]
}

type SpriteMap = Record<string, string>

export type CatalogSubarea = { id: number; areaId: number; worldmapId?: number }
export type CatalogArea = { id: number; superAreaId: number; worldmapId?: number }
export type CatalogSuperarea = { id: number; worldmapId?: number }

let itemsById: Record<string, CatalogItem> = {}
let achievementsById: Record<string, CatalogAchievement> = {}
let categoriesById: Record<string, CatalogCategory> = {}
let jobsById: Record<string, CatalogJob> = {}
let recipesById: Record<string, CatalogRecipe> = {}
let questsById: Record<string, CatalogQuest> = {}
let questCategoriesById: Record<string, CatalogQuestCategory> = {}
let spellsById: Record<string, CatalogSpell> = {}
let ornamentsById: Record<string, CatalogOrnament> = {}
let titlesById: Record<string, CatalogTitle> = {}
let breedSpells: Record<string, CatalogSpell[]> = {}
let spellVariantsById: Record<string, CatalogSpellVariant> = {}
let spellObtentionById: Record<string, CatalogSpellObtention> = {}
let questObjectivesById: Record<string, CatalogQuestObjectives> = {}
let sprites: Record<string, SpriteMap> = {}
let uiStrings: Record<string, string> = {}
let effectsById: Record<string, CatalogEffect> = {}
let spellLevelsBySpell: Record<string, CatalogSpellLevel[]> = {}
let spellLevelsById: Record<string, CatalogSpellLevel> = {}
let catalogLoads = new WeakMap<typeof fetch, Map<CatalogGroup, Promise<void>>>()
let characteristicsById: Record<string, CatalogCharacteristic> = {}
let characteristicsByKeyword: Record<string, CatalogCharacteristic> = {}
let worldmapsById: Record<string, CatalogWorldmap> = {}
let subareasById: Record<string, CatalogSubarea> = {}
let areasById: Record<string, CatalogArea> = {}
let superareasById: Record<string, CatalogSuperarea> = {}
let hintsById: Record<string, CatalogHint> = {}
let hintsByWorldmap: Record<string, CatalogHint[]> = {}
let hintCategoriesById: Record<string, CatalogHintCategory> = {}

export function resetCatalog(): void {
  catalogLoads = new WeakMap()
  resetCatalogSources()
  itemsById = {}
  achievementsById = {}
  categoriesById = {}
  jobsById = {}
  recipesById = {}
  questsById = {}
  questCategoriesById = {}
  spellsById = {}
  ornamentsById = {}
  titlesById = {}
  breedSpells = {}
  spellVariantsById = {}
  spellObtentionById = {}
  questObjectivesById = {}
  sprites = {}
  uiStrings = {}
  effectsById = {}
  spellLevelsBySpell = {}
  spellLevelsById = {}
  characteristicsById = {}
  characteristicsByKeyword = {}
  worldmapsById = {}
  subareasById = {}
  areasById = {}
  superareasById = {}
  hintsById = {}
  hintsByWorldmap = {}
  hintCategoriesById = {}
  bumpCatalog()
}

export function hydrateCatalog(payload: {
  items?: Record<string, CatalogItem>
  achievements?: Record<string, CatalogAchievement>
  categories?: Record<string, CatalogCategory>
  jobs?: Record<string, CatalogJob>
  recipes?: Record<string, CatalogRecipe>
  quests?: Record<string, CatalogQuest>
  questCategories?: Record<string, CatalogQuestCategory>
  spells?: Record<string, CatalogSpell>
  ornaments?: Record<string, CatalogOrnament>
  titles?: Record<string, CatalogTitle>
  breedSpells?: Record<string, CatalogSpell[]>
  spellVariants?: Record<string, CatalogSpellVariant>
  spellObtention?: Record<string, CatalogSpellObtention>
  questObjectives?: Record<string, CatalogQuestObjectives>
  pictos?: Record<string, SpriteMap>
  uiStrings?: Record<string, string>
  effects?: Record<string, CatalogEffect>
  spellLevels?: Record<string, CatalogSpellLevel>
  characteristics?: Record<string, CatalogCharacteristic>
  worldmaps?: Record<string, CatalogWorldmap>
  subareas?: Record<string, CatalogSubarea>
  areas?: Record<string, CatalogArea>
  superareas?: Record<string, CatalogSuperarea>
  hints?: Record<string, CatalogHint>
  hintCategories?: Record<string, CatalogHintCategory>
}): void {
  if (payload.items) itemsById = payload.items
  if (payload.achievements) achievementsById = payload.achievements
  if (payload.categories) categoriesById = payload.categories
  if (payload.jobs) jobsById = payload.jobs
  if (payload.recipes) recipesById = payload.recipes
  if (payload.quests) questsById = payload.quests
  if (payload.questCategories) questCategoriesById = payload.questCategories
  if (payload.spells) spellsById = payload.spells
  if (payload.ornaments) ornamentsById = payload.ornaments
  if (payload.titles) titlesById = payload.titles
  if (payload.breedSpells) breedSpells = payload.breedSpells
  if (payload.spellVariants) spellVariantsById = payload.spellVariants
  if (payload.spellObtention) spellObtentionById = payload.spellObtention
  if (payload.questObjectives) questObjectivesById = payload.questObjectives
  if (payload.pictos) sprites = payload.pictos
  if (payload.uiStrings) uiStrings = payload.uiStrings
  if (payload.effects) effectsById = payload.effects
  if (payload.spellLevels) {
    spellLevelsBySpell = {}
    spellLevelsById = payload.spellLevels
    for (const row of Object.values(payload.spellLevels)) {
      spellLevelsById[String(row.id)] = row
      const list = spellLevelsBySpell[String(row.spellId)] ?? []
      list.push(row)
      spellLevelsBySpell[String(row.spellId)] = list
    }
    for (const list of Object.values(spellLevelsBySpell)) {
      list.sort((a, b) => a.grade - b.grade)
    }
  }
  if (payload.characteristics) {
    characteristicsById = payload.characteristics
    characteristicsByKeyword = {}
    for (const row of Object.values(payload.characteristics)) {
      if (row.keyword) characteristicsByKeyword[row.keyword] = row
    }
  }
  if (payload.worldmaps) worldmapsById = payload.worldmaps
  if (payload.subareas) subareasById = payload.subareas
  if (payload.areas) areasById = payload.areas
  if (payload.superareas) superareasById = payload.superareas
  if (payload.hintCategories) hintCategoriesById = payload.hintCategories
  if (payload.hints) {
    hintsById = payload.hints
    hintsByWorldmap = {}
    for (const hint of Object.values(payload.hints)) {
      const key = String(hint.worldMapId)
      const list = hintsByWorldmap[key] ?? []
      list.push(hint)
      hintsByWorldmap[key] = list
    }
  }
  bumpCatalog()
}

let catalogGenerationValue = 0
const catalogListeners = new Set<() => void>()

function bumpCatalog(): void {
  catalogGenerationValue++
  for (const listener of catalogListeners) listener()
}

export function subscribeCatalog(listener: () => void): () => void {
  catalogListeners.add(listener)
  return () => { catalogListeners.delete(listener) }
}

export function catalogGeneration(): number {
  return catalogGenerationValue
}

export function uiString(key: string): string | undefined { return uiStrings[key] }

/** DataRoot dumps are a flat id → record map; a few hand-built tables wrap
    that in `{ by_id }`. Either shape is a catalogue. */
export function tableRecords<T>(payload: unknown): Record<string, T> | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const record = payload as { by_id?: unknown }
  if (record.by_id && typeof record.by_id === 'object') {
    return record.by_id as Record<string, T>
  }
  return payload as Record<string, T>
}

const NAME_ID_FIELDS: Array<[string, 'name' | 'description']> = [
  ['nameId', 'name'],
  ['descriptionId', 'description'],
  ['resultNameId', 'name'],
  ['nameMaleId', 'name'],
]

/** Stamp `name` / `description` from I18n `by_id[nameId]`. Leaves an already
    present caption alone, and skips ids the table does not know. */
export function stampNames<T>(
  table: Record<string, T> | undefined,
  byId: Record<string, string> | undefined,
): Record<string, T> | undefined {
  if (!table) return table
  if (!byId) return table
  const out: Record<string, T> = {}
  for (const [id, row] of Object.entries(table)) {
    const rec = row as Record<string, unknown>
    const extra: Record<string, string> = {}
    for (const [idField, textField] of NAME_ID_FIELDS) {
      if (rec[textField]) continue
      const raw = rec[idField]
      if (typeof raw !== 'number' && typeof raw !== 'string') continue
      const text = byId[String(raw)]
      if (text) extra[textField] = text
    }
    out[id] = Object.keys(extra).length ? { ...row, ...extra } as T : row
  }
  return out
}

/** Named-index ``{0}`` fill. Returns undefined when the key is missing so
    callers do not invent French copy. */
export function uiFormat(key: string, ...args: Array<string | number>): string | undefined {
  const template = uiStrings[key]
  if (template == null) return undefined
  return template.replace(/\{(\d+)\}/g, (_, index) => String(args[Number(index)] ?? ''))
}

function pictoUrl(kind: string, name: string): string | undefined {
  const file = sprites[kind]?.[name]
  if (!file) return undefined
  if (file.startsWith('/')) return file
  return `/game-data/pictos/${kind}/${file}`
}

function gameDataUrl(picto?: string): string | undefined {
  return picto ? `/game-data/${picto}` : undefined
}

/** Inventory picto from DataRoot ``iconId``, never gid / appearanceId. */
export function itemIcon(ref: { gid: number; icon_id?: number }): string | undefined {
  const iconId = ref.icon_id ?? itemsById[String(ref.gid)]?.iconId
  if (iconId) {
    const fromIndex = pictoUrl('items', String(iconId))
    if (fromIndex) return fromIndex
  }
  return gameDataUrl(itemsById[String(ref.gid)]?.picto)
}

export function spell(id: number): CatalogSpell | undefined {
  return spellsById[String(id)]
}

export function item(id: number): CatalogItem | undefined {
  return itemsById[String(id)]
}

export function spellLevelById(id: number): CatalogSpellLevel | undefined {
  return spellLevelsById[String(id)]
}

export function spellLevel(spellId: number, grade = 1): CatalogSpellLevel | undefined {
  const rows = spellLevelsBySpell[String(spellId)]
  if (!rows?.length) return undefined
  return rows.find((row) => row.grade === grade) ?? rows[rows.length - 1]
}

export function characteristicName(idOrKeyword: number | string): string | undefined {
  const row = typeof idOrKeyword === 'number'
    ? characteristicsById[String(idOrKeyword)]
    : characteristicsByKeyword[idOrKeyword]
  return row?.name
}

export function worldmap(id = 1): CatalogWorldmap | undefined {
  return worldmapsById[String(id)]
}

/** A zero worldmapId means the area inherits its parent's parchment.
 * Giny's snapshot sends Area.WorldMapId directly: Incarnam's area 45 has 0,
 * while its superarea 3 owns world map 2. Resolve from the local DataRoot so
 * both cartography views work with these existing server snapshots.
 */
export function locationWorldmapId(location: { world_map_id?: number; subarea_id: number }): number {
  if (location.world_map_id && location.world_map_id > 0) return location.world_map_id
  const subarea = subareasById[String(location.subarea_id)]
  const area = subarea ? areasById[String(subarea.areaId)] : undefined
  const superarea = area ? superareasById[String(area.superAreaId)] : undefined
  return [subarea?.worldmapId, area?.worldmapId, superarea?.worldmapId]
    .find((id): id is number => typeof id === 'number' && id > 0) ?? 1
}

/** The world maps the official picker lists (`visibleOnMap`), by name. */
export function worldmapList(): CatalogWorldmap[] {
  return Object.values(worldmapsById)
    .filter((row) => row.visibleOnMap !== 0)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'fr') || a.id - b.id)
}

export function worldmapHintsFor(worldmapId: number): CatalogHint[] {
  return hintsByWorldmap[String(worldmapId)] ?? []
}

export function hint(id: number): CatalogHint | undefined {
  return hintsById[String(id)]
}

export function hintCategory(id: number): CatalogHintCategory | undefined {
  return hintCategoriesById[String(id)]
}

export function decodeEffectLine(effect: CatalogEffectInstance): string | undefined {
  const meta = effectsById[String(effect.effectId)]
  const template = meta?.description
  if (!template) return undefined
  let text = decodePattern(template, effectPatternParams(effect))
  if (!text) return undefined
  if ((effect.duration ?? 0) > 0) {
    const unit = decodePattern('tour{{~ps}}', [effect.duration])
    text = `${text} (${effect.duration} ${unit})`
  }
  return text
}

/** Spell picto: ``sort_{iconId}`` if indexed, else ``weapon_{iconId}``. Missing = no URL. */
export function spellIcon(iconId?: number, picto?: string): string | undefined {
  if (picto) return gameDataUrl(picto)
  if (!iconId) return undefined
  return pictoUrl('spells', `sort_${iconId}`) ?? pictoUrl('spells', `weapon_${iconId}`)
}

export function achievementIcon(iconId?: number, picto?: string): string | undefined {
  if (picto) return gameDataUrl(picto)
  if (!iconId) return undefined
  return pictoUrl('achievements', String(iconId))
}

export function jobIcon(iconId?: number, picto?: string): string | undefined {
  if (picto) return gameDataUrl(picto)
  if (iconId == null || iconId < 0) return undefined
  return pictoUrl('jobs', String(iconId))
}

export function job(id: number): CatalogJob | undefined {
  return jobsById[String(id)]
}

/** Ornament picto from DataRoot ``assetId``, never ``iconId`` (often 0). */
export function ornamentIcon(assetId?: number, picto?: string): string | undefined {
  if (picto) return gameDataUrl(picto)
  if (assetId == null) return undefined
  return pictoUrl('ornaments', String(assetId))
}

const PREVIEW_LIMIT = 20
const DUNGEONS_CATEGORY = 3

/** Root `AchievementCategoryData` rows (`parentId === 0`). C# `MakeSummary`
    / `MakeSummaryCategory` clones these into `#ctr_summaryContent`. */
export function previewAchievementCategories(): CatalogCategory[] {
  return Object.values(categoriesById)
    .filter((row) => row.parentId === 0)
    .sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id))
}

/** Leaf-category list (`lv_achievements`), not the Succès rest pose. Rest
    is `MakeSummary` on `#ctr_base`. Keep for a later SelectCategory. */
export function previewAchievements(limit = PREVIEW_LIMIT): CatalogAchievement[] {
  const child = Object.values(categoriesById).find(
    (category) => category.parentId === DUNGEONS_CATEGORY && (category.achievementIds?.length ?? 0) > 0,
  )
  const ids = child?.achievementIds?.slice(0, limit)
  if (ids?.length) {
    return ids.flatMap((id) => {
      const row = achievementsById[String(id)]
      return row ? [row] : []
    })
  }
  return Object.values(achievementsById)
    .sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id))
    .slice(0, limit)
}

export function previewJobs(): CatalogJob[] {
  return Object.values(jobsById)
    .filter((row) => row.iconId == null || row.iconId >= 0)
    .sort((a, b) => a.id - b.id)
}

export function allRecipes(): CatalogRecipe[] { return Object.values(recipesById) }

/** Encyclopaedia preview: first 20 recipes by resultId, not the whole 4858. */
export function previewRecipes(limit = PREVIEW_LIMIT): CatalogRecipe[] {
  return Object.values(recipesById)
    .sort((a, b) => a.resultId - b.resultId)
    .slice(0, limit)
}

/** `RecipesUI` / `JobWindowRecipesUI` + `m_selectedJobId` / `OnSelectJob`. */
export function recipesForJob(jobId: number): CatalogRecipe[] {
  return Object.values(recipesById)
    .filter((row) => row.jobId === jobId)
    .sort((a, b) => (a.resultLevel ?? 0) - (b.resultLevel ?? 0) || a.resultId - b.resultId)
}

/** Encyclopaedia preview: first 20 quests by id. Followed-quest ``lv_main`` stays live. */
export function previewQuests(limit = PREVIEW_LIMIT): CatalogQuest[] {
  return Object.values(questsById)
    .sort((a, b) => a.id - b.id)
    .slice(0, limit)
}

/** ``QuestCategoriesDataRoot`` rows, official ``order`` then id. */
export function questCategories(): CatalogQuestCategory[] {
  return Object.values(questCategoriesById).sort(
    (a, b) => (a.order ?? a.id) - (b.order ?? b.id) || a.id - b.id,
  )
}

/** Féca (or any breed) spells from the creation catalogue — not the 17 067 DataRoot rows. */
export function previewSpells(breedId: number, limit = PREVIEW_LIMIT): CatalogSpell[] {
  const all = breedSpells[String(breedId)] ?? []
  return all.slice(0, limit)
}

export function breedSpellsFor(breedId: number): CatalogSpell[] {
  return breedSpells[String(breedId)] ?? []
}

/** SpellVariant.spellIds from SpellVariants.d2o — the two buttons of one spellListEntry. */
export function listSpellVariants(breedId?: number): CatalogSpellVariant[] {
  const rows = Object.values(spellVariantsById)
  const filtered = breedId == null ? rows : rows.filter((row) => row.breedId === breedId)
  return filtered.sort((a, b) => a.id - b.id)
}

/** ``BindObtentionEntries`` chips. Empty when the DataRoot has no positive minPlayerLevel. */
export function spellObtention(id: number): number[] {
  return spellObtentionById[String(id)]?.minPlayerLevels ?? []
}

/** ``GetObjectiveText`` for the first step. Empty when the DataRoot row has no format. */
export function questObjectives(questId: number): CatalogQuestObjective[] {
  return questObjectivesById[String(questId)]?.objectives ?? []
}

/** First-step ``descriptionId``. Undefined until the catalogue row has one. */
export function questStepDescription(questId: number): string | undefined {
  return questObjectivesById[String(questId)]?.description
}

export function previewOrnaments(limit = PREVIEW_LIMIT): CatalogOrnament[] {
  return Object.values(ornamentsById)
    .sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id))
    .slice(0, limit)
}

export function previewTitles(limit = PREVIEW_LIMIT): CatalogTitle[] {
  return Object.values(titlesById)
    .sort((a, b) => a.id - b.id)
    .slice(0, limit)
}

async function loadTable<T>(fetcher: typeof fetch, path: string): Promise<Record<string, T> | undefined> {
  return tableRecords<T>(await catalogJson(path, fetcher))
}

type I18nFile = {
  language?: string
  strings?: Record<string, string>
  by_id?: Record<string, string>
}

export type CatalogGroup = 'all' | 'core' | 'achievements' | 'jobs' | 'cosmetics'
export function loadGameCatalog(fetcher: typeof fetch = fetch, group: CatalogGroup = 'all'): Promise<void> {
  let groups = catalogLoads.get(fetcher)
  if (!groups) { groups = new Map(); catalogLoads.set(fetcher, groups) }
  let pending = groups.get(group)
  if (!pending) {
    const owner = groups
    pending = loadGameCatalogOnce(fetcher, group).catch(error => { owner.delete(group); throw error })
    groups.set(group, pending)
  }
  return pending
}

async function loadGameCatalogOnce(fetcher: typeof fetch, group: CatalogGroup): Promise<void> {
  if (group !== 'all' && group !== 'core') {
    const i18n = await catalogJson<I18nFile>('/game-data/client/i18n.json', fetcher)
    const fields = group === 'achievements' ? { achievements: 'achievements', categories: 'achievementcategories' }
      : group === 'jobs' ? { jobs: 'jobs', recipes: 'recipes' } : { ornaments: 'ornaments', titles: 'titles' }
    const entries = await Promise.all(Object.entries(fields).map(async ([key, file]) =>
      [key, stampNames(await loadTable(fetcher, `/game-data/data/${file}.json`), i18n.by_id)]))
    hydrateCatalog(Object.fromEntries(entries))
    return
  }
  const [indexRes, items, achievements, categories, jobs, recipes, quests, questCats, spells, ornaments, titles, variants, obtention, questObjs, creationRes, i18nRes, effects, spellLevels, characteristics, worldmaps, hints, hintCategories, subareas, areas, superareas, questSteps, questTypes, npcs] = await Promise.all([
    catalogJson('/game-data/pictos/index.json', fetcher).then(value => ({ ok: true, json: async () => value })),
    loadTable<CatalogItem>(fetcher, '/game-data/data/items.json'),
    group === 'all' ? loadTable<CatalogAchievement>(fetcher, '/game-data/data/achievements.json') : undefined,
    group === 'all' ? loadTable<CatalogCategory>(fetcher, '/game-data/data/achievementcategories.json') : undefined,
    group === 'all' ? loadTable<CatalogJob>(fetcher, '/game-data/data/jobs.json') : undefined,
    group === 'all' ? loadTable<CatalogRecipe>(fetcher, '/game-data/data/recipes.json') : undefined,
    loadTable<CatalogQuest>(fetcher, '/game-data/data/quests.json'),
    loadTable<CatalogQuestCategory>(fetcher, '/game-data/data/questcategories.json'),
    loadTable<CatalogSpell>(fetcher, '/game-data/data/spells.json'),
    group === 'all' ? loadTable<CatalogOrnament>(fetcher, '/game-data/data/ornaments.json') : undefined,
    group === 'all' ? loadTable<CatalogTitle>(fetcher, '/game-data/data/titles.json') : undefined,
    loadTable<CatalogSpellVariant>(fetcher, '/game-data/data/spellvariants.json'),
    loadTable<CatalogSpellObtention>(fetcher, '/game-data/data/spellobtention.json'),
    loadTable<CatalogQuestObjectives>(fetcher, '/game-data/data/questobjectives.json'),
    catalogJson('/game-data/client/creation_catalog.json', fetcher).then(value => ({ ok: true, json: async () => value })),
    catalogJson<I18nFile>('/game-data/client/i18n.json', fetcher).then(value => ({ ok: true, json: async () => value })),
    loadTable<CatalogEffect>(fetcher, '/game-data/data/effects.json'),
    loadTable<CatalogSpellLevel>(fetcher, '/game-data/data/spelllevels.json'),
    loadTable<CatalogCharacteristic>(fetcher, '/game-data/data/characteristics.json'),
    loadTable<CatalogWorldmap>(fetcher, '/game-data/data/worldmaps.json'),
    loadTable<CatalogHint>(fetcher, '/game-data/data/hints.json'),
    loadTable<CatalogHintCategory>(fetcher, '/game-data/data/hintcategories.json'),
    loadTable<CatalogSubarea>(fetcher, '/game-data/data/subareas.json'),
    loadTable<CatalogArea>(fetcher, '/game-data/data/areas.json'),
    loadTable<CatalogSuperarea>(fetcher, '/game-data/data/superareas.json'),
    loadTable<{id:number;[key:string]:unknown}>(fetcher, '/game-data/data/queststeps.json'),
    loadTable<{id:number;[key:string]:unknown}>(fetcher, '/game-data/data/questobjectivetypes.json'),
    loadTable<{id:number;[key:string]:unknown}>(fetcher, '/game-data/data/npcs.json'),
  ])
  const pictos: Record<string, SpriteMap> = {}
  if (indexRes.ok) {
    const index = await indexRes.json() as {
      kinds?: Record<string, { sprites?: SpriteMap }>
    }
    for (const [kind, pack] of Object.entries(index.kinds ?? {})) {
      pictos[kind] = pack.sprites ?? {}
    }
  }
  const breedSpellsPayload: Record<string, CatalogSpell[]> = {}
  const i18n = i18nRes.ok ? ((await i18nRes.json()) as I18nFile) : undefined
  const byId = i18n?.by_id
  if (creationRes.ok) {
    const creation = await creationRes.json() as {
      classes?: Array<{ breed_id: number; spells?: Array<{ id: number; name?: string; icon_id?: number }> }>
    }
    for (const cls of creation.classes ?? []) {
      breedSpellsPayload[String(cls.breed_id)] = (cls.spells ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        iconId: row.icon_id,
      }))
    }
  }
  hydrateCatalog({
    items: stampNames(items, byId),
    achievements: stampNames(achievements, byId),
    categories: stampNames(categories, byId),
    jobs: stampNames(jobs, byId),
    recipes: stampNames(recipes, byId),
    quests: stampNames(quests, byId),
    questCategories: stampNames(questCats, byId),
    spells: stampNames(spells, byId),
    ornaments: stampNames(ornaments, byId),
    titles: stampNames(titles, byId),
    breedSpells: breedSpellsPayload, spellVariants: variants, spellObtention: obtention, questObjectives: { ...questObjs, ...joinQuestObjectives((quests ?? {}) as unknown as Record<string,{id:number;[key:string]:unknown}>, questSteps ?? {}, (questObjs ?? {}) as unknown as Record<string,{id:number;[key:string]:unknown}>, questTypes ?? {}, npcs ?? {}, byId) }, pictos,
    uiStrings: i18n?.strings,
    effects: stampNames(effects, byId),
    spellLevels,
    characteristics: stampNames(characteristics, byId),
    worldmaps: stampNames(worldmaps, byId),
    subareas, areas, superareas,
    hints: stampNames(hints, byId),
    hintCategories: stampNames(hintCategories, byId),
  })
}

/** Creation needs spell data before entering the world; unrelated HUD tables can wait. */
export async function loadCreationSpellCatalog(fetcher: typeof fetch = fetch): Promise<void> {
  const [spells, variants, levels, effects, i18nRes, indexRes] = await Promise.all([
    loadTable<CatalogSpell>(fetcher, '/game-data/data/spells.json'),
    loadTable<CatalogSpellVariant>(fetcher, '/game-data/data/spellvariants.json'),
    loadTable<CatalogSpellLevel>(fetcher, '/game-data/data/spelllevels.json'),
    loadTable<CatalogEffect>(fetcher, '/game-data/data/effects.json'),
    catalogJson<I18nFile>('/game-data/client/i18n.json', fetcher).then(value => ({ ok: true, json: async () => value })),
    catalogJson('/game-data/pictos/index.json', fetcher).then(value => ({ ok: true, json: async () => value })),
  ])
  const pictos: Record<string, SpriteMap> = {}
  if (indexRes.ok) { const index = await indexRes.json() as { kinds?: Record<string, { sprites?: SpriteMap }> }; for (const [kind, pack] of Object.entries(index.kinds ?? {})) pictos[kind] = (pack as { sprites?: SpriteMap }).sprites ?? {} }
  const i18n = i18nRes.ok ? await i18nRes.json() as I18nFile : undefined
  hydrateCatalog({ pictos, spells: stampNames(spells, i18n?.by_id), spellVariants: variants,
    spellLevels: levels, effects: stampNames(effects, i18n?.by_id) })
}

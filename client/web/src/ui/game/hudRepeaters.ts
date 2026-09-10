import { stripChatMarkup } from '../../giny/chatText'
export { stripChatMarkup } from '../../giny/chatText'
import { moduleOptions } from '../official/moduleOptions'
import type { CharacterHud, ChatLine } from '../../giny/types'
import type { Repeater, RepeaterItem } from '../official/repeaters'
import { chatTooltip } from '../official/tooltipStore'
import {
  itemIcon,
  jobIcon,
  ornamentIcon,
  previewAchievementCategories,
  previewJobs,
  previewOrnaments,
  previewQuests,
  previewRecipes,
  previewTitles,
  questCategories,
  questObjectives,
  recipesForJob,
  job,
  spell,
  spellIcon,
  breedSpellsFor,
  listSpellVariants,
  spellObtention,
  characteristicName,
  uiFormat,
  uiString,
  type CatalogJob,
  type CatalogOrnament,
  type CatalogQuest,
  type CatalogQuestCategory,
  type CatalogRecipe,
  type CatalogSpell,
  type CatalogTitle,
  worldmapList,
} from './catalog'
import { worldmapViewStore } from './worldmapStore'
import { formatInt, ratio } from './hudWidgets'

/** VisualTreeAssets proven by IL2CPP + UXML (`extractor.ui.list_templates`). */
export const LIST_TEMPLATES = {
  gd_character: 'characterLine',
  lv_achievements: 'achievementItem',
  // `AchievementsUI.MakeSummary` / `get_ctr_summaryContent` /
  // `get_achievementSummaryItem`. VTA `InlineGridItem_gd_summary_default`.
  ctr_summaryContent: 'achievementSummaryItem',
  lv_jobProgress: 'jobProgressItem',
  lv_recipe: 'jobRecipeItem',
  lv_questList: 'quest',
  lv_main: 'questList_quest',
  // `CartographyMapUI` ships `#gd_worldmaps` empty; the row is its own
  // VisualTreeAsset, named after the grid it is authored for.
  gd_worldmaps: 'InlineGridItem_gd_worldmaps_ctr_worldmapCat',
  ctr_objectives: 'questList_objective',
  gd_objectives: 'quest_objective',
  // Empty `quests.uxml` `#tbg_tabs`. C# `AddTab` clones DofusTab; there is
  // no VisualTreeAsset. The body lives in `INLINE_UITK_TEMPLATES`.
  tbg_tabs: 'DofusTab',
  listChat: 'chatItem',
  ctr_spellListContainer: 'spellListEntry',
  ctr_leftSpellContainer: 'spellListEntry',
  ctr_rightSpellContainer: 'spellListEntry',
  gd_spellButtons: 'spellButtonsEntry',
  gd_obtentionLevels: 'spellList_obtentionLevels',
  lv_ornaments: 'CosmeticOrnamentLine',
  lv_titles: 'CosmeticTitleLine',
  ctr_statBlocks: 'MainStatItem',
  ctr_characterStatsDetailed: 'statTwoColumnsItem',
  ctr_statsTwoColumns: 'EntityStatsTwoColumns',
  ctr_entityStatsTableItems: 'EntityStatsTableItem',
} as const

export function windowRepeaters(tree: string, hud: CharacterHud): Repeater | undefined {
  if (tree === 'characterSheetUi') return characterSheetRepeaters(hud)
  if (tree === 'achievements') return achievementRepeaters()
  if (tree === 'jobUI' || tree === 'jobProgressTab') return jobRepeaters(hud)
  if (tree === 'recipesUI') return recipeRepeaters()
  if (tree === 'quests') return questRepeaters(hud)
  if (tree === 'questList') return questTrackerRepeaters(hud)
  if (tree === 'playerSpell') return spellRepeaters(hud)
  if (tree === 'cosmeticUi') return appearanceRepeaters()
  if (tree === 'CartographyMapUI') return cartographyRepeaters()
  return undefined
}

/** `#gd_worldmaps`: the official world-map picker.

    One row per `worldmaps.json` entry the client lists (`visibleOnMap`). The
    sub-caption and the deploy chevron belong to a super-area grouping the row
    carries no data for, so they stay folded rather than repeating the name. */
function cartographyRepeaters(): Repeater {
  const current = worldmapViewStore.snapshot().worldmapId
  const rows = worldmapList()
  if (!rows.length) return {}
  return {
    gd_worldmaps: rows.map((row) => ({
      key: String(row.id),
      template: LIST_TEMPLATES.gd_worldmaps,
      resolve: (binding: string) => {
        if (binding === 'lbl_worldmapCatName') return { text: row.name ?? String(row.id) }
        if (binding === 'lbl_worldmapSubCatName' || binding === 'tx_catplusminus') return { hidden: true }
        if (binding === 'btn_deployWorldmapCat') return { hidden: true }
        if (binding === 'btn_worldmapCat') {
          return {
            onClick: () => worldmapViewStore.select(row.id),
            state: current === row.id ? ('selected' as const) : undefined,
          }
        }
        return undefined
      },
    })),
  }
}


function wrapStyle(): { whiteSpace: 'pre-wrap'; overflowWrap: 'anywhere'; wordBreak: 'break-word'; maxWidth: '100%' } {
  // L'officiel peint `white-space: normal` sur `content` / `subContent`, mais
  // un token sans espaces (l'ancien `[QUEST_STATE]%7B…`, un lien) déborde
  // quand même de `listChat` et recouvre la mini-carte. `pre-wrap` garde les
  // `\n` du serveur, `anywhere` casse les tokens interminables dans la
  // largeur de la fenêtre, même redimensionnée.
  return { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word', maxWidth: '100%' }
}

/** Official `chatItem`: `#content` is the sender (or the whole info line),
    `#subContent` the body. Hover opens `ChatTooltip`. */
export function chatRepeaters(lines: ChatLine[]): Repeater {
  const preferences=moduleOptions.get('Chat')
  return {
    listChat: lines.map((line) => {
      const body = stripChatMarkup(line.content)
      const sender = line.sender?.trim()
      const info = line.kind !== 'message' || !sender
      const stamp=preferences.timestamps ? `[${new Date(line.timestamp < 1e12 ? line.timestamp*1000 : line.timestamp).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})}] ` : ''
      const title = stamp + (info ? body : `${sender} : `)
      const color=line.kind==='error'?'#e87845':line.kind==='info'?'#dbea50':line.channel===6?'#d9acdf':line.channel===2?'#b5df9c':'#eee'
      const sub = info ? '' : body
      const tip = info ? body : `${sender} : ${body}`
      return {
        key: line.id,
        template: LIST_TEMPLATES.listChat,
        resolve: (binding: string) => {
          if (binding === 'line') return { tooltip: chatTooltip(tip), style: { maxWidth: '100%', minWidth: 0, display:'block', lineHeight:preferences.chatSpacing } }
          if (binding === 'content') return { text: title, style: {...wrapStyle(),display:'inline',margin:0,padding:0,color,fontSize:preferences.chatFont,lineHeight:'inherit'} }
          if (binding === 'subContent') {
            return sub ? { text: sub, style: {...wrapStyle(),display:'inline',margin:0,padding:0,color,fontSize:preferences.chatFont,lineHeight:'inherit'} } : { hidden: true }
          }
          return undefined
        },
      }
    }),
  }
}

function characterSheetRepeaters(hud: CharacterHud): Repeater {
  const hex = HEX_STATS.map((row) => ({
    key: row.key,
    template: LIST_TEMPLATES.ctr_statBlocks,
    resolve: (binding: string) => {
      if (binding === 'lbl_statValue') return { text: formatInt(row.value(hud)) }
      if (binding === 'tx_stat') return { sprite: row.sprite }
      return undefined
    },
  }))
  const detailed = CHARACTER_STAT_GROUPS.map(ids => ids.map(id => id == null ? null : detailedStatRow(hud, id)))
  const tableItems = ELEMENT_TABLE.map((row) => ({
    key: row.key,
    template: LIST_TEMPLATES.ctr_entityStatsTableItems,
    resolve: (binding: string) => {
      if (binding === 'lbl_statName') {
        const text = characteristicName(row.keyword) ?? row.label
        return { text }
      }
      const value = binding === 'lbl_damageValue' ? row.damage(hud)
        : binding === 'lbl_resFixValue' ? row.resist(hud)
        : binding === 'lbl_resPercentValue' ? row.percent(hud) : undefined
      if (['lbl_damageValue', 'lbl_resFixValue', 'lbl_resPercentValue'].includes(binding)) {
        const percent = binding === 'lbl_resPercentValue' || (binding === 'lbl_damageValue' && row.damagePercent)
        return { text: value == null ? '—' : `${formatInt(value)}${percent ? ' %' : ''}`, style: { opacity: value === 0 || value == null ? 0.4 : 1 } }
      }
      if (binding === 'tx_stat') return { sprite: row.sprite }
      return undefined
    },
  }))
  return {
    ctr_statBlocks: hex,
    ctr_characterStatsDetailed: [
      ...detailed.flatMap((rows, index): RepeaterItem[] => [{
        key: `stat-group-${index}`, template: 'CharacterStatsDetailed',
        resolve: binding => binding === 'ctr_characterStatsDetailed' ? { style: { gap: 0 } } : undefined,
        repeaters: { ctr_characterStatsDetailed: chunkTwoColumnRows(rows) },
      }, {
        key: `stat-divider-${index}`, template: 'DividerOptionElement',
        resolve: binding => binding === 'ctr_dividerOptionElement' ? { style: { padding: 0 } }
          : binding === 'div_divider' ? { style: { marginTop: 0, marginBottom: 0 } } : undefined,
      }]),
      {
        key: 'entity-stats-table',
        template: 'EntityStatsTable',
        resolve: () => undefined,
        repeaters: { ctr_entityStatsTableItems: tableItems },
      },
    ],
  }
}

/** DataRoot flags arrive as Unity 0/1 or bool. Do not treat other values as on. */
function catalogFlag(value: unknown): boolean {
  return value === true || value === 1
}

function questRowClass(row: { isDungeonQuest?: boolean | number; isPartyQuest?: boolean | number }): string {
  const tokens = ['quest']
  if (catalogFlag(row.isDungeonQuest)) tokens.push('dungeon')
  if (catalogFlag(row.isPartyQuest)) tokens.push('party')
  return tokens.join(' ')
}

const HEX_STATS = [
  { key: 'vitality', sprite: 'tx_vitality', value: (hud: CharacterHud) => hud.life.max },
  { key: 'strength', sprite: 'tx_strength', value: (hud: CharacterHud) => hud.characteristics.strength.total },
  { key: 'intelligence', sprite: 'tx_intelligence', value: (hud: CharacterHud) => hud.characteristics.intelligence.total },
  { key: 'chance', sprite: 'tx_chance', value: (hud: CharacterHud) => hud.characteristics.chance.total },
  { key: 'agility', sprite: 'tx_agility', value: (hud: CharacterHud) => hud.characteristics.agility.total },
  { key: 'wisdom', sprite: 'tx_wisdom', value: (hud: CharacterHud) => hud.characteristics.wisdom.total },
] as const

/** Runtime display groups, in row order, from the supplied official sheet.
 * These differ from the flat Dofus 2.68 CharacteristicCategories data order.
 * The parser still paints EntityStatsTwoColumns / statTwoColumnsItem templates. */
const CHARACTER_STAT_GROUPS = [
  [1, 18, 23, 25, 19, 26],
  [40, 48],
  [79, 78, 82, 27, 83, 28, 44, 49, 50, null],
] as const

function secondaryTotal(hud: CharacterHud, key: string): number {
  return hud.secondary.find((entry) => entry.key === key)?.value.total ?? 0
}

/** Characteristics.d2o `asset` + named i18n already exported in `ui_keys`. */
const TWO_COLUMN_BY_ID: Record<number, { key: string; i18n: string; sprite: string; value: (hud: CharacterHud) => number }> = {
  1: { key: 'ap', i18n: 'ui.stats.actionPoints', sprite: 'tx_actionPoints', value: (hud) => hud.points.ap },
  23: { key: 'mp', i18n: 'ui.stats.movementPoints', sprite: 'tx_movementPoints', value: (hud) => hud.points.mp },
  19: { key: 'range', i18n: 'ui.stats.range', sprite: 'tx_range', value: (hud) => hud.points.range },
  25: { key: 'all_damage', i18n: 'ui.stats.damagesBonusPercent', sprite: 'tx_damagesPercent', value: (hud) => secondaryTotal(hud, 'power') },
  18: { key: 'critical_hit', i18n: 'ui.stats.criticalHit', sprite: 'tx_crit', value: (hud) => hud.combat.critical_hit.total },
  82: { key: 'ap_reduction', i18n: 'ui.stats.PAAttack', sprite: 'tx_attackAP', value: (hud) => secondaryTotal(hud, 'ap_reduction') },
  27: { key: 'ap_dodge', i18n: 'ui.stats.dodgeAP', sprite: 'tx_dodgeAP', value: (hud) => secondaryTotal(hud, 'ap_dodge') },
  83: { key: 'mp_reduction', i18n: 'ui.stats.PMAttack', sprite: 'tx_attackMP', value: (hud) => secondaryTotal(hud, 'mp_reduction') },
  28: { key: 'mp_dodge', i18n: 'ui.stats.dodgeMP', sprite: 'tx_dodgeMP', value: (hud) => secondaryTotal(hud, 'mp_dodge') },
  49: { key: 'heal', i18n: 'ui.stats.healBonus', sprite: 'tx_heal', value: (hud) => hud.combat.heal.total },
  79: { key: 'tackle', i18n: 'ui.stats.takleBlock', sprite: 'tx_tackle', value: (hud) => secondaryTotal(hud, 'tackle') },
  78: { key: 'dodge', i18n: 'ui.stats.takleEvade', sprite: 'tx_escape', value: (hud) => secondaryTotal(hud, 'dodge') },
  44: { key: 'initiative', i18n: 'ui.stats.initiative', sprite: 'tx_initiative', value: (hud) => hud.points.initiative },
  26: { key: 'summons', i18n: 'ui.stats.summonableCreatures', sprite: 'tx_summonableCreaturesBoost', value: (hud) => hud.points.summons },
  48: { key: 'prospecting', i18n: 'ui.stats.prospecting', sprite: 'tx_prospecting', value: (hud) => hud.points.prospecting },
  50: { key: 'reflect', i18n: 'ui.stats.reflect', sprite: 'tx_return', value: (hud) => secondaryTotal(hud, 'reflect') },
  40: { key: 'pods', i18n: 'ui.common.weight', sprite: 'tx_pods', value: (hud) => hud.weight.current },
}

type DisplayStat = { key: string; i18n: string; characteristicId?: number; value: number; sprite?: string }
function detailedStatRow(hud: CharacterHud, id: number): DisplayStat {
  const row = TWO_COLUMN_BY_ID[id]
  return { key: row.key, i18n: row.i18n, characteristicId: id, value: row.value(hud), sprite: row.sprite }
}

/** C# `CharacterStatsDetailed.m_childTwoColumns` / `EntityStatsTwoColumns.m_childTwoColumnsItems`:
    each `EntityStatsTwoColumns` hosts a pair of `statTwoColumnsItem` in list order. */
function chunkTwoColumnRows(
  rows: Array<DisplayStat | null>,
): RepeaterItem[] {
  const groups: RepeaterItem[] = []
  for (let index = 0; index < rows.length; index += 2) {
    const pair = rows.slice(index, index + 2)
    groups.push({
      key: `two-col-${pair.map((row) => row?.key ?? 'empty').join('-')}`,
      template: LIST_TEMPLATES.ctr_statsTwoColumns,
      resolve: () => undefined,
      repeaters: {
        ctr_statsTwoColumns: pair.map((row) => ({
          key: row?.key ?? 'empty',
          template: LIST_TEMPLATES.ctr_characterStatsDetailed,
          resolve: (binding: string) => {
            if (!row) return binding === 'ctr_stat' ? { style: { visibility: 'hidden' } } : undefined
            if (binding === 'lbl_statName') {
              const text = (row.characteristicId != null ? characteristicName(row.characteristicId) : undefined)
                ?? uiString(row.i18n)
              return text ? { text } : undefined
            }
            if (binding === 'lbl_statValue') return { text: formatInt(row.value) }
            if (binding === 'tx_stat') return row.sprite ? { sprite: row.sprite } : undefined
            return undefined
          },
        })),
      },
    })
  }
  return groups
}

type TableStat = { key: string; keyword: string; label: string; sprite: string; damagePercent?: boolean;
  damage: (hud: CharacterHud) => number | undefined; resist: (hud: CharacterHud) => number | undefined;
  percent: (hud: CharacterHud) => number | undefined }
const ELEMENT_TABLE: TableStat[] = [
  ...(['neutral', 'earth', 'fire', 'water', 'air'] as const).map((element, index) => ({
    key: element, keyword: `${element}Element`, label: ['Neutre', 'Terre', 'Feu', 'Eau', 'Air'][index],
    sprite: ['tx_neutral', 'tx_strength', 'tx_intelligence', 'tx_chance', 'tx_agility'][index],
    damage: (hud: CharacterHud) => hud.combat.all_damage.total + secondaryTotal(hud, `${element}_damage`),
    resist: (hud: CharacterHud) => secondaryTotal(hud, `${element}_reduction`),
    percent: (hud: CharacterHud) => hud.combat[`${element}_resist`].total,
  })),
  ...(['critical', 'push'] as const).map((key, index) => ({
    key, keyword: key, label: ['Critiques', 'Poussée'][index], sprite: ['tx_criticalDamage', 'tx_push'][index],
    damage: (hud: CharacterHud) => secondaryTotal(hud, `${key}_damage`),
    resist: (hud: CharacterHud) => secondaryTotal(hud, `${key}_resist`), percent: () => undefined,
  })),
  ...(['spells', 'weapon', 'distance', 'melee'] as const).map((key, index) => ({
    key, keyword: key, label: ['Sorts', 'Armes', 'Distance', 'Mêlée'][index],
    sprite: ['tx_spells', 'tx_weapon', 'tx_distance', 'tx_damageMelee'][index], damagePercent: true,
    // These multiplier fields are optional in the 2.68 bridge. Never substitute
    // additive spell/weapon power or a fabricated zero for missing values.
    damage: (hud: CharacterHud) => optionalMultiplier(hud, `dealt_${key}`, false),
    resist: () => undefined,
    percent: (hud: CharacterHud) => optionalMultiplier(hud, `received_${key}`, true),
  })),
]
function optionalMultiplier(hud: CharacterHud, key: string, resistance: boolean): number | undefined {
  const value = hud.secondary.find(row => row.key === key)?.value.total
  return value == null ? undefined : resistance ? 100 - value : value - 100
}

function achievementRepeaters(): Repeater {
  const rows = previewAchievementCategories()
  if (!rows.length) return {}
  return {
    ctr_summaryContent: rows.map((row) => ({
      key: String(row.id),
      template: LIST_TEMPLATES.ctr_summaryContent,
      resolve: (binding: string) => {
        if (binding === 'lbl_name') return { text: row.name ?? '' }
        // Live category % is player progress. Preview has none; do not keep
        // the UXML dummy ``75%`` / ``value="0.78"``.
        if (binding === 'lbl_percent') return { text: '0%' }
        if (binding === 'pb_progress') return { value: 0 }
        return undefined
      },
    })),
  }
}

function jobRows(hud: CharacterHud): CatalogJob[] {
  if (hud.jobs.length) {
    return hud.jobs.map((live) => {
      const row = job(live.id)
      return {
        id: live.id,
        name: row?.name ?? live.name,
        iconId: row?.iconId,
        picto: row?.picto,
      }
    })
  }
  return previewJobs()
}

function jobRepeaters(hud: CharacterHud): Repeater {
  const rows = jobRows(hud)
  if (!rows.length) return {}
  const selectedId = hud.jobs[0]?.id ?? rows[0]?.id
  const recipes = selectedId != null ? recipesForJob(selectedId) : []
  return {
    lv_jobProgress: rows.map((row) => {
      const live = hud.jobs.find((entry) => entry.id === row.id)
      return {
        key: String(row.id),
        template: LIST_TEMPLATES.lv_jobProgress,
        resolve: (binding: string) => {
          if (binding === 'jobProgressItem' && row.id === selectedId) return { className: 'selected' }
          // `btn_openItem` unfolds `#ctr_bottom`. JSON rest is `display: flex`
          // so every clone ships the public-craft options. C# `get_ctr_bottom`
          // keeps that block folded until the chevron.
          if (binding === 'ctr_bottom') return { hidden: true }
          if (binding === 'lbl_jobName') return { text: row.name ?? live?.name ?? '' }
          if (binding === 'lbl_jobLvl') return live ? { text: String(live.level) } : { hidden: true }
          if (binding === 'lbl_currentXp') {
            return live ? { text: formatInt(live.experience) } : { hidden: true }
          }
          if (binding === 'lbl_lvlUpXp') {
            return live ? { text: `/ ${formatInt(live.experience_next)}` } : { hidden: true }
          }
          if (binding === 'progressBar' && live) {
            return { value: ratio(live.experience - live.experience_floor, live.experience_next - live.experience_floor) }
          }
          if (binding === 'tx_jobImage') {
            const sprite = jobIcon(row.iconId, row.picto)
            return sprite ? { sprite } : undefined
          }
          return undefined
        },
      }
    }),
    ...recipeList(recipes),
  }
}

function recipeTileGid(row: CatalogRecipe, scope?: string): number | undefined {
  if (scope === 'craftedItemTile') return row.resultId
  const index = Number(scope?.match(/^tile(\d+)$/)?.[1] ?? 0)
  if (index >= 1) return row.ingredientIds?.[index - 1]
  return undefined
}

function isRecipeTileIcon(binding: string): boolean {
  return binding === 'itemTile_container' || binding === 'itemTile_icon' || binding === 'itemTile_icon_Vector'
}

function recipeList(rows: CatalogRecipe[]): Repeater {
  if (!rows.length) return {}
  return {
    lv_recipe: rows.map((row) => ({
      key: String(row.resultId),
      template: LIST_TEMPLATES.lv_recipe,
      resolve: (binding: string, scope?: string) => {
        if (binding === 'lbl_name') return { text: row.name ?? '' }
        // UXML dummy is ``[Niv. 200]``. ``Niv.`` is not in IL2CPP. Stamp the
        // GameData ``resultLevel`` only.
        if (binding === 'lbl_lvl') return { text: String(row.resultLevel ?? '') }
        // ``[x10]`` / ``9999`` XP are UI Builder leftovers. Compact recipes
        // have no XP or owned-quantity fields.
        if (binding === 'lbl_craftPossibleQuantity' || binding === 'lbl_xp' || binding === 'ic_xp') {
          return { hidden: true }
        }
        if (/^tile\d+$/.test(binding) && recipeTileGid(row, binding) == null) return { hidden: true }
        if (isRecipeTileIcon(binding)) {
          const gid = recipeTileGid(row, scope)
          if (gid == null) return undefined
          const sprite = itemIcon({ gid })
          return sprite ? { sprite } : undefined
        }
        return undefined
      },
    })),
  }
}

function recipeRepeaters(): Repeater {
  return recipeList(previewRecipes())
}

const QUEST_HEADER_CHROME = new Set([
  'tb_follow',
  'lbl_questLevel',
  'tx_dungeon',
  'tx_party',
  'tx_repeatable',
  'sectionHeader_button1',
])

function questListItem(row: CatalogQuest, followed: Set<number>): RepeaterItem {
  return {
    key: String(row.id),
    template: LIST_TEMPLATES.lv_questList,
    resolve: (binding: string) => {
      if (binding === 'lbl_questName') return { text: row.name ?? '' }
      // UXML dummy is ``lvl ``. JSON rest is ``display: none`` until C#
      // writes the GameData level. ``Niv.`` is not in IL2CPP.
      if (binding === 'lbl_questLevel' && row.levelMin != null) {
        return { text: String(row.levelMin), hidden: false }
      }
      if (binding === 'tb_follow') return { checked: followed.has(row.id), hidden: false }
      // USS ``InlineGridItem_gd_quests_default``: UXML rest is ``.category``.
      // Quest rows stamp ``.quest`` (and ``.dungeon`` / ``.party`` when the
      // DataRoot flag is on). Do not stamp ``.repeatable`` — repeatType
      // meaning is unproven.
      if (binding === 'sectionHeaderContent') return { className: questRowClass(row) }
      if (binding === 'tx_dungeon') return { hidden: !catalogFlag(row.isDungeonQuest) }
      if (binding === 'tx_party') return { hidden: !catalogFlag(row.isPartyQuest) }
      if (binding === 'tx_repeatable' || binding === 'sectionHeader_button1') return { hidden: true }
      return undefined
    },
  }
}

function questCategoryItem(category: CatalogQuestCategory): RepeaterItem {
  return {
    key: `category:${category.id}`,
    template: LIST_TEMPLATES.lv_questList,
    resolve: (binding: string) => {
      if (binding === 'lbl_questName') return { text: category.name ?? '' }
      // Same VTA as quest rows. Keep ``.category``; do not stamp ``.quest``.
      // Official ``Astrub (1)`` count is unproven — stamp the name only.
      if (binding === 'sectionHeaderContent') return { className: 'category' }
      if (QUEST_HEADER_CHROME.has(binding)) return { hidden: true }
      return undefined
    },
  }
}

/** Preview quests grouped under ``QuestCategoryData`` headers in ``order``.
    Do not dump the whole 1976-row catalogue. Orphans keep their quest row. */
function encyclopaediaQuestRows(followed: Set<number>): RepeaterItem[] {
  const quests = previewQuests()
  const byId = new Map(quests.map((quest) => [quest.id, quest]))
  const categories = questCategories()
  if (!categories.length) return quests.map((quest) => questListItem(quest, followed))
  const used = new Set<number>()
  const rows: RepeaterItem[] = []
  for (const category of categories) {
    const ids = category.questIds?.length
      ? category.questIds.filter((id) => byId.has(id))
      : quests.filter((quest) => quest.categoryId === category.id).map((quest) => quest.id)
    if (!ids.length) continue
    rows.push(questCategoryItem(category))
    for (const id of ids) {
      const quest = byId.get(id)
      if (!quest) continue
      used.add(id)
      rows.push(questListItem(quest, followed))
    }
  }
  for (const quest of quests) {
    if (!used.has(quest.id)) rows.push(questListItem(quest, followed))
  }
  return rows
}

/** Encyclopaedia list from ``previewQuests()`` cloned as ``quest.uxml``.
    Detail ``gd_objectives`` is the selected followed quest (``hud.quests[0]``).
    Do not clone ``questList_quest`` / ``questList_objective`` here. */
function questRepeaters(hud: CharacterHud): Repeater {
  const selected = hud.quests[0]
  const objectives = selected ? questObjectives(selected.id) : []
  const followed = new Set(hud.quests.map((quest) => quest.id))
  const list = encyclopaediaQuestRows(followed)
  const tabs = questEncyclopaediaTabs()
  const out: Repeater = {}
  if (tabs) out.tbg_tabs = tabs
  if (list.length) out.lv_questList = list
  if (objectives.length) {
    out.gd_objectives = objectives.map((objective) => ({
      key: String(objective.id),
      template: LIST_TEMPLATES.gd_objectives,
      resolve: (binding: string) => {
        if (binding === 'lbl_objective') return { text: objective.text }
        // USS rest: `#ctr_questDescription` / `#btn_description` stay
        // `display: none` until `.hasDescription`. Do not add that class.
        if (binding === 'ctr_questDescription' || binding === 'btn_description') {
          return { hidden: true }
        }
        return undefined
      },
    }))
  }
  return out
}

/** Empty `#tbg_tabs`. C# fills three DofusTab from named grimoire keys.
    Preview treats ``previewQuests()`` as the pending stand-in; completed
    and hidden stay 0 until those lists exist. Skip the row when any key
    is missing — do not invent ``En cours`` / ``Terminé``. */
function questEncyclopaediaTabs(): RepeaterItem[] | undefined {
  const pending = previewQuests().length
  const specs = [
    { key: 'pending', i18n: 'ui.grimoire.pendingQuests', count: pending, active: true },
    { key: 'completed', i18n: 'ui.grimoire.completedQuests', count: 0, active: false },
    { key: 'hidden', i18n: 'ui.grimoire.hiddenQuests', count: 0, active: false },
  ] as const
  const items: RepeaterItem[] = []
  for (const tab of specs) {
    const text = uiFormat(tab.i18n, tab.count)
    if (!text) return undefined
    items.push({
      key: tab.key,
      template: LIST_TEMPLATES.tbg_tabs,
      resolve: (binding: string) => {
        if (binding === 'tab_label') return { text }
        if (!binding && tab.active) return { className: 'activeTrue' }
        return undefined
      },
    })
  }
  return items
}

/** Followed-quest tracker. Encyclopaedia `previewQuests()` stays on `lv_questList`. */
function questTrackerRepeaters(hud: CharacterHud): Repeater {
  if (!hud.quests.length) return {}
  return {
    lv_main: hud.quests.map((row) => {
      const activeObjectives = row.objectiveIds ? new Set(row.objectiveIds) : undefined
      const objectives = questObjectives(row.id).filter(objective => !activeObjectives || activeObjectives.has(objective.id))
      return {
        key: String(row.id),
        template: LIST_TEMPLATES.lv_main,
        resolve: (binding: string) => {
          if (binding === 'lbl_titleQuest') return { text: row.name ?? '' }
          // Daily / type icons and «Voir plus d'objectifs...» are C# flags
          // (`MaxObjectivesWhenCollapsed` is not in UXML). Dummy UXML icons
          // and the Tournesol caption would lie.
          if (binding === 'icon_dailyQuest' || binding === 'icon_questType' || binding === 'btn_more') {
            return { hidden: true }
          }
          return undefined
        },
        repeaters: objectives.length
          ? {
              ctr_objectives: objectives.map((objective) => ({
                key: String(objective.id),
                template: LIST_TEMPLATES.ctr_objectives,
                resolve: (binding: string) => {
                  if (binding === 'lbl_objective') return { text: objective.text }
                  // USS rest: `#ctr_questDescription` / `#btn_description` are
                  // `display: none` until `.hasDescription`. Do not add that class.
                  if (binding === 'ctr_questDescription' || binding === 'btn_description') {
                    return { hidden: true }
                  }
                  return undefined
                },
              })),
            }
          : undefined,
      }
    }),
  }
}

function spellRows(hud: CharacterHud): CatalogSpell[] {
  const fromBreed = breedSpellsFor(hud.character.breed_id)
  if (fromBreed.length) return fromBreed
  return hud.spells.map((entry) => {
    const row = spell(entry.id)
    return {
      id: entry.id,
      name: entry.name ?? row?.name,
      iconId: entry.icon_id ?? row?.iconId,
      picto: row?.picto,
    }
  })
}

/** One spellListEntry per SpellVariant that intersects the visible list.

    UXML `gd_spellButtons` is item-width 338 in a 752px row: C# puts
    `SpellVariant.spellIds` (two buttons + `tx_spell_bound`) in that grid.
    Row order follows the breed / HUD list, not variant id. */
function spellVariantPairs(hud: CharacterHud): CatalogSpell[][] {
  if (hud.spell_choices) return hud.spell_choices.map(pair => pair.map(entry => ({
    ...spell(entry.id), id: entry.id, name: entry.name, description: entry.description,
  })))
  const visible = spellRows(hud)
  if (!visible.length) return []
  const byId = new Map(visible.map((row) => [row.id, row]))
  const variantOf = new Map<number, number[]>()
  for (const variant of listSpellVariants(hud.character.breed_id)) {
    for (const id of variant.spellIds) variantOf.set(id, variant.spellIds)
  }
  const used = new Set<number>()
  const pairs: CatalogSpell[][] = []
  for (const row of visible) {
    if (used.has(row.id)) continue
    const ids = variantOf.get(row.id)
    if (!ids?.length) {
      pairs.push([row])
      used.add(row.id)
      continue
    }
    const buttons = ids.map((id) => byId.get(id) ?? spell(id) ?? { id })
    pairs.push(buttons)
    for (const id of ids) used.add(id)
  }
  return pairs
}

function isSpellTileIcon(binding: string): boolean {
  return binding === 'itemTile_container' || binding === 'itemTile_icon' || binding === 'itemTile_icon_Vector' || binding === 'slot_icon'
}

function spellButtonResolve(row: CatalogSpell, available = true) {
  return (binding: string) => {
    if (binding === 'btn_spell_container') return { style: { width: '50%', minWidth: 0, height: 66, minHeight: 0 } }
    if (binding === 'btn_spell') return { style: { width: '100%', height: 46, top: 10, padding: 0, margin: 0, borderRadius: 8, background: '#2b2d4b', boxShadow: 'inset 0 0 0 1px #77758f' } }
    if (binding === 'container_spell') return { style: { width: '100%', height: 46 } }
    if (binding === 'tx_bgSpell') return { hidden: true }
    if (binding === 'spell_icon_container') return { style: { left: 2, top: 2, width: 42, height: 42, backgroundImage: 'none' } }
    if (binding === 'lbl_spellName_container') return { style: { left: 54, top: 0, height: 46, width: 'calc(100% - 60px)' } }
    if (binding === 'lbl_spellName') return { text: row.name ?? '', style: { fontSize: 16, color: '#fff' } }
    if (binding === 'gd_obtentionLevels_container') return { style: { left: 84, top: 0, width: 'auto', height: 18 } }
    if (binding === 'gd_obtentionLevels') return { style: { width: 'auto', height: 18, gap: 4 } }
    if (isSpellTileIcon(binding)) {
      const sprite = spellIcon(row.iconId, row.picto)
      return sprite ? { sprite } : undefined
    }
    if (binding === 'tx_lock' || binding === 'tx_greyedOut') return { hidden: available }
    if (binding === 'ctr_newSpell') return { hidden: true }
    // ``SpellButtonsEntryBinding.get_tx_bgSpell_activated`` is the selected
    // overlay. ``BindSpell`` shows it; UXML leaves both layers in flow, so the
    // selected sprite would paint on every card at rest.
    if (binding === 'tx_bgSpell_activated') return { hidden: true }
    return undefined
  }
}

function obtentionChips(row: CatalogSpell, characterLevel: number, levels?: number[]): RepeaterItem[] {
  return (levels ?? spellObtention(row.id)).map((level, index) => ({
    key: `${row.id}-${level}-${index}`,
    template: LIST_TEMPLATES.gd_obtentionLevels,
    resolve: (binding: string) => {
      if (binding === 'lbl_obtentionLevel') return { text: String(level), style: { position: 'relative', left: 0, top: 0, width: '100%', height: 18, color: level <= characterLevel ? 'var(--background_dark100)' : 'var(--highlight_secondary100)', fontSize: 14, textAlign: 'center' } }
      if (['tx_obtentionBg','bg_lvl_spell'].includes(binding)) return { hidden: true }
      if (binding === 'obtentionContainer') return { style: { width: 40, minWidth: 0, height: 18, minHeight: 0, background: level <= characterLevel ? 'var(--highlight_secondary100)' : '#00000080' } }
      return undefined
    },
  }))
}

function spellEntry(pair: CatalogSpell[], hud: CharacterHud): RepeaterItem {
  return {
    key: pair.map((row) => row.id).join('-'),
    template: LIST_TEMPLATES.ctr_spellListContainer,
    resolve: (binding: string) => {
      if (binding === 'spell_container') return { style: { width: '100%', height: 66 } }
      if (binding === 'gd_spellButtonsContainer' || binding === 'gd_spellButtons') return { style: { width: '100%', height: 66, display: 'flex', flexDirection: 'row', flexWrap: 'nowrap' } }
      if (binding === 'spell_line_container' || binding === 'tx_spell_bound') return { hidden: true }
      return undefined
    },
    repeaters: {
      gd_spellButtons: pair.map((row) => ({
        key: String(row.id),
        template: LIST_TEMPLATES.gd_spellButtons,
        resolve: spellButtonResolve(row, hud.spell_choices?.flat().find(s => s.id === row.id)?.available ?? true),
        repeaters: { gd_obtentionLevels: obtentionChips(row, hud.character.level, hud.spell_choices?.flat().find(s => s.id === row.id)?.obtention_levels) },
      })),
    },
  }
}

/** SpellListBinding hosts `spellListEntry` in `#ctr_leftSpellContainer` /
    `#ctr_rightSpellContainer`. Even/odd split so `#ctr_spellContainer`
    `flex-direction: row` yields four cards per visual line (each entry is
    two `spellButtonsEntry` at item-width 338). */
function spellRepeaters(hud: CharacterHud): Repeater {
  const pairs = spellVariantPairs(hud)
  if (!pairs.length) return {}
  return {
    ctr_leftSpellContainer: pairs.slice(0, Math.ceil(pairs.length / 2)).map(pair => spellEntry(pair, hud)),
    ctr_rightSpellContainer: pairs.slice(Math.ceil(pairs.length / 2)).map(pair => spellEntry(pair, hud)),
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function ornamentLineResolve(group: CatalogOrnament[]) {
  return (binding: string, scope?: string) => {
    const slot = Number(binding.match(/^ornament(\d+)$/)?.[1] ?? scope?.match(/^ornament(\d+)$/)?.[1] ?? 0)
    const row = slot >= 1 ? group[slot - 1] : undefined
    if (/^ornament\d+$/.test(binding) && !row) return { hidden: true }
    if (!row) return undefined
    if (binding === 'ornamentName') return { text: row.name ?? '' }
    if (binding === 'ornamentIcon') {
      const sprite = ornamentIcon(row.assetId, row.picto)
      return sprite ? { sprite } : undefined
    }
    if (binding === 'ico_favorite') return { hidden: true }
    return undefined
  }
}

function titleLineResolve(group: CatalogTitle[]) {
  return (binding: string, scope?: string) => {
    const slot = Number(binding.match(/^title(\d+)$/)?.[1] ?? scope?.match(/^title(\d+)$/)?.[1] ?? 0)
    const row = slot >= 1 ? group[slot - 1] : undefined
    if (/^title\d+$/.test(binding) && !row) return { hidden: true }
    if (!row) return undefined
    if (binding === 'titleName') return { text: row.name ?? '' }
    if (binding === 'ico_favorite') return { hidden: true }
    return undefined
  }
}

function appearanceRepeaters(): Repeater {
  const ornaments = previewOrnaments()
  const titles = previewTitles()
  if (!ornaments.length && !titles.length) return {}
  const out: Repeater = {}
  if (ornaments.length) {
    out.lv_ornaments = chunk(ornaments, 4).map((group, index) => ({
      key: `orn-${index}`,
      template: LIST_TEMPLATES.lv_ornaments,
      resolve: ornamentLineResolve(group),
    }))
  }
  if (titles.length) {
    out.lv_titles = chunk(titles, 2).map((group, index) => ({
      key: `title-${index}`,
      template: LIST_TEMPLATES.lv_titles,
      resolve: titleLineResolve(group),
    }))
  }
  return out
}

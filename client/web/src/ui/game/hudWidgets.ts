import { worldDisplayStore } from './worldDisplayStore'
import { moduleOptions } from '../official/moduleOptions'
import { createElement, type CSSProperties } from 'react'
import { textTooltip } from '../official/tooltipStore'
import type { BindingOverride, TooltipBinding } from '../official/types'
import type { CharacterHud, HudItem, HudSpell, StatBreakdown } from '../../giny/types'
import {
  hintCategory,
  locationWorldmapId,
  previewOrnaments,
  previewQuests,
  questStepDescription,
  uiString,
  worldmap,
} from './catalog'
import { itemIconUrls, spellIconUrls } from './contentIcons'
import type { CartographyUi, CharacterSheetUi, ChatUi, GameMenuUi, HudView, MinimapUi } from './hudBindings'
import { ItemTooltipBuilder, SpellTooltipBuilder } from './tooltipBuilders'
import { MinimapView } from './MinimapView'
import { WorldMapView } from './WorldMapView'
import { HINT_CATEGORY_IDS, hintFilterBinding, hintFilterSprite, mapCellCenter } from './worldmap'
import { worldmapViewStore } from './worldmapStore'

export function formatInt(value: number): string {
  return Math.trunc(value).toLocaleString('fr-FR')
}

export function ratio(current: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (current / max) * 100))
}

/** Named-index keys C# uses on the character orb. `ctr_ip` is ShowPI
    (`ui.characterInformations.Pi`), not initiative. No key for shield. */
const CHARACTER_TIP_KEYS: Record<string, string> = {
  lbl_pdv: 'ui.stats.lifePoints',
  lbl_pdvTop: 'ui.characterInformations.currentHp',
  lbl_pdvBottom: 'ui.characterInformations.currentAndTotalHp',
  tx_hp: 'ui.stats.lifePoints',
  tx_hpBg: 'ui.stats.lifePoints',
  lbl_pa: 'ui.stats.actionPoints',
  tx_ap: 'ui.stats.actionPoints',
  lbl_pm: 'ui.stats.movementPoints',
  tx_mp: 'ui.stats.movementPoints',
  lbl_ip: 'ui.characterInformations.Pi',
  tx_ip: 'ui.characterInformations.Pi',
  ctr_ip: 'ui.characterInformations.Pi',
}

export function bindCharacterInformations(binding: string, hud: HudView): BindingOverride | undefined {
  const preferences = moduleOptions.get('CharacterInformations')
  const { life, points } = hud
  const known = hud.synchronized !== false
  const fill = ratio(life.current, life.max)
  let override: BindingOverride | undefined
  // C# `CharacterInfosWidgetOptions`: Hp1Line | Hp2Lines | HpPercent, ShowPI | HidePI.
  // UXML ships Hp1Line (`lbl_pdv`) and ShowPI (`ctr_ip`). Official overworld
  // captures use Hp2Lines + HidePI; USS `.withoutPI` is the matching class.
  if (binding === 'parentTopBottom') {
    override = {
      hidden: preferences.hp !== 'total',
      style: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      },
    }
  } else if (binding === 'lbl_pdv') override = { hidden: preferences.hp === 'total', text: preferences.hp === 'percent' ? `${Math.round(fill)} %` : formatInt(life.current) }
  else if (binding === 'lbl_pdvTop') override = { text: known ? formatInt(life.current) : '—' }
  else if (binding === 'lbl_pdvBottom') override = { text: known ? formatInt(life.max) : '—' }
  else if (binding === 'lbl_pa') override = { text: known ? String(points.ap) : '—' }
  else if (binding === 'lbl_pm') override = { text: known ? String(points.mp) : '—' }
  else if (binding === 'lbl_ip') override = { text: known ? formatInt(points.summons) : '—' }
  else if (binding === 'ctr_ip') override = { hidden: !preferences.showInitiative }
  else if (binding === 'CharacterInformations') override = { className: preferences.showInitiative ? 'withPI' : 'withoutPI', style: preferences.small ? {transform:'scale(.75)',transformOrigin:'bottom left'} : undefined }
  else if (binding === 'lbl_shield') override = life.shield > 0 ? { text: formatInt(life.shield) } : { hidden: true }
  else if (binding === 'tx_shield') override = { hidden: life.shield <= 0 }
  else if (binding === 'hp_mask' || binding === 'icon_hp_full') {
    override = { style: { overflow: 'hidden', clipPath: `inset(${(100 - fill).toFixed(1)}% 0 0 0)` } }
  }
  const tipKey = CHARACTER_TIP_KEYS[binding]
  const tip = tipKey ? uiString(tipKey) : undefined
  if (tip && override?.hidden !== true) return { ...override, tooltip: textTooltip(tip) }
  return override
}

/** Widgets MapInfoUI.UpdateContextualOptions / OnContextChanged reveal from live
    context. USS already `display: none` on haven / guild / house / leave /
    leaveWorldmap / dream / breach. `btn_showFightMap` is a UI Builder leftover
    (`display: flex`) the C# `showFight` flag hides out of fight — same class of
    leftover as cartography's anomaly panel. Highlight, info and creature have
    no authored `display: none`; they stay at rest. */
const MAP_INFO_CONTEXT_WIDGETS = [
  'btn_havenBagSettings', 'ctr_guildHallSettings', 'btn_myHouseSettings', 'btn_leave',
  'btn_leaveWorldmap', 'btn_showFightMap', 'btn_spectate', 'ctr_infiniteDreamInfo',
  'ctr_breachBonuses', 'ctr_mapAggresion', 'ctr_mapReward',
]

export function bindMapInfo(binding: string, hud: HudView): BindingOverride | undefined {
  const { map } = hud
  if (binding === 'lbl_mapName') {
    const area = map.area_name
    const sub = map.subarea_name
    const text = area && sub && area !== sub ? `${area} (${sub})` : (sub || area)
    if (!text) return undefined
    return { text, tooltip: textTooltip(text) }
  }
  if (binding === 'lbl_mapCoordsAndLevel') {
    if (!worldDisplayStore.snapshot().coordinates) return { hidden: true }
    if (hud.synchronized === false) return undefined
    // IL2CPP `SetCoordinates` + `SetInfoFromSubarea`. Metadata has no
    // "Niveau" literal: C# looks up `ui.common.level`. The UXML label is
    // empty; brackets around the coords were a homemade format.
    const level = uiString('ui.common.level') ?? 'Niveau'
    return { text: `${map.x}, ${map.y} ${level} ${map.level}` }
  }
  if (MAP_INFO_CONTEXT_WIDGETS.includes(binding)) return { hidden: true }
  if (binding === 'ctr_alliance') return { hidden: !hud.guild }
  if (binding === 'lbl_alliance' && hud.guild) return { text: hud.guild.name }
  return undefined
}

/** IL2CPP `Core.UILogic.Common.GameMenu` / `GameMenuBinding`.

    UXML rest already `display: none` on `#fps` / `#time` and `btn_abo`
    (inline 5). Do not hide `btn_bug` — the generated binding exposes it and
    the overworld capture shows the strip. The web options window is supplied by its host. Do not
    unhide `btn_abo` without a C# shop/subscription flag. */
export function bindGameMenu(binding: string, menu?: GameMenuUi): BindingOverride | undefined {
  if (binding === 'btn_options' && menu?.onOptions) return { onClick: menu.onOptions }
  if (binding === 'btn_menu' && menu?.onToggle) {
    return { onClick: menu.onToggle, state: menu.open ? 'pressed' : undefined }
  }
  return undefined
}

/** HUD XP strip. C# hosts `widgetProgressGauge` as its own MagneticDragWindow
    (UXML left/top 546/860, 566×34). Omega stays `display: none` until the
    snapshot carries an omega rank. */
export function bindProgressGauge(binding: string, hud: HudView): BindingOverride | undefined {
  const preferences = moduleOptions.get('widgetProgressGauge')
  const { experience, character } = hud
  const source = preferences.gauge === 'guild' ? hud.guild : preferences.gauge === 'pods' ? hud.weight : preferences.gauge === 'energy' ? hud.energy : experience
  const amount = source && 'current' in source ? source.current : source?.experience ?? 0
  const floor = source && 'floor' in source ? source.floor : source && 'experience_floor' in source ? source.experience_floor : 0
  const max = source && 'max' in source ? source.max : source && 'next' in source ? source.next : source?.experience_next ?? 0
  const known = hud.synchronized !== false
  if (binding === 'gauge') {
    // UXML omits `gauge-color`. C# `WidgetProgressGaugeUi.InitColor` stamps
    // `GaugeColorEnum` from `gaugesWidgetColors`; every XP bar in UXML and
    // `.gaugeStandard #gaugeStandard_fill` default to `primary`.
    return {
      ...progress(ratio(amount - floor, max - floor)),
      className: 'primary',
    }
  }
  if (binding === 'omega') return {hidden:true}
  if (binding === 'lbl_title') return {text:preferences.gauge==='character'||preferences.gauge==='guild'?'NIV.':preferences.gauge==='pods'?'PODS':'ÉNERGIE'}
  if (binding === 'icon') return {sprite:preferences.gauge==='pods'?'tx_pods':preferences.gauge==='energy'?'energy':'experience'}
  if (binding === 'gaugeStandard_fill' || binding === 'extend-progress-bar__progress') return {style:{backgroundColor:preferences.gaugeColor,backgroundImage:'none'}}
  if (binding === 'lbl_value') return { text: known ? preferences.gauge === 'character' ? String(character.level) : preferences.gauge === 'guild' ? String(hud.guild?.level ?? 0) : `${amount} / ${max}` : '—' }
  return undefined
}

export function bindActionBar(binding: string, scope: string | undefined, hud: HudView): BindingOverride | undefined {
  const preferences = moduleOptions.get('ActionBar')
  if(binding === 'gd_spellitemotes')return {repeat:12*preferences.rows,style:{width:552,height:46*preferences.rows,flexWrap:'wrap',alignContent:'flex-start'}}
  if(preferences.emptyBar && isTileIconBinding(binding))return {sprite:'',hidden:true}
  const slot = Number(scope?.match(/^gd_spellitemotes:(\d+)$/)?.[1] ?? binding.match(/^slot_(\d+)$/)?.[1] ?? -1)
  if (slot < 0) return undefined
  const shortcut = hud.shortcuts.find((item) => item.slot === slot)
  if (isTileIconBinding(binding)) {
    const sprite = spellIconUrls(shortcut?.icon_id)[0]
    return sprite ? { sprite } : undefined
  }
  if (/^slot_\d+$/.test(binding) && shortcut) {
    const spell = hud.spells.find((item) => item.id === shortcut.spell_id)
    const key = slot < 9 ? String(slot + 1) : slot === 9 ? '0' : undefined
    return {
      tooltip: spellTooltip({
        ...spell,
        id: shortcut.spell_id,
        name: shortcut.name,
        grade: spell?.grade ?? 1,
        icon_id: shortcut.icon_id,
      }, key),
    }
  }
  return undefined
}

/** Local-character EntityDisplayer / EntityPortrait UXML names.

    C# `SetEntityLook` / `SetUpEntityDisplayer` paint the session look on the
    host UITK finds with `Q`. Character-sheet UXML uses `ed_entity` (inside
    `EntityPortrait` `#ed_entity_mask`) and `ed_player`. EquipmentComponent.uxml
    — cloned into inventory and appearance — names the same doll
    `#entityDisplayer`. Binding only the sheet names left that 450×475 painter
    empty. `fit` is the host-filling analog of C# `autoSize` on a full-size
    VisualElement; `ed_entity` keeps the renderer default (`portrait`) because
    USS already sizes it 300×300 inside the 96px mask. */
function bindPlayerLook(binding: string, look: string): BindingOverride | undefined {
  if (binding === 'ed_player' || binding === 'ed_entity') return { look }
  if (binding === 'entityDisplayer') return { look, lookMode: 'fit' }
  return undefined
}

export function bindCharacterSheet(binding: string, scope: string | undefined, hud: HudView, sheet?: CharacterSheetUi): BindingOverride | undefined {
  const { character, points, experience, energy, characteristics } = hud
  const known = hud.synchronized !== false
  // UXML lists `btn_detailedView` (lines) first in `tg_statsView`. Official
  // rest shows that list tab, not the radar (`btn_simpleView` / chart).
  const view = sheet?.view ?? 'detailed'
  const detailsOpen = sheet?.detailsOpen ?? false
  if (binding === 'lbl_name') return { text: character.name }
  if (binding === 'lbl_levelValue') return { text: String(character.level) }
  if (binding === 'lbl_class') return { text: character.breed_name.toUpperCase() }
  if (binding === 'lbl_xpValue') return { text: known ? formatInt(experience.current) : '—' }
  if (binding === 'lbl_xpMax') return { text: known ? `/ ${formatInt(experience.next)}` : '' }
  if (binding === 'lbl_energyValue') return { text: known ? formatInt(energy.current) : '—' }
  if (binding === 'lbl_energyMax') return { text: known ? `/ ${formatInt(energy.max)}` : '' }
  if (binding === 'lbl_paValue') return { text: known ? String(points.ap) : '—' }
  if (binding === 'lbl_pmValue') return { text: known ? String(points.mp) : '—' }
  if (binding === 'lbl_poValue') return { text: known ? String(points.range) : '—' }
  if (binding === 'lbl_pointsRemaining') return { text: known ? String(points.stats) : '—' }
  // IL2CPP `UiCharaSheetPointsRemaining` / `get_lbl_pointsRemainingTitle`.
  // UXML dummy is ``[points restants :]``. Do not invent KEY:C — StatSheet
  // has no `shortcut-value`. Do not stamp ``lbl_levelText`` ``[NIV.]``:
  // official omega line is a live C# rewrite, no short-level named key.
  if (binding === 'lbl_pointsRemainingTitle') return namedUiText('ui.charaSheet.pointsRemaining')
  if (binding === 'lbl_xpText') return namedUiText('ui.common.experience')
  if (binding === 'lbl_energyText') return namedUiText('ui.common.energy')
  if (binding === 'btn_distributeMyPoints') {
    const text = uiString('ui.charaSheet.distributeMyPoints')
    return { disabled: points.stats <= 0, className: 'primary', ...(text ? { text } : {}) }
  }
  if (binding === 'entityMainStats') return { className: detailsOpen ? 'Advanced' : 'Simple' }
  if (binding === 'ctr_mainStatsDetails') return { hidden: view === 'detailed' || !detailsOpen }
  if (binding === 'btn_seeDetails') {
    if (view === 'detailed') return { hidden: true }
    return { onClick: sheet?.onToggleDetails }
  }
  if (binding === 'btn_simpleView') {
    return { state: view === 'simple' ? 'pressed' : undefined, onClick: sheet?.onView ? () => sheet.onView?.('simple') : undefined }
  }
  if (binding === 'btn_detailedView') {
    return { state: view === 'detailed' ? 'pressed' : undefined, onClick: sheet?.onView ? () => sheet.onView?.('detailed') : undefined }
  }
  if (binding === 'ctr_simpleStats') return view === 'detailed' ? { hidden: true } : undefined
  if (binding === 'ctr_detailedStats') return { hidden: view !== 'detailed' }
  if (binding === 'pb_xp') return progress(ratio(experience.current - experience.floor, experience.next - experience.floor))
  if (binding === 'pb_energy') return progress(ratio(energy.current, energy.max))
  if (binding === 'statsGraph') {
    return {
      graph: [
        characteristics.vitality.total,
        characteristics.strength.total,
        characteristics.intelligence.total,
        characteristics.chance.total,
        characteristics.agility.total,
        characteristics.wisdom.total,
      ],
    }
  }
  const playerLook = bindPlayerLook(binding, character.look)
  if (playerLook) return playerLook
  const detail = detailedLabel(binding, characteristics)
  if (detail) return { text: detail }
  if (scope === 'btn_guild' || binding === 'btn_guild') return socialGuild(binding, hud)
  if (scope === 'btn_achievements' || binding === 'btn_achievements') return socialAchievements(binding, hud)
  if (['btn_alliance', 'btn_alignment', 'btn_spouse', 'btn_house'].includes(binding)) return { hidden: true }
  return undefined
}

const inventoryIndexes = new WeakMap<HudView['items'], {
  bag: HudView['items']; equipment: Map<number, HudView['items'][number]>
}>()
function inventoryIndex(items: HudView['items']) {
  let index = inventoryIndexes.get(items)
  if (!index) {
    index = { bag: [], equipment: new Map() }
    for (const item of items) {
      if (!item.equipped) index.bag.push(item)
      else if (!index.equipment.has(item.position)) index.equipment.set(item.position, item)
    }
    inventoryIndexes.set(items, index)
  }
  return index
}

export function bindInventory(binding: string, scope: string | undefined, hud: HudView): BindingOverride | undefined {
  const playerLook = bindPlayerLook(binding, hud.character.look)
  if (playerLook) return playerLook
  const { bag, equipment } = inventoryIndex(hud.items)
  const equipmentPosition = scope?.startsWith('grid:')
    ? -1
    : Number(binding.match(/^slot_(\d+)$/)?.[1] ?? -1)
  const equipped = equipmentPosition >= 0
    ? equipment.get(equipmentPosition)
    : undefined
  // EquipmentComponent slots are authored with the exact numeric values from
  // CharacterInventoryPositionEnum. Paint the item on the Slot host: the
  // renderer then forwards that sprite into the official itemTile interior,
  // just like UITK's Slot constructor does. Grid slots are scoped separately
  // (`grid:<index>`) and continue through the inventory-cell path below.
  if (equipped) {
    const sprite = itemIconUrls(equipped)[0]
    return {
      ...(sprite ? { sprite } : {}),
      quantity: equipped.quantity,
      tooltip: itemTooltip(equipped),
      className: 'asset acquiredTrue',
    }
  }
  // UXML ``[Rechercher...]``. ``InputSearchField`` + ``UiCommonSearch``.
  if (binding === 'textInput_placeholder') {
    const text = uiString('ui.common.search')
    return text ? { text } : undefined
  }
  if (binding === 'cb_category') {
    const text = uiString('ui.common.allCategories')
    return text ? { text } : undefined
  }
  if (binding === 'cb_sort') {
    const text = uiString('ui.common.none')
    return text ? { text } : undefined
  }
  if (binding === 'btn_checkCraft') {
    const text = uiString('ui.common.recipes')
    return text ? { text: text.toUpperCase() } : undefined
  }
  if (binding === 'checkboxLine_labelRight') {
    const text = uiString('ui.common.filter')
    return text ? { text } : undefined
  }
  // CharacterPresetManager.ForcePlayerState / PresetsManager.DisplayPlayerStateButton.
  // Inventory hosts `<CharacterPresetManager name="presetManager"/>` in
  // parentFooter; The empty carousel remains visible beneath the player-state row.
  // Captions are named-index keys, not UXML placeholders. Count format matches
  // the authored `[voir tout (22)]` / official `MES ENSEMBLES (0)`.
  if (binding === 'lbl_title') {
    const text = uiString('ui.preset.equipPreset')
    return text ? { text } : undefined
  }
  if (binding === 'btn_action') {
    const text = uiString('ui.preset.myPresets')
    return text ? { text: `${text} (0)`, hidden: false } : undefined
  }
  if (
    binding === 'tg_noBuild'
    || binding === 'btn_newBuild' || binding === 'btn_actionLeft'
  ) {
    return { hidden: true }
  }
  if (binding === 'ctr_builds' || binding === 'ctr_list') return { hidden: false }
  if (binding === 'lbl_kamas') return { text: hud.synchronized === false ? '—' : formatInt(hud.kamas) }
  // This client does not yet supply market estimates or remote-storage access.
  // Keep the authored controls hidden until those runtime capabilities exist.
  if (binding === 'LineEstimation' || binding === 'parentInventories') return { hidden: true }
  if (binding === 'weightBar') return { ...progress(ratio(hud.weight.current, hud.weight.max)), tooltip: { tree: 'TextTooltip', text: `${formatInt(hud.weight.current)} / ${formatInt(hud.weight.max)}` } }
  if (binding === 'podsPreviewTxt') return { text: `${formatInt(hud.weight.current)} / ${formatInt(hud.weight.max)}` }
  if (binding === 'lbl_emptyBox') return bag.length ? { hidden: true } : undefined
  if (binding === 'visibleItemsCount') return { text: String(bag.length) }
  if (binding === 'estimatedValueTxt') return { hidden: true }
  const index = Number(scope?.match(/^grid:(\d+)$/)?.[1] ?? -1)
  if (index < 0) return undefined
  const item = bag[index]
  if (!item) return undefined
  if (isTileIconBinding(binding)) {
    const sprite = itemIconUrls(item)[0]
    return sprite ? { sprite } : undefined
  }
  if (/^slot_\d+$/.test(binding)) return { sprite: itemIconUrls(item)[0], quantity: item.quantity, tooltip: itemTooltip(item), className: 'asset acquiredTrue' }
  return undefined
}

export function bindSpells(binding: string, hud: HudView, scope?: string): BindingOverride | undefined {
  if (binding === 'tab_label') {
    // Second DofusTab keeps UXML `[Autres]`. C# only rewrites the class tab.
    if (scope?.endsWith(':1')) return undefined
    return { text: hud.character.breed_name }
  }
  return undefined
}

export function bindChat(binding: string, chat?: ChatUi): BindingOverride | undefined {
  const preferences = moduleOptions.get('Chat')
  if (binding === 'Chat') return { style: { '--chat-background-opacity': preferences.chatOpacity } as CSSProperties }
  if (binding === 'sv_toggles' && !chat?.collapsed && preferences.largeChatTabs) return { style: { zoom: 1.25 } }
  // Replié via `header_buttonLeft` (expand) : le C# masque l'historique et les
  // onglets, la saisie reste pour continuer à parler.
  if (chat?.collapsed && (binding === 'sv_toggles' || binding === 'listChat')) return { hidden: true }
  if (binding === 'header_buttonLeft' && chat) {
    return {
      onClick: chat.onToggleCollapsed,
      tooltip: textTooltip(chat.collapsed ? 'Agrandir le chat' : 'Réduire le chat'),
      state: chat.collapsed ? 'pressed' : undefined,
    }
  }
  // `+` crée un onglet dont les filtres se règlent au clic droit.
  if (binding === 'btn_addChannel' && chat) {
    return { onClick: chat.onAddChannel, tooltip: textTooltip('Ajouter un onglet (clic droit pour configurer ses canaux)') }
  }
  // Bouton de dialecte : raccourci du canal actif, clic = canal suivant.
  if (binding === 'btn_dialect' && chat) {
    return {
      text: chat.channelShortcut,
      onClick: chat.onCycleChannel,
      tooltip: textTooltip(`Canal : ${chat.channelShortcut} (cliquer pour changer)`),
    }
  }
  // Pastille officielle des messages manqués : masquée à `display: none` au
  // repos, le C# ne l'affiche qu'hors épinglage bas. Clic = retour en bas.
  if (binding === 'btn_news') {
    if (!chat || chat.unread <= 0) return { hidden: true }
    return {
      hidden: false,
      text: `${chat.unread} Nouveau${chat.unread > 1 ? 'x' : ''} message${chat.unread > 1 ? 's' : ''}`,
      onClick: chat.onScrollBottom,
    }
  }
  if (binding === 'ti_chatInput' && chat) {
    return {
      text: chat.draft,
      onInput: (event) => chat.onDraft(event.currentTarget.value),
      onKeyDown: (event) => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Escape') {
          event.currentTarget.blur()
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          chat.onSend()
        }
      },
    }
  }
  return undefined
}

export function bindQuestTracker(binding: string, hud: HudView): BindingOverride | undefined {
  // UXML caption is `quêtes suivies (4)`; C# rewrites only the count.
  if (binding === 'header_label') return { text: `quêtes suivies (${hud.quests.length})` }
  // ``lv_main`` is the official ListView. Rows are ``questList_quest``
  // (`windowRepeaters('questList')`); ``ctr_objectives`` clones
  // ``questList_objective`` from QuestStepsDataRoot + type nameId.
  // Empty followed-quest list stays empty.
  return undefined
}

export function bindQuests(binding: string, hud: HudView): BindingOverride | undefined {
  const current = hud.quests[0]
  if (binding === 'lbl_emptyList') {
    return current || previewQuests().length ? { hidden: true } : undefined
  }
  // C# writes the selected quest's GameData name into `#lbl_questTitle`.
  // Without a live selection, keep the UXML caption rather than stamp ''.
  if (binding === 'lbl_questTitle' && current?.name) return { text: current.name }
  // `#lbl_questDescription` is ``QuestStepData.descriptionId``, not the
  // UI Builder leftover about dieux. Stamp only when GameData has it.
  if (binding === 'lbl_questDescription' && current) {
    const description = questStepDescription(current.id)
    return description ? { text: description } : undefined
  }
  if (binding === 'lbl_objectives') {
    const label = uiString('ui.grimoire.quest.objectives')
    return label ? { text: label } : undefined
  }
  // UXML dummy is ``[Rechercher une quete]``. Named index is the accented
  // caption C# writes; IL2CPP has ``ti_searchQuest`` + ``searchQuest``.
  if (binding === 'textInput_placeholder') {
    const text = uiString('ui.grimoire.quest.searchQuest')
    return text ? { text } : undefined
  }
  // Step 55 `QuestStepRewardData`: kamasRatio 0, experienceRatio 0, empty
  // item lists. UXML leftovers are ``lblb`` / ``Label``. Do not stamp 0.
  if (
    binding === 'ctr_kamasXp'
    || binding === 'lbl_kamas'
    || binding === 'lbl_xp'
    || binding === 'ic_limiter'
  ) {
    return { hidden: true }
  }
  // UI Builder leftover ``int-value="52654"``. C# writes live min/max;
  // those numbers are not in IL2CPP. Keep ``de`` / ``à``. Do not invent 1/200.
  if (binding === 'Min') return { hidden: true }
  return undefined
}

export function bindFriends(binding: string, hud: HudView): BindingOverride | undefined {
  if (binding === 'lbl_accountName') return { text: hud.account.nickname || hud.account.username }
  if (binding === 'lbl_accountTag') return { text: hud.account.tag ? `#${hud.account.tag}` : `#${hud.account.id}` }
  if (binding === 'lbl_ankamaFriendsUnavailable') return { hidden: true }
  // Empty-state labels are authored `position: absolute; width/height: 100%`
  // over the list. Table headers stay in flow; C# only shows them once a
  // ListView has rows. Preview has no social lists.
  if (FRIEND_LIST_HEADERS.has(binding)) return { hidden: true }
  // Designer dummies ``[Contacts en jeu : 6/200]``. C# rewrites from the live
  // roster; no named-index format matches the official ``N/200`` caption.
  if (FRIEND_COUNT_LABELS.has(binding)) return { hidden: true }
  // Unnamed UXML tabs get ``tabs_group:<index>`` (visualNode DofusTab). Host
  // class ``friends`` already shows ``#ctr_inGame`` (USS). Constructor every
  // tab is ``activeFalse``. Official rest + ``UiSocialContactsInGame`` is tab 1.
  if (binding === 'tabs_group:0') return namedUiText('ui.social.ankamaFriends')
  if (binding === 'tabs_group:1') {
    const text = uiString('ui.social.contactsInGame')
    return text ? { text, className: 'activeTrue' } : { className: 'activeTrue' }
  }
  if (binding === 'tabs_group:2') return namedUiText('ui.social.contactInGameBlocked')
  // UXML mash ``[Invitations en attente]`` on the in-game contacts section.
  // IL2CPP ``get_SectionHeader_inGameContact`` + ``UiSocialContactsInGame``.
  if (binding === 'SectionHeader_inGameContact') return namedUiText('ui.social.contactsInGame')
  // ``UiSocialNoFriends`` / ``UiSocialNoInGameContacts``. UXML ``[Aucun amis]``.
  if (binding === 'lbl_noMutualFriends') return namedUiText('ui.social.noFriends')
  if (binding === 'lbl_noInGameContact') return namedUiText('ui.social.noInGameContacts')
  // UXML ``[Ajouter un contacti]``. No ``main-style`` → extractor ``.secondary``;
  // C# enum 0 is primary (same as ``btn_distributeMyPoints`` / ``btn_worldmap``).
  if (binding === 'btn_addInGameFriend') {
    const text = uiString('ui.social.addContact')
    return { className: 'primary', ...(text ? { text } : {}) }
  }
  return undefined
}

function namedUiText(key: string): BindingOverride | undefined {
  const text = uiString(key)
  return text ? { text } : undefined
}

const FRIEND_LIST_HEADERS = new Set([
  'ctr_headerAnkamaFriends',
  'ctr_headerPendingInvitation',
  'ctr_headerMutualFriends',
  'ctr_headerGameContact',
  'ctr_headerBlockedContact',
  'ctr_headerIgnoredContact',
])

const FRIEND_COUNT_LABELS = new Set([
  'lbl_mutualAnkamaFriends',
  'lbl_mutualInGameFriends',
  'lbl_InGameFriends',
  'lbl_blockedContact',
  'lbl_ignoredContact',
])

export function bindGuild(binding: string, hud: HudView, scope?: string): BindingOverride | undefined {
  // `GuildUI.OpenMembersTab` is the default tab (`OnEnable` before the other
  // Open*Tab lambdas). Constructor classes are `activeFalse` for every
  // `DofusTab`. Do not invent KEY:G — `guildBase.uxml` has no shortcut-value.
  if (binding === 'btn_guildMembers') return { className: 'activeTrue' }
  const guild = hud.guild
  // Designer dummy on `guildMembers.uxml` (`Membres : 7/123`). C# rewrites
  // from the live roster. Preview has no guild — do not ship the dummy.
  if (!guild && (binding === 'lbl_membersCount' || binding === 'lbl_averageMembersLevel')) {
    return { hidden: true }
  }
  // Shared `guildMembers.uxml` VTA: UXML `right-Text` is the alliance designer
  // copy. `GuildMembersBinding` (not `AllianceMembersBinding`) + named
  // `UiSocialDisplayOfflineGuildMembers` / `UiSocialWarnWhenGuildMembersComeOnline`.
  // Do not stamp `ui.social.seeRanks` on `btn_manageRanks` — UXML is
  // `[GÉRER LES RANGS]` / `ui.social.manageRanks`.
  if (binding === 'checkboxLine_labelRight' && scope === 'chbx_membersOffline') {
    return namedUiText('ui.social.displayOfflineGuildMembers')
  }
  if (binding === 'checkboxLine_labelRight' && scope === 'chbx_warnAboutMemberConnexion') {
    return namedUiText('ui.social.warnWhenGuildMembersComeOnline')
  }
  // UXML `btn_contribute` has no `main-style` → extractor `.secondary`.
  // C# enum 0 is primary. Caption `UiGuildContribute`.
  if (binding === 'btn_contribute') {
    const text = uiString('ui.guild.contribute')
    return { className: 'primary', ...(text ? { text } : {}) }
  }
  if (!guild) return undefined
  if (binding === 'lbl_guildName') return { text: guild.name }
  if (binding === 'lbl_levelValue') return { text: String(guild.level) }
  if (binding === 'lbl_kamas') return { text: formatInt(guild.kamas) }
  if (binding === 'lbl_guildMotd') return { text: guild.motd || '' }
  if (binding === 'xpBar') return progress(ratio(guild.experience - guild.experience_floor, guild.experience_next - guild.experience_floor))
  return undefined
}

export function bindAppearance(binding: string, hud: HudView, onAppearance?: () => void, scope?: string): BindingOverride | undefined {
  // IL2CPP CosmeticUi.OnAppearanceClicked opens AppearanceUI, a separate
  // WindowFigma (Visages / Corps / Poses / Couleurs), not a body of cosmeticUi.
  if (binding === 'btnAppearance' && onAppearance) return { onClick: onAppearance }
  // Same `[xx]` estimate/pods footer as equipmentStorageUi. Cosmetics has no
  // proven kama or pods binding — hide rather than leave the UXML placeholder.
  if (
    binding === 'estimatedValueTxt' || binding === 'podsPreviewTxt'
    || binding === 'iconKama' || binding === 'iconPods'
  ) return { hidden: true }
  // UXML tabs are ``activeFalse``; the four parents are ``position: absolute``
  // 100% stacked. IL2CPP ``AppearanceFacesTab`` + ``SelectTab`` /
  // ``SwitchToTab``. Rest is the first tab (UXML order). Do not clone face /
  // body slots — those VTAs stay empty until live appearance data.
  if (binding === 'tabFace') {
    const text = uiString('ui.charcrea.faces')
    return { className: 'activeTrue', ...(text ? { text } : {}) }
  }
  if (binding === 'tabBodies') return namedUiText('ui.charcrea.body')
  if (binding === 'tabIdles') return namedUiText('ui.charcrea.idle')
  if (binding === 'tabColors') return namedUiText('ui.charcrea.colors')
  if (binding === 'bodyParent' || binding === 'idleParent' || binding === 'colorParent') {
    return { hidden: true }
  }
  // Designer mash ``Ceci est un test…`` / ``[1/X]``. C# writes live validate
  // copy and the color-set counter; preview has neither.
  if (binding === 'validateInfo' || binding === 'colorCount') return { hidden: true }
  if (binding === 'btnCancel') return namedUiText('ui.common.cancel')
  if (binding === 'btnValidate') return namedUiText('ui.common.validation')
  // ``chk_hideUnavailable`` has no UXML ``right-Text``. Faces-tab rest uses
  // ``UiCosmeticHideUnavailableFaces`` (Bodies / Idles keys exist for the
  // other tabs). Do not stamp ``lbl_color1``–``6`` — channel names are
  // breed data (``UiCharcreaSkin`` / ``Hair`` / ``Clothes``), not all Peau.
  if (binding === 'chk_hideUnavailable') return namedCheckboxText('ui.cosmetic.hideUnavailableFaces')
  if (binding === 'checkboxLine_labelRight' && scope === 'chk_hideUnavailable') {
    return namedUiText('ui.cosmetic.hideUnavailableFaces')
  }
  // CosmeticUi footer. IL2CPP ``get_chk_obtainedFilter`` /
  // ``UiCosmeticNotObtained``, ``get_chk_displayNames`` / ``UiCommonHideNames``.
  // ``ManageElementsCount`` rewrites ``[Elements:]`` from the live grid.
  if (binding === 'chk_obtainedFilter') return namedCheckboxText('ui.cosmetic.notObtained')
  if (binding === 'checkboxLine_labelRight' && scope === 'chk_obtainedFilter') {
    return namedUiText('ui.cosmetic.notObtained')
  }
  if (binding === 'chk_displayNames') return namedCheckboxText('ui.common.hideNames')
  if (binding === 'checkboxLine_labelRight' && scope === 'chk_displayNames') {
    return namedUiText('ui.common.hideNames')
  }
  if (binding === 'elementsCount' || binding === 'visibleItems' || binding === 'visibleItemsCount') {
    return { hidden: true }
  }
  // UXML ``[Rechercher...]``. ``m_inputSearchDefaultText`` + ``UiCommonSearch``.
  if (binding === 'textInput_placeholder') {
    const text = uiString('ui.common.search')
    return text ? { text } : undefined
  }
  if (previewOrnaments().length) {
    if (binding === 'parentOrnaments') return { hidden: false }
    if (binding === 'btnCosmeticOrnaments') return { checked: true }
    if (binding === 'lbl_emptyBox') return { hidden: true }
  }
  return bindPlayerLook(binding, hud.character.look)
}

function namedCheckboxText(key: string): BindingOverride | undefined {
  const text = uiString(key)
  return text ? { text, className: 'checkboxLine' } : undefined
}

const CARTOGRAPHY_MODE_BUTTONS = {
  btn_worldmap: 'worldmap',
  btn_anomaly: 'anomaly',
  btn_conquest: 'conquest',
} as const

/** Grande Carte officielle (`CartographyMapUI`).

    The parchment is `#mapView`; `#zoomControls`, `#ctr_filters` and
    `#gd_worldmaps` are sibling subtrees the resolver reaches separately, so
    they all drive `worldmapViewStore` rather than props. Nothing here invents a
    caption: the filter labels are the twelve `hintcategories.json` rows the
    twelve checkboxes stand for, and the picker lists `worldmaps.json`. */
export function bindMap(binding: string, hud: HudView, cartography?: CartographyUi): BindingOverride | undefined {
  const playerWorldmap = locationWorldmapId(hud.map)
  const view = worldmapViewStore.snapshot()
  const worldmapId = view.worldmapId || playerWorldmap
  const meta = worldmap(worldmapId)

  if (binding === 'resourceQuantities' || binding === 'ctr_breach') return { hidden: true }
  if (binding === 'mapView') {
    return {
      replaceChildren: true,
      style: { overflow: 'hidden' },
      children: createElement(WorldMapView, {
        worldmapId,
        player: worldmapId === playerWorldmap ? { x: hud.map.x, y: hud.map.y } : undefined,
        center: view.center,
        scale: view.scale,
        filters: view.filters,
        showPins: true,
        showCurrentMap: worldmapId === playerWorldmap,
        interactive: true,
        label: meta?.name,
      }),
    }
  }

  // `#zoomControls`: `btn_player` is `ui.cartography.centerOnPlayer`.
  if (binding === 'btn_player') {
    const label = uiString('ui.cartography.centerOnPlayer')
    return {
      onClick: () => {
        const player = worldmap(playerWorldmap)
        if (!player) return
        if (worldmapId !== playerWorldmap) worldmapViewStore.select(playerWorldmap)
        worldmapViewStore.centerOn(mapCellCenter(player, hud.map.x, hud.map.y), true)
      },
      ...(label ? { tooltip: textTooltip(label) } : {}),
    }
  }
  if (binding === 'btn_zoomIn') {
    return { onClick: () => worldmapViewStore.zoomBy(1), disabled: view.scale >= (meta?.maxScale ?? 1) }
  }
  if (binding === 'btn_zoomOut') {
    return { onClick: () => worldmapViewStore.zoomBy(-1), disabled: view.scale <= (meta?.minScale ?? 0) }
  }

  // `#ctr_filters`: one checkbox per `hintcategories.json` row.
  // `#ctr_filters` is a strip of pictos: the `_On` / `_Off` pair is the state
  // and the row is the toggle, so the checkbox line C# folds away stays folded.
  // The caption survives as the row's tooltip — it is the one the UXML's own
  // i18n hint carries (`Moyens de transport`), not the shorter category name.
  const filter = hintFilterBinding(binding)
  if (filter) {
    const on = view.filters.has(filter.filter.category)
    if (filter.part === 'chbx') return { hidden: true }
    if (filter.part === 'tx') return { sprite: hintFilterSprite(filter.filter, on) }
    const name = hintCategory(filter.filter.category)?.name
    return {
      onClick: () => worldmapViewStore.toggleFilter(filter.filter.category),
      style: { cursor: 'pointer' },
      ...(name ? { tooltip: textTooltip(name) } : {}),
    }
  }
  // Same strip, same rest pose: `#tx_displayAll` alone, its caption folded.
  if (binding === 'lbl_displayAll') return { hidden: true }
  if (binding === 'ctr_displayAll') {
    const text = uiString('ui.cartography.displayAllArea')
    return {
      onClick: () => worldmapViewStore.setFilters(HINT_CATEGORY_IDS),
      style: { cursor: 'pointer' },
      ...(text ? { tooltip: textTooltip(text) } : {}),
    }
  }

  if (binding === 'lbl_mapName') return { text: meta?.name ?? hud.map.subarea_name }

  // `#ctr_worldmapList` is authored open so UI Builder can lay it out; the
  // official capture shows the toolbar with the list folded, and `btn_worldmap`
  // is what unfolds it.
  if (binding === 'ctr_worldmapList') return { hidden: !view.pickerOpen }

  // Default is worldmap: `SwitchToConquestOrAnomalyMode` is the C# departure
  // from that rest, not the UXML document pose.
  const mode = cartography?.mode ?? 'worldmap'
  if (binding === 'ctr_locTreeAnomaly') return { hidden: mode !== 'anomaly' }
  if (binding === 'ctr_locTreeConquest') return { hidden: mode !== 'conquest' }
  const selected = CARTOGRAPHY_MODE_BUTTONS[binding as keyof typeof CARTOGRAPHY_MODE_BUTTONS]
  if (!selected) return undefined
  return {
    className: mode === selected ? 'primary' : 'secondary',
    onClick: () => {
      cartography?.onMode?.(selected)
      if (selected === 'worldmap') worldmapViewStore.togglePicker()
      else if (view.pickerOpen) worldmapViewStore.togglePicker()
    },
  }
}

/** MINI-CARTE officielle (`CartographyBannerUI`, `UiWidgetMinimap`).

    `m_mapView` + `m_playerPos`: the same parchment as the big screen, cropped
    around the character, with the hint pins on it. Clicking opens the Carte
    (`ui.cartography.openworldmap`); only `mapView` is clickable, the header
    stays the drag handle. */
export function bindMinimap(binding: string, hud: HudView, minimap?: MinimapUi): BindingOverride | undefined {
  if (binding !== 'mapView') return undefined
  const openLabel = uiString('ui.cartography.openworldmap')
  return {
    ...(minimap?.onOpenMap
      ? {
          onClick: minimap.onOpenMap,
          ...(openLabel ? { tooltip: textTooltip(openLabel) } : {}),
        }
      : {}),
    style: { cursor: 'pointer', overflow: 'hidden' },
    replaceChildren: true,
    children: createElement(MinimapView, {
      worldmapId: locationWorldmapId(hud.map),
      x: hud.map.x,
      y: hud.map.y,
      label: uiString('ui.gameuicore.minimap'),
    }),
  }
}

export function bindBank(binding: string, hud: HudView): BindingOverride | undefined {
  if (binding === 'lbl_kamas') return { text: hud.synchronized === false ? '—' : formatInt(hud.kamas) }
  // Same storage template `[xx]` as equipmentStorageUi: C# writes the estimate.
  if (binding === 'estimatedValueTxt') return { hidden: true }
  if (binding === 'podsPreviewTxt') return { text: `${formatInt(hud.weight.current)} / ${formatInt(hud.weight.max)}` }
  if (binding === 'weightBar') return progress(ratio(hud.weight.current, hud.weight.max))
  return undefined
}

export function bindAchievements(binding: string, hud: HudView): BindingOverride | undefined {
  if (binding === 'lbl_pointsRemaining' || binding === 'lbl_content') return { text: formatInt(hud.achievement_points) }
  // `AchievementsUI.get_defaultCategory` + `MakeSummary` reveal `#ctr_base`
  // (`display: none` at UXML rest). `#ctr_achievements` is the leaf-category
  // list after `OnSelectCategory`. Do not keep the Donjons preview there.
  if (binding === 'ctr_base') return { hidden: false }
  if (binding === 'ctr_achievements' || binding === 'ctr_noAchievement') return { hidden: true }
  // Ending cards need live "almost complete" progress (`FillEndingAchievements`).
  // UXML already `display: none` on `#ctr_endingAchievements`.
  if (binding === 'lbl_myPoints') return { text: formatInt(hud.achievement_points) }
  // Host `#lbl_percent` dummy is ``[75%]`` / bar ``0.48``. Live % is player
  // progress; preview points are 0. Do not keep the designer dummy.
  if (binding === 'lbl_percent') return { text: '0%' }
  if (binding === 'pb_progress') return progress(0)
  // Designer ``[… XX%]``. C# rewrites from the XP limiter; hide without it.
  if (binding === 'ctr_limiter' || binding === 'lbl_xpLimitWarning') return { hidden: true }
  return undefined
}

/** IL2CPP `JobWindowRecipesUI` / `CreateOrUpdateRecipesUI` / `get_tab_recipe`.

    `JobRecipesAndSkills.uxml` ships both `recipesUI` and `jobSkillsUI` as
    `display: none`, and every `DofusTab` as `activeFalse`. C# reveals the
    recipes instance on open (`m_jobWindowRecipesUI`). Do not invent KEY:J —
    `jobUI.uxml` has no `shortcut-value`. Do not stamp `inp_lvlFrom` / `inp_lvlTo`
    (official 1–46 is the live job level, not a rest value). */
export function bindJobs(binding: string, scope?: string): BindingOverride | undefined {
  if (binding === 'tab_recipe') return { className: 'activeTrue' }
  if (binding === 'recipesUI') return { hidden: false }
  // Designer dummies: ``[Possédé : 20]``, ``[1 recette]``. C# rewrites from
  // inventory / `ui.craft.recipesFound`; the named-index format does not
  // match the official ``229 Recettes`` caption, so hide rather than invent.
  if (binding === 'lbl_ingredientsOwned' || binding === 'lbl_nbRecipes') return { hidden: true }
  // `CheckItemRecipesUI` is a separate host. UXML rest clones a dummy
  // `jobRecipeItem` (`[Planche Agglomérée]`) above the filters.
  if (binding === 'ctr_checkRecipeItem') return { hidden: true }
  // Preview always clones `lv_recipe` rows. The empty overlay sits on the
  // list the same way friends' ``lbl_noInGameContact`` does.
  if (binding === 'lbl_noItem') return { hidden: true }
  if (binding === 'checkboxLine_labelRight' && scope === 'chb_condionnedCraft') {
    return namedUiText('ui.craft.conditionalRecipes')
  }
  if (binding === 'checkboxLine_labelRight' && scope === 'chb_possibleOnlyCraft') {
    return namedUiText('ui.craft.possibleRecipes')
  }
  if (binding === 'dpd_category') return namedUiText('ui.common.allCategories')
  if (binding === 'dpd_job') return namedUiText('ui.craft.allJobs')
  // Do not stamp ``dpd_sort`` / ``dpd_missingIngredients`` / ``inp_lvlFrom``:
  // ``Niveau le plus élevé`` and ``0 ingrédient manquant`` have no named hit
  // that matches the official live captions.
  return undefined
}

function socialGuild(binding: string, hud: HudView): BindingOverride | undefined {
  if (binding === 'btn_guild') return hud.guild?.name ? { tooltip: textTooltip(hud.guild.name) } : undefined
  if (binding === 'lbl_content') return hud.guild ? { text: hud.guild.name } : undefined
  if (binding === 'lbl_subContent') return hud.guild ? { text: String(hud.guild.level) } : undefined
  return undefined
}

function socialAchievements(binding: string, hud: HudView): BindingOverride | undefined {
  if (binding === 'lbl_content') return { text: formatInt(hud.achievement_points) }
  return undefined
}

function detailedLabel(binding: string, stats: CharacterHud['characteristics']): string | undefined {
  const map: Record<string, { stat: StatBreakdown; field: keyof StatBreakdown }> = {
    lbl_baseVitality: { stat: stats.vitality, field: 'base_value' },
    lbl_equipmentVitality: { stat: stats.vitality, field: 'equipment' },
    lbl_consumableVitality: { stat: stats.vitality, field: 'additional' },
    lbl_bonusVitality: { stat: stats.vitality, field: 'additional' },
    lbl_baseEarth: { stat: stats.strength, field: 'base_value' },
    lbl_equipmentEarth: { stat: stats.strength, field: 'equipment' },
    lbl_consumableEarth: { stat: stats.strength, field: 'additional' },
    lbl_bonusEarth: { stat: stats.strength, field: 'additional' },
    lbl_baseFire: { stat: stats.intelligence, field: 'base_value' },
    lbl_equipmentFire: { stat: stats.intelligence, field: 'equipment' },
    lbl_consumableFire: { stat: stats.intelligence, field: 'additional' },
    lbl_bonusFire: { stat: stats.intelligence, field: 'additional' },
    lbl_baseWater: { stat: stats.chance, field: 'base_value' },
    lbl_equipmentWater: { stat: stats.chance, field: 'equipment' },
    lbl_consumableWater: { stat: stats.chance, field: 'additional' },
    lbl_bonusWater: { stat: stats.chance, field: 'additional' },
    lbl_baseWind: { stat: stats.agility, field: 'base_value' },
    lbl_equipmentWind: { stat: stats.agility, field: 'equipment' },
    lbl_consumableWind: { stat: stats.agility, field: 'additional' },
    lbl_bonusWind: { stat: stats.agility, field: 'additional' },
    lbl_baseWisdow: { stat: stats.wisdom, field: 'base_value' },
    lbl_equipmentWisdom: { stat: stats.wisdom, field: 'equipment' },
    lbl_consumableWisdom: { stat: stats.wisdom, field: 'additional' },
    lbl_bonusWisdom: { stat: stats.wisdom, field: 'additional' },
  }
  const entry = map[binding]
  return entry ? formatInt(entry.stat[entry.field]) : undefined
}

function progress(percent: number): BindingOverride {
  return { value: percent }
}

function isTileIconBinding(binding: string): boolean {
  return binding === 'itemTile_icon' || binding === 'itemTile_icon_Vector' || binding === 'itemTile_container'
}


function itemTooltip(item: HudItem): TooltipBinding {
  return ItemTooltipBuilder.Build(item)
}

function spellTooltip(spell: HudSpell, shortcut?: string): TooltipBinding {
  return SpellTooltipBuilder.Build(spell, shortcut)
}

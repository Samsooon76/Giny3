import { createContext, useEffect, useSyncExternalStore, type CSSProperties } from 'react'
import { cloneTemplateBody } from './repeaters'
import type { VisualTreeNode } from './types'

/** Unity type selectors match base classes too. Same table as dofus3-ui `build.py`. */
export const UITK_BASES: Record<string, string[]> = {
  DofusLabel: ['Label', 'TextElement', 'BindableElement', 'VisualElement'],
  Label: ['TextElement', 'BindableElement', 'VisualElement'],
  TextElement: ['BindableElement', 'VisualElement'],
  Button: ['TextElement', 'VisualElement'],
  DofusButton: ['Button', 'TextElement', 'VisualElement'],
  DofusButtonCustom: ['Button', 'TextElement', 'VisualElement'],
  DofusToggleButtonCustom: ['Button', 'TextElement', 'VisualElement'],
  DofusVisualElement: ['VisualElement'],
  DofusIcon: ['VisualElement'],
  ScrollView: ['VisualElement'],
  ListView: ['VisualElement'],
  Divider: ['VisualElement'],
  WindowFigma: ['VisualElement'],
  MagneticDragWindow: ['VisualElement'],
  ShortcutFigs: ['VisualElement'],
  TextInput: ['TextField', 'VisualElement'],
  Slot: ['VisualElement'],
  SlotGrid: ['VisualElement'],
  CheckboxCustom: ['VisualElement'],
  Switch: ['VisualElement'],
  Dropdown: ['VisualElement'],
  DofusTab: ['VisualElement'],
  Tag: ['VisualElement'],
  PlayButton: ['VisualElement'],
}

/** Layout USS the compiled JSON still owns when dofus3-ui CSS paints the rest.
    Positions, flex and display stay inline so magnetism and `prepared()` keep
    working; backgrounds, type and 9-slice come from `/uitk/*.css`. */
const LAYOUT_KEYS = new Set([
  'position', 'left', 'top', 'right', 'bottom', 'inset',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'flex', 'flex-grow', 'flex-shrink', 'flex-basis', 'flex-direction', 'flex-wrap',
  'align-items', 'align-self', 'align-content', 'justify-content',
  'gap', 'row-gap', 'column-gap',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'display', 'overflow', 'visibility', 'z-index', 'opacity',
  // UITK `-unity-text-overflow: ellipsis` is layout (single-line clip), not paint.
  // Dropping it on the in-game canvas lets DofusLabel flex-shrink wrap instead.
  'white-space', 'text-overflow',
])

export const UitkPaintContext = createContext(false)
/** True on the in-game HUD surface even before `/uitk/theme.css` has loaded.
    Compiled DarkStone tokens must not land on this canvas: they beat the
    Standard region variables in dofus3-ui (`:where(.uitk-root)`). */
export const UitkHostContext = createContext(false)

/** VisualTreeAssets C# clones into a typed host (`<EntityMainStats/>`,
    `<EquipmentComponentCharacter/>`). Their `rule_index` belongs to the
    template sheet. Classes are `uitk-inline-{template}-{N}` (README §11). */
export const INLINED_UITK_TEMPLATES: Record<string, string> = {
  EntityMainStats: 'EntityMainStats',
  EquipmentComponentCharacter: 'EquipmentComponent',
  CharacterPresetManager: 'presetsManager',
  PresetsManagerOutfit: 'presetsManager',
  EntityPortrait: 'entityPortrait',
  CharacterStatsDetailed: 'CharacterStatsDetailed',
  NoiseParticle: 'NoiseParticle',
}

/** Empty `DofusVisualElement` hosts C# fills by VisualTreeAsset name.
    `SpellBaseUi.SpellList` clones `spellList.uxml` into `#ctr_spellListContainer`
    — the host type is not a component constructor. */
export const INLINED_HOST_BINDINGS: Record<string, string> = {
  ctr_spellListContainer: 'spellList',
  // `QuestsBinding.get_ctr_minMax` + `MinMaxFilterCategoryBinding`. Empty
  // host in `quests.uxml`; C# clones this VTA. Dummy `int-value="52654"`
  // stays unstamped (`bindQuests` hides `#Min`).
  ctr_minMax: 'MinMaxFilterCategory',
}

/** Empty hosts whose binding name is reused across trees (`ctr_content`).
    Keyed by the VisualTreeAsset currently painting (`uitkTemplate` / tree),
    not globally — `quests.uxml` and `guildMembers.uxml` also have that name.
    `GuildUI.OpenMembersTab` clones `guildMembers.uxml` into `guild.uxml`
    `#ctr_content`. `lv_socialMembers` stays empty until member rows exist
    (`get_guildMemberItem` / `GuildMemberItemBinding`). */
export const INLINED_TREE_HOST_BINDINGS: Record<string, Record<string, string>> = {
  guild: { ctr_content: 'guildMembers' },
}

/** Constructor interiors that are not VisualTreeAssets. `useOfficialTree`
    must not fetch `/ui-data/trees/{name}.json` for these names — a 404
    fails the whole window. There is no `DofusTab.uxml`; C# `AddTab`
    instantiates `Core.UILogic.Components.Figma.DofusTab`. Shape matches
    extractor `ADAPTER_TREES["DofusTab"]` + `runtime_classes` (medium /
    text / activeFalse / notificationFalse / normal). Do not clone
    `friends.json` tabs (those carry UXML captions). */
export const INLINE_UITK_TEMPLATES: Record<string, VisualTreeNode> = {
  IconChoice: { type: 'UXML', children: [{ type: 'Button', name: 'icon_choice', style: { width: 32, height: 32, 'flex-shrink': 0, padding: 3, 'align-items': 'center', 'justify-content': 'center' }, children: [{ type: 'Image', name: 'choice_icon', style: { width: 26, height: 26 } }] }] },
  EntityChoice: { type: 'UXML', children: [{ type: 'VisualElement', name: 'entity_choice', style: { width: 72, height: 72, 'flex-shrink': 0, 'background-color': '#2c2d4b', 'border-radius': 6, overflow: 'hidden' } }] },
  EncyclopediaLootSlot: { type: 'UXML', children: [{ type: 'Slot', name: 'loot_slot', classes: ['inventory'], style: { width: 44, height: 44, 'flex-shrink': 0 } }] },
  GenericFilterCategory: { type: 'UXML', children: [{ type: 'VisualElement', name: 'filter', style: { width: '100%' }, children: [
    { type: 'Button', name: 'filter_header', style: { height: 38, width: '100%', 'flex-direction': 'row', 'align-items': 'center', padding: 16, 'justify-content': 'space-between' }, children: [
      { type: 'DofusLabel', name: 'filter_title', classes: ['section_medium'] },
      { type: 'DofusLabel', name: 'filter_toggle', classes: ['title_medium'] },
    ] },
    { type: 'VisualElement', name: 'filter_options', children: [
      { type: 'DofusLabel', name: 'filter_hint', classes: ['textShort_mediumRegular'] },
      { type: 'VisualElement', name: 'filter_choices', style: { padding: 16, 'max-height': 300, overflow: 'scroll' } },
    ] },
  ] }] },
  FilterChoice: { type: 'UXML', children: [{ type: 'CheckboxCustom', name: 'choice', classes: ['checkboxLine', 'large'], style: { height: 28, width: '100%', 'flex-direction': 'row', 'align-items': 'center', gap: 8 }, children: [
    { type: 'VisualElement', name: 'choice_box', style: { width: 18, height: 18, 'flex-shrink': 0, 'border-width': 1, 'border-color': '#aaa6cd' } },
    { type: 'DofusLabel', name: 'choice_label', classes: ['textShort_largeRegular'] },
  ] }] },
  DofusTab: {
    type: 'UXML',
    children: [{
      type: 'DofusTab',
      full_type: 'Core.UILogic.Components.Figma.DofusTab',
      classes: ['tab', 'medium', 'text', 'activeFalse', 'notificationFalse', 'normal'],
      children: [{
        type: 'VisualElement',
        name: 'tab_container',
        binding: 'tab_container',
        children: [
          { type: 'Image', name: 'tab_icon', style: { display: 'none', width: 56, height: 56 } },
          { type: 'DofusLabel', name: 'tab_label', binding: 'tab_label', classes: ['dofusLabel'] },
          { type: 'VisualElement', name: 'tab_CTALine', binding: 'tab_CTALine' },
        ],
      }],
    }],
  },
}

/** VisualTreeAssets the uitk cache carries no stylesheet for.

    `.cache/dofus3/uitk` is written by dofus3-ui (`ready.json` →
    `source: dofus3-ui`), which emits one sheet per document it was asked
    about — 72 of the 685 extracted trees. Linking a sheet it never wrote
    costs a 404 on every render.

    A name only belongs here when the tree loses nothing without its sheet:
    `InlineGridItem_gd_worldmaps_ctr_worldmapCat` declares no external USS, has
    no state rule, and the extractor writes every declaration inline on all
    seven of its nodes, so the clone paints identically. A tree that *does*
    declare a stylesheet needs its compiled paint preserved explicitly (see
    UITK_COMPILED_TREES), otherwise suppressing its 404 would hide a rendering
    defect. `ChatTooltip` is explicitly
    painted from its compiled JSON via OfficialTree's keepPaint fallback.
    Drop a name from here once the generator emits its sheet. */
/** These combat documents have a complete parsed UXML/USS tree, including
 * sprites and pseudo states. Until dofus3-ui emits their per-document sheets,
 * OfficialTree keeps that compiled paint. Constructor controls still use the
 * shared official theme for their runtime states. */
export const UITK_COMPILED_TREES = new Set([
  'FightTimeline', 'timelineFighter', 'EndTurnWidget',
  'challengeSettingsDisplay', 'challengeChoiceDisplay', 'challengeSelectionDisplay',
  'challengeGroup', 'challengeGridSlot', 'ChallengeTooltip',
  'fightResult', 'fightResultSimple', 'fightResultCharacterTab', 'fightResultMonsterLine',
  'fightResultResumeTab', 'fightResultSection', 'fighterResultLine',
  'fightResultStatsTab', 'fightResultStatsItemLine',
  'WorldRpMonstersGroupTooltip', 'MonsterTooltipLine',
])

export const UITK_SHEETLESS_TEMPLATES = new Set([
  'InlineGridItem_gd_worldmaps_ctr_worldmapCat',
  'ChatTooltip',
  'SmileyUI', 'widgetManager', 'CartographySearchUI', 'CartographySearchResultItem',
])

export function hasUitkSheet(name: string): boolean {
  return !UITK_SHEETLESS_TEMPLATES.has(name) && !UITK_COMPILED_TREES.has(name)
}

export function isInlineUitkTemplate(name: string): boolean {
  return Object.hasOwn(INLINE_UITK_TEMPLATES, name)
}

/** UXML `template=` / `component_asset` aliases → the VisualTreeAsset name
    dofus3-ui emits as `uitk-inline-{doc}-{N}`. Proven by
    `relations.json` (`jobCraftTab` → `JobRecipesAndSkills`) and dumped UXML
    (`PresetsManager` → `presetsManager.uxml`). */
export const UITK_SHEET_ALIASES: Record<string, string> = {
  jobCraftTab: 'JobRecipesAndSkills',
  recipes: 'recipesUI',
  PresetsManager: 'presetsManager',
  EntityPortrait: 'entityPortrait',
}

export function uitkSheetAlias(name: string): string {
  return UITK_SHEET_ALIASES[name] ?? name
}

/** Component USS + inlines C# clones into a host. Loaded next to the host
    sheet so template sprites and `#btn_action` rules apply. */
export const UITK_TEMPLATE_SHEETS: Record<string, string[]> = {
  characterSheetUi: [
    'EntityMainStats', 'MainStatItem', 'EntityStatsTable', 'EntityStatsTableItem',
    'statTwoColumnsItem', 'EntityStatsTwoColumns', 'entityPortrait',
    'socialButton', 'CharacterStatsDetailed',
  ],
  equipmentStorageUi: ['EquipmentComponent', 'presetsManager', 'storage', 'entityPortrait', 'NoiseParticle'],
  CharacterPresetUi: ['presetsManager', 'EquipmentComponent', 'entityPortrait'],
  playerSpell: ['spellBase', 'spellList', 'spellListEntry', 'spellButtonsEntry', 'spellList_obtentionLevels'],
  achievements: ['achievementItem', 'achievementSummaryItem'],
  jobUI: ['jobProgressItem', 'jobProgressTab', 'JobRecipesAndSkills', 'jobSkillsUI', 'recipesUI', 'jobRecipeItem'],
  recipesUI: ['jobRecipeItem'],
  quests: ['quest', 'quest_objective', 'MinMaxFilterCategory'],
  questList: ['questList_quest', 'questList_objective'],
  chatview: ['chatItem'],
  friends: ['socialPlayerLine'],
  cosmeticUi: [
    'CosmeticOrnamentLine', 'CosmeticTitleLine',
    'CosmeticOrnament', 'CosmeticTitle', 'presetsManager', 'NoiseParticle',
  ],
  rideParentUI: ['rideParentLine'],
  guildBase: ['guild', 'guildMembers'],
  storageBank: ['storage'],
  auctionHouse: ['storage'],
  CraftUI: ['storage', 'jobRecipeItem', 'recipesUI', 'entityPortrait'],
  mountPaddock: ['breedingLine', 'storage'],
}

/** VisualTreeAsset whose interiors emit `uitk-inline-{template}-{N}`.

    `ed_entity_mask` is storage/entityPortrait inline 3; characterSheetUi
    inline 3 is the 70px header (`padding-left: 126px`). Namespacing keeps
    those inlines from colliding. */
export function inlinedTemplateName(
  type?: string,
  host?: Pick<VisualTreeNode, 'binding' | 'name'>,
  tree?: string,
): string | undefined {
  if (type && INLINED_UITK_TEMPLATES[type]) return INLINED_UITK_TEMPLATES[type]
  const key = host?.binding || host?.name
  if (!key) return undefined
  if (tree) {
    const scoped = INLINED_TREE_HOST_BINDINGS[tree]?.[key]
    if (scoped) return scoped
  }
  return INLINED_HOST_BINDINGS[key]
}

export function uitkNestedTemplate(
  type?: string,
  node?: Pick<VisualTreeNode, 'binding' | 'name' | 'properties' | 'template_expanded' | 'template_alias' | 'component_asset' | 'tab_body'>,
  tree?: string,
): string | undefined {
  const fromHost = inlinedTemplateName(type, node, tree)
  if (fromHost) return fromHost
  if (!node) return undefined
  for (const value of [node.template_expanded, node.template_alias, node.component_asset, node.tab_body]) {
    if (typeof value === 'string' && value) return uitkSheetAlias(value)
  }
  const props = node.properties ?? {}
  const fromProps = props.template ?? props.templateId
  return typeof fromProps === 'string' && fromProps ? uitkSheetAlias(fromProps) : undefined
}

export function uitkSheetNames(tree: string): string[] {
  return UITK_TEMPLATE_SHEETS[tree] ?? []
}

/** Empty typed hosts (`<CharacterPresetManager/>`) clone the VisualTreeAsset
    C# would. Extractor-inlined children win when the cache already has them. */
export function inlinedHostChildren(
  type: string | undefined,
  children: VisualTreeNode[] | undefined,
  templates: Record<string, VisualTreeNode>,
  host?: Pick<VisualTreeNode, 'binding' | 'name'>,
  tree?: string,
): VisualTreeNode[] {
  if (children?.length) return children
  const name = inlinedTemplateName(type, host, tree)
  if (!name) return children ?? []
  const body = cloneTemplateBody(templates[name])
  if (!body) return []
  return [{ ...body, template_expanded: name }]
}

const TEXT_STYLE_NAME = /^[A-Za-z_][\w-]*$/

/** USS `--text-style: "button_medium"` is a class C# applies at resolve time. */
export function applyUitkTextStyle(node: HTMLElement, cs: CSSStyleDeclaration = getComputedStyle(node)): void {
  const named = cs.getPropertyValue('--text-style').replace(/['"]/g, '').trim()
  if (named && TEXT_STYLE_NAME.test(named) && !node.classList.contains(named)) node.classList.add(named)
}

let uitkReady = false
let uitkStarted = false
const uitkListeners = new Set<() => void>()

export function loadUitkTheme() {
  if (uitkStarted) return
  uitkStarted = true
  fetch('/uitk/ready.json')
    .then((response) => { uitkReady = response.ok })
    .catch(() => { uitkReady = false })
    .finally(() => { uitkListeners.forEach((fn) => fn()) })
}

export function useUitkTheme() {
  useEffect(() => { loadUitkTheme() }, [])
  return useSyncExternalStore(
    (listener) => { uitkListeners.add(listener); return () => { uitkListeners.delete(listener) } },
    () => uitkReady,
    () => false,
  )
}

/** `@property --uitk-tint` initial `transparent` computes as `rgba(0,0,0,0)` in
    Chromium. Treating that as a real tint would mask every background sprite. */
export function isActiveUitkTint(tint: string): boolean {
  const value = tint.trim().toLowerCase()
  if (!value || value === 'transparent') return false
  if (/^#(?:0{4}|0{8})$/.test(value)) return false
  const rgb = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/)
  if (rgb) {
    const alpha = rgb[4] == null ? 1 : Number(rgb[4])
    if (alpha === 0) return false
  }
  return true
}

/** Lower `--uitk-tint` the way dofus3-ui `uitk.js` does, after React paints.

    `uitk.js` walks every `div` under `.uitk-panel`. `.header.primary` is now
    a VisualTree node (`stampFigmaHeaders`); ornaments still need this walk
    because their tint lives on USS `--uitk-tint`, not JSON. */
export function applyUitkEffects(root: ParentNode) {
  root.querySelectorAll('div, button, span').forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    if (node.classList.contains('uitk-tint-layer')) return
    const cs = getComputedStyle(node)
    applyUitkTextStyle(node, cs)
    const existingTint = node.querySelector<HTMLElement>(':scope > .uitk-tint-layer')
    if (existingTint) {
      const tint = cs.getPropertyValue('--uitk-tint').trim()
      existingTint.style.filter = isActiveUitkTint(tint) ? `url(#${spriteTintFilter(tint)})` : 'none'
      if (node.dataset.name?.includes('header_ornament')) existingTint.style.backgroundImage = cs.getPropertyValue('--header_ornament')
      if (cs.position === 'static') node.style.position = 'relative'
      return
    }
    const tint = cs.getPropertyValue('--uitk-tint')
    const bg = cs.backgroundImage
    if (!isActiveUitkTint(tint) || bg === 'none') return
    // `inset:0` on the tint layer needs this host as containing block.
    // Unnamed heart ornaments (`uitk-inline-characterInformations-7`) are `position: static`; the
    // layer would otherwise size against `ctr_ornaments` (106×106) and miss
    // the 144×130 winged filigree.
    if (cs.position === 'static') node.style.position = 'relative'
    const layer = document.createElement('i')
    layer.className = 'uitk-tint-layer'
    layer.style.cssText = [
      'position:absolute', 'inset:0', 'pointer-events:none',
      `background-image:${bg}`,
      `background-size:${cs.backgroundSize}`,
      `background-repeat:${cs.backgroundRepeat}`,
      `background-position:${cs.backgroundPosition}`,
      `filter:url(#${spriteTintFilter(tint.trim())})`,
    ].join(';')
    node.insertBefore(layer, node.firstChild)
    node.style.backgroundImage = 'none'
  })
}

/** Unity multiplies sprite RGB by the tint and preserves its details/alpha.
 * An alpha mask discards all RGB information (stone becomes a flat silhouette).
 * A shared SVG filter implements that multiplication for every tinted sprite. */
const spriteTints = new Map<string, string>()
function spriteTintFilter(color: string): string {
  const cached = spriteTints.get(color)
  if (cached && document.getElementById(cached)) return cached
  const ns = 'http://www.w3.org/2000/svg'
  let svg: HTMLElement | SVGSVGElement | null = document.getElementById('official-sprite-tints')
  if (!svg) {
    svg = document.createElementNS(ns, 'svg')
    svg.id = 'official-sprite-tints'
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('width', '0')
    svg.setAttribute('height', '0')
    svg.style.position = 'absolute'
    document.body.appendChild(svg)
  }
  const id = `official-sprite-tint-${svg.childElementCount}`
  const filter = document.createElementNS(ns, 'filter')
  filter.id = id
  filter.setAttribute('color-interpolation-filters', 'sRGB')
  const flood = document.createElementNS(ns, 'feFlood')
  flood.setAttribute('flood-color', color)
  flood.setAttribute('result', 'tint')
  const multiply = document.createElementNS(ns, 'feComposite')
  multiply.setAttribute('in', 'SourceGraphic')
  multiply.setAttribute('in2', 'tint')
  multiply.setAttribute('operator', 'arithmetic')
  multiply.setAttribute('k1', '1')
  filter.append(flood, multiply)
  svg.appendChild(filter)
  spriteTints.set(color, id)
  return id
}

export function uitkAncestry(type: string): string {
  const bases = UITK_BASES[type] ?? ['VisualElement']
  return [type, ...bases].join(' ')
}

export function uitkInlineClass(ruleIndex: unknown, sheet?: string): string | undefined {
  if (typeof ruleIndex !== 'number' || ruleIndex < 0 || !Number.isFinite(ruleIndex)) return undefined
  // dofus3-ui README §11: `uitk-inline-<doc>-<règle>` so a nested template
  // cannot match the host tree's inline of the same index.
  return sheet ? `uitk-inline-${sheet}-${ruleIndex}` : `uitk-inline-${ruleIndex}`
}

export function layoutOnlyUss(style: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!style) return {}
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(style)) {
    if (LAYOUT_KEYS.has(key)) next[key] = value
  }
  return next
}

/** Sprite/9-slice paint a cloned VisualTreeAsset still carries in JSON.

    Template inlines live in `/uitk/trees/{template}.css` as
    `uitk-inline-{template}-{N}`. JSON paint covers the gap until that sheet
    is loaded. */
const PAINT_KEYS = new Set([
  'background-image',
  'background-size',
  'unity-background-scale',
  'unity-background-image-tint-color',
  '-unity-background-image-tint-color',
  'unity-slice-left',
  'unity-slice-right',
  'unity-slice-top',
  'unity-slice-bottom',
])

export function paintUss(style: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!style) return {}
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(style)) {
    if (PAINT_KEYS.has(key)) next[key] = value
  }
  return next
}

/** C# `EntityStatsTwoColumns` / `StatTwoColumnsItem` layout that UXML does not author.

    `EntityStatsTwoColumns.uxml` is an empty `DofusVisualElement` with `gap-value`.
    UITK's default axis is column and `ussToCss` defaults `flexGrow` to 0, so two
    cloned `ctr_stat` children collapse to their padding (2px) inside a 770px
    row. Yoga's equal split of two `flex-grow: 1` items is what C# gets by
    adding the pair to `m_childTwoColumnsItems` — not a width sampled off a PNG.
    The `== null` guard cannot win against that default 0.

    Clones inherit `uitkTemplate` so they emit `uitk-inline-{template}-{N}`
    (README §11). This C# flex must stay on the clone *root* only:
    `statTwoColumnsItem.uxml` `#tx_stat` is already `width/height: 24px;
    flex-shrink: 0`. Applying `flex-grow: 1; flex-basis: 0` there splits the
    name group with the label (~94px icon). */
export function applyClonedStatsLayout(
  template: string | undefined,
  node: Pick<VisualTreeNode, 'name' | 'binding'> | undefined,
  style: CSSProperties,
): void {
  const host = node?.name || node?.binding
  // EntityPortrait's 300px Unity camera surface is clipped to a 96px mask.
  // The web painter frames its own camera: use that mask once, not two zooms.
  if (template?.toLowerCase() === 'entityportrait' && host === 'ed_entity') {
    Object.assign(style, { width: '100%', height: '100%', top: 0, left: 0 })
  }
  if (template === 'EntityStatsTwoColumns' && host === 'ctr_statsTwoColumns') {
    style.flexDirection = 'row'
    if (style.width == null) style.width = '100%'
    if (style.flexShrink == null) style.flexShrink = 0
  }
  if (template === 'statTwoColumnsItem' && host === 'ctr_stat' && style.width == null) {
    style.flexGrow = 1
    style.flexBasis = 0
    style.minWidth = 0
  }
}

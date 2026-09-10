import { describe, expect, it } from 'vitest'
import { applyClonedStatsLayout, applyUitkTextStyle, INLINE_UITK_TEMPLATES, INLINED_HOST_BINDINGS, INLINED_TREE_HOST_BINDINGS, INLINED_UITK_TEMPLATES, inlinedHostChildren, isActiveUitkTint, isInlineUitkTemplate, layoutOnlyUss, paintUss, uitkAncestry, uitkInlineClass, uitkNestedTemplate, uitkSheetAlias, uitkSheetNames } from './uitk'

describe('uitk ancestry', () => {
  it('matches dofus3-ui data-ui for DofusLabel', () => {
    expect(uitkAncestry('DofusLabel')).toBe('DofusLabel Label TextElement BindableElement VisualElement')
  })

  it('duplicates VisualElement like the official converter', () => {
    expect(uitkAncestry('VisualElement')).toBe('VisualElement VisualElement')
  })

  it('names MagneticDragWindow so type selectors can see it', () => {
    expect(uitkAncestry('MagneticDragWindow')).toBe('MagneticDragWindow VisualElement')
  })
})

describe('uitk inline class', () => {
  it('namespaces the inline by source document, like dofus3-ui build.py', () => {
    expect(uitkInlineClass(3, 'storage')).toBe('uitk-inline-storage-3')
    expect(uitkInlineClass(3, 'characterSheetUi')).toBe('uitk-inline-characterSheetUi-3')
    expect(uitkInlineClass(3)).toBe('uitk-inline-3')
    expect(uitkInlineClass(-1, 'storage')).toBeUndefined()
  })
})

describe('layout-only USS', () => {
  it('drops paint so dofus3-ui CSS can win', () => {
    expect(layoutOnlyUss({
      'background-color': '#111',
      'background-image': 'styles/images/x.png',
      color: '#fff',
      width: { value: 42, unit: 'px' },
      display: 'flex',
    })).toEqual({
      width: { value: 42, unit: 'px' },
      display: 'flex',
    })
  })

  it('keeps opacity for Unity 0–100 values the converter still owns', () => {
    expect(layoutOnlyUss({ opacity: 80, 'background-color': '#1b1d32' })).toEqual({ opacity: 80 })
  })

  it('keeps UITK ellipsis clip so labels do not wrap in a flex row', () => {
    expect(layoutOnlyUss({
      'text-overflow': 'ellipsis',
      'white-space': 'normal',
      color: '#fff',
    })).toEqual({
      'text-overflow': 'ellipsis',
      'white-space': 'normal',
    })
  })

  it('keeps cloned-template sprite paint without DarkStone fills', () => {
    expect(paintUss({
      'background-image': 'styles/images/statBack1.png',
      'background-color': '#1b1d32',
      width: { value: 66, unit: 'px' },
    })).toEqual({
      'background-image': 'styles/images/statBack1.png',
    })
  })
})

describe('UITK tint', () => {
  it('ignores the registered transparent initial value', () => {
    expect(isActiveUitkTint('')).toBe(false)
    expect(isActiveUitkTint('transparent')).toBe(false)
    expect(isActiveUitkTint('rgba(0, 0, 0, 0)')).toBe(false)
    expect(isActiveUitkTint('#00000000')).toBe(false)
    expect(isActiveUitkTint('#f0ff4f')).toBe(true)
    expect(isActiveUitkTint('rgba(27, 29, 50, 0.8)')).toBe(true)
  })
})

describe('inlined VisualTreeAsset hosts', () => {
  it('maps equipment, main-stats, preset and portrait constructors to their UXML sheets', () => {
    expect(INLINED_UITK_TEMPLATES.EquipmentComponentCharacter).toBe('EquipmentComponent')
    expect(INLINED_UITK_TEMPLATES.EntityMainStats).toBe('EntityMainStats')
    expect(INLINED_UITK_TEMPLATES.CharacterPresetManager).toBe('presetsManager')
    expect(INLINED_UITK_TEMPLATES.PresetsManagerOutfit).toBe('presetsManager')
    expect(INLINED_UITK_TEMPLATES.EntityPortrait).toBe('entityPortrait')
    expect(INLINED_UITK_TEMPLATES.CharacterStatsDetailed).toBe('CharacterStatsDetailed')
    expect(INLINED_UITK_TEMPLATES.NoiseParticle).toBe('NoiseParticle')
  })

  it('clones presetsManager into an empty CharacterPresetManager host', () => {
    const body = { type: 'DofusVisualElement', name: 'ctr_buildManager', rule_index: 0, children: [] }
    const children = inlinedHostChildren('CharacterPresetManager', [], {
      presetsManager: { type: 'UXML', children: [body] },
    })
    expect(children).toHaveLength(1)
    expect(children[0].name).toBe('ctr_buildManager')
    expect(children[0].rule_index).toBe(0)
    expect(inlinedHostChildren('CharacterPresetManager', [{ name: 'kept' }], {})[0].name).toBe('kept')
  })

  it('clones spellList into the empty ctr_spellListContainer host', () => {
    expect(INLINED_HOST_BINDINGS.ctr_spellListContainer).toBe('spellList')
    expect(uitkNestedTemplate('DofusVisualElement', { binding: 'ctr_spellListContainer' })).toBe('spellList')
    const body = { type: 'DofusVisualElement', name: 'ctr_spellList', rule_index: 1, children: [] }
    const children = inlinedHostChildren('DofusVisualElement', [], {
      spellList: { type: 'UXML', children: [body] },
    }, { binding: 'ctr_spellListContainer' })
    expect(children).toHaveLength(1)
    expect(children[0].name).toBe('ctr_spellList')
    expect(children[0].template_expanded).toBe('spellList')
    expect(children[0].rule_index).toBe(1)
  })

  it('clones MinMaxFilterCategory into the empty ctr_minMax host', () => {
    expect(INLINED_HOST_BINDINGS.ctr_minMax).toBe('MinMaxFilterCategory')
    expect(uitkNestedTemplate('DofusVisualElement', { binding: 'ctr_minMax' })).toBe('MinMaxFilterCategory')
    const body = { type: 'VisualElement', name: 'MinMaxFilterCategory', rule_index: 0, children: [] }
    const children = inlinedHostChildren('DofusVisualElement', [], {
      MinMaxFilterCategory: { type: 'UXML', children: [body] },
    }, { binding: 'ctr_minMax' })
    expect(children).toHaveLength(1)
    expect(children[0].name).toBe('MinMaxFilterCategory')
    expect(children[0].template_expanded).toBe('MinMaxFilterCategory')
  })

  it('clones guildMembers into guild.uxml empty ctr_content only', () => {
    expect(INLINED_TREE_HOST_BINDINGS.guild.ctr_content).toBe('guildMembers')
    expect(INLINED_HOST_BINDINGS.ctr_content).toBeUndefined()
    expect(uitkNestedTemplate('VisualElement', { binding: 'ctr_content' }, 'guild')).toBe('guildMembers')
    expect(uitkNestedTemplate('VisualElement', { binding: 'ctr_content' }, 'quests')).toBeUndefined()
    expect(uitkNestedTemplate('VisualElement', { binding: 'ctr_content' }, 'guildMembers')).toBeUndefined()
    const body = { type: 'VisualElement', name: 'ctr_socialMembers', rule_index: 0, children: [] }
    const children = inlinedHostChildren('VisualElement', [], {
      guildMembers: { type: 'UXML', children: [body] },
    }, { binding: 'ctr_content' }, 'guild')
    expect(children).toHaveLength(1)
    expect(children[0].name).toBe('ctr_socialMembers')
    expect(children[0].template_expanded).toBe('guildMembers')
    expect(inlinedHostChildren('VisualElement', [], {
      guildMembers: { type: 'UXML', children: [body] },
    }, { binding: 'ctr_content' }, 'quests')).toEqual([])
  })

  it('ships an adapter DofusTab without fetching a VisualTreeAsset', () => {
    expect(isInlineUitkTemplate('DofusTab')).toBe(true)
    expect(isInlineUitkTemplate('quest')).toBe(false)
    expect(INLINE_UITK_TEMPLATES.DofusTab?.type).toBe('UXML')
    const tab = INLINE_UITK_TEMPLATES.DofusTab?.children?.[0]
    expect(tab?.type).toBe('DofusTab')
    expect(tab?.classes).toEqual(['tab', 'medium', 'text', 'activeFalse', 'notificationFalse', 'normal'])
    expect(tab?.children?.[0]?.binding).toBe('tab_container')
    expect(tab?.children?.[0]?.children?.map((child) => child.binding)).toEqual([undefined, 'tab_label', 'tab_CTALine'])
    expect(tab?.text).toBeUndefined()
    expect(JSON.stringify(INLINE_UITK_TEMPLATES.DofusTab)).not.toMatch(/Amie Ankama/)
  })
})

describe('nested UITK templates', () => {
  it('maps EntityPortrait and Instance template=storage away from the host sheet', () => {
    expect(uitkNestedTemplate('EntityPortrait', {})).toBe('entityPortrait')
    expect(uitkNestedTemplate('Instance', { properties: { template: 'storage' } })).toBe('storage')
    expect(uitkNestedTemplate('Instance', { template_expanded: 'storage' })).toBe('storage')
  })

  it('stamps extractor tab_body so guild interiors keep the guild sheet', () => {
    expect(uitkNestedTemplate('VisualElement', { tab_body: 'guild' })).toBe('guild')
    expect(uitkNestedTemplate('VisualElement', { tab_body: 'alliance' })).toBe('alliance')
  })

  it('resolves UXML using aliases to the VisualTreeAsset CSS document', () => {
    expect(uitkSheetAlias('jobCraftTab')).toBe('JobRecipesAndSkills')
    expect(uitkSheetAlias('recipes')).toBe('recipesUI')
    expect(uitkNestedTemplate('Instance', { template_expanded: 'jobCraftTab' })).toBe('JobRecipesAndSkills')
    expect(uitkNestedTemplate('Instance', { template_expanded: 'recipes' })).toBe('recipesUI')
    expect(uitkNestedTemplate('PresetsManagerOutfit', { component_asset: 'PresetsManager' })).toBe('presetsManager')
    expect(uitkNestedTemplate('NoiseParticle', { component_asset: 'NoiseParticle' })).toBe('NoiseParticle')
  })

  it('loads spellBase sheets next to playerSpell so nested inlines stay on the template', () => {
    expect(uitkSheetNames('playerSpell')).toEqual([
      'spellBase', 'spellList', 'spellListEntry', 'spellButtonsEntry', 'spellList_obtentionLevels',
    ])
    expect(uitkSheetNames('achievements')).toEqual(['achievementItem', 'achievementSummaryItem'])
    expect(uitkSheetNames('cosmeticUi')).toEqual([
      'CosmeticOrnamentLine', 'CosmeticTitleLine',
      'CosmeticOrnament', 'CosmeticTitle', 'presetsManager', 'NoiseParticle',
    ])
    expect(uitkSheetNames('guildBase')).toEqual(['guild', 'guildMembers'])
    expect(uitkSheetNames('rideParentUI')).toEqual(['rideParentLine'])
    expect(uitkSheetNames('friends')).toEqual(['socialPlayerLine'])
    expect(uitkSheetNames('questList')).toEqual(['questList_quest', 'questList_objective'])
    expect(uitkSheetNames('chatview')).toEqual(['chatItem'])
    expect(uitkSheetNames('quests')).toEqual(['quest', 'quest_objective', 'MinMaxFilterCategory'])
    expect(uitkSheetNames('quests')).not.toContain('DofusTab')
    expect(uitkSheetNames('equipmentStorageUi')).toEqual([
      'EquipmentComponent', 'presetsManager', 'storage', 'entityPortrait', 'NoiseParticle',
    ])
    expect(uitkSheetNames('jobUI')).toEqual([
      'jobProgressItem', 'jobProgressTab', 'JobRecipesAndSkills', 'jobSkillsUI', 'recipesUI', 'jobRecipeItem',
    ])
    expect(uitkSheetNames('storageBank')).toEqual(['storage'])
    expect(uitkSheetNames('CraftUI')).toEqual(['storage', 'jobRecipeItem', 'recipesUI', 'entityPortrait'])
  })
})

describe('cloned EntityStatsTwoColumns layout', () => {
  it('overrides the UITK flexGrow 0 default so ctr_stat can share the row', () => {
    const style = { flexGrow: 0, flexShrink: 1, minWidth: 0, minHeight: 0 }
    applyClonedStatsLayout('statTwoColumnsItem', { name: 'ctr_stat', binding: 'ctr_stat' }, style)
    expect(style).toMatchObject({ flexGrow: 1, flexBasis: 0, minWidth: 0 })
  })

  it('does not stretch #tx_stat: USS already sizes that VisualElement 24×24', () => {
    const style = { width: '24px', height: '24px', flexGrow: 0, flexShrink: 0 }
    applyClonedStatsLayout('statTwoColumnsItem', { name: 'tx_stat', binding: 'tx_stat' }, style)
    expect(style).toEqual({ width: '24px', height: '24px', flexGrow: 0, flexShrink: 0 })
  })

  it('lays EntityStatsTwoColumns on a row, as C# does after cloning the pair', () => {
    const style = {}
    applyClonedStatsLayout('EntityStatsTwoColumns', { name: 'ctr_statsTwoColumns', binding: 'ctr_statsTwoColumns' }, style)
    expect(style).toMatchObject({ flexDirection: 'row', width: '100%', flexShrink: 0 })
  })
})

describe('USS --text-style', () => {
  it('stamps the named typography class C# would apply', () => {
    const names = new Set<string>()
    const node = {
      classList: { add: (name: string) => { names.add(name) }, contains: (name: string) => names.has(name) },
    } as unknown as HTMLElement
    applyUitkTextStyle(node, { getPropertyValue: () => '"button_medium"' } as unknown as CSSStyleDeclaration)
    expect(names.has('button_medium')).toBe(true)
  })

  it('ignores values that are not a class token', () => {
    const names = new Set<string>()
    const node = {
      classList: { add: (name: string) => { names.add(name) } },
    } as unknown as HTMLElement
    applyUitkTextStyle(node, { getPropertyValue: () => 'url(evil)' } as unknown as CSSStyleDeclaration)
    expect(names.size).toBe(0)
  })
})


it('uses the actual portrait mask instead of double framing the 300px Unity camera', () => {
  const style = { width: '300px', height: '300px', top: '-35px', left: 'auto' }
  applyClonedStatsLayout('entityPortrait', { name: 'ed_entity' }, style)
  expect(style).toMatchObject({ width: '100%', height: '100%', top: 0, left: 0 })
  const fullBody = { width: '450px', height: '475px' }
  applyClonedStatsLayout('EquipmentComponent', { name: 'entityDisplayer' }, fullBody)
  expect(fullBody).toEqual({ width: '450px', height: '475px' })
})

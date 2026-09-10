import { describe, expect, it } from 'vitest'
import type { VisualTreeNode } from './types'
import { cloneTemplateBody, expandRepeater, repeaterItemStyle, repeaterTemplateNames, type Repeater } from './repeaters'
import { INLINE_UITK_TEMPLATES } from './uitk'

const characterLine: VisualTreeNode = {
  type: 'UXML',
  children: [{ type: 'VisualElement', binding: 'ctr_characterLine', name: 'ctr_characterLine', children: [] }],
}

const achievementItem: VisualTreeNode = {
  type: 'UXML',
  name: 'InlineGridItem_gd_achievements_ctr_achievement',
  children: [{
    type: 'DofusVisualElement',
    binding: 'ctr_item',
    name: 'ctr_item',
    classes: ['achievementItem'],
    children: [
      { binding: 'tx_iconAchievement', name: 'tx_iconAchievement' },
      { binding: 'lbl_pointsAchievement', name: 'lbl_pointsAchievement' },
    ],
  }],
}

describe('generic official repeaters', () => {
  it('preserves sibling roots when cloning a section with a header and content', () => {
    const source: VisualTreeNode = { type: 'UXML', children: [{ type: 'SectionHeader', binding: 'header' }, { type: 'VisualElement', binding: 'sectionHeaderContent', children: [{ type: 'ListView', binding: 'gd_list' }] }] }
    const clone = cloneTemplateBody(source)!
    expect(clone.children?.map(node => node.binding)).toEqual(['header', 'sectionHeaderContent'])
    expect(clone.children?.[1].children?.[0].binding).toBe('gd_list')
    expect(clone.children).not.toBe(source.children)
  })
  it('collects every requested VisualTreeAsset, not only characterLine', () => {
    const repeaters: Repeater = {
      gd_character: [{ key: '1', template: 'characterLine', resolve: () => undefined }],
      lv_achievements: [
        { key: 'a', template: 'achievementItem', resolve: () => undefined },
        { key: 'b', template: 'achievementItem', resolve: () => undefined },
      ],
    }
    expect(repeaterTemplateNames(repeaters)).toEqual(['achievementItem', 'characterLine'])
  })

  it('collects nested makeItem templates from a cloned row', () => {
    const repeaters: Repeater = {
      ctr_leftSpellContainer: [{
        key: '1',
        template: 'spellListEntry',
        resolve: () => undefined,
        repeaters: {
          gd_spellButtons: [{
            key: '1',
            template: 'spellButtonsEntry',
            resolve: () => undefined,
            repeaters: {
              gd_obtentionLevels: [{ key: '1', template: 'spellList_obtentionLevels', resolve: () => undefined }],
            },
          }],
        },
      }],
    }
    expect(repeaterTemplateNames(repeaters)).toEqual(['spellButtonsEntry', 'spellListEntry', 'spellList_obtentionLevels'])
  })

  it('still clones characterLine for the selection grid', () => {
    const rows = expandRepeater(
      'gd_character',
      { gd_character: [{ key: '42', template: 'characterLine', resolve: () => undefined }] },
      { characterLine },
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.node.binding).toBe('ctr_characterLine')
  })

  it('clones three official achievementItem bodies into lv_achievements without replaceChildren', () => {
    const resolve = () => undefined
    const repeaters: Repeater = {
      lv_achievements: [1, 2, 3].map((id) => ({ key: String(id), template: 'achievementItem', resolve })),
    }
    const rows = expandRepeater('lv_achievements', repeaters, { achievementItem })
    expect(rows).toHaveLength(3)
    expect(rows.every((row) => row.template === 'achievementItem')).toBe(true)
    expect(rows.every((row) => row.node.binding === 'ctr_item')).toBe(true)
    expect(rows.every((row) => row.node.classes?.includes('achievementItem'))).toBe(true)
    expect(rows.map((row) => row.node)).not.toContainEqual(expect.objectContaining({ replaceChildren: true }))
    const successItem: VisualTreeNode = {
      type: 'UXML',
      children: [{ binding: 'ctr_success', name: 'ctr_success', style: { width: { value: 40, unit: 'px' }, height: { value: 40, unit: 'px' } } }],
    }
    const wrong = expandRepeater('lv_achievements', repeaters, { SuccessItem: successItem })
    expect(wrong).toHaveLength(0)
  })

  it('skips a missing VisualTreeAsset instead of inventing a node', () => {
    const body = cloneTemplateBody(undefined)
    expect(body).toBeUndefined()
  })

  it('clones the inline DofusTab adapter into tbg_tabs', () => {
    const rows = expandRepeater(
      'tbg_tabs',
      {
        tbg_tabs: [
          { key: 'pending', template: 'DofusTab', resolve: () => undefined },
          { key: 'completed', template: 'DofusTab', resolve: () => undefined },
        ],
      },
      INLINE_UITK_TEMPLATES,
    )
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.node.type === 'DofusTab')).toBe(true)
    expect(rows[0]?.node.children?.[0]?.binding).toBe('tab_container')
    expect(rows.map((row) => row.node.text).join('')).not.toMatch(/Amie Ankama/)
  })

  it('keeps the template rule_index so namespaced uitk-inline-{doc}-{N} can paint', () => {
    const tree: VisualTreeNode = {
      type: 'UXML',
      children: [{
        type: 'VisualElement',
        binding: 'ctr_stat',
        rule_index: 0,
        children: [{ type: 'VisualElement', rule_index: 1, children: [] }],
      }],
    }
    const body = cloneTemplateBody(tree)
    expect(body?.rule_index).toBe(0)
    expect(body?.children?.[0]?.rule_index).toBe(1)
  })

  it('puts InlineXmlGrid prototypes back in flow for C# makeItem', () => {
    const tree: VisualTreeNode = {
      type: 'UXML',
      children: [{
        type: 'VisualElement',
        binding: 'spell_container',
        style: {
          position: 'absolute',
          display: 'none',
          left: { value: 0, unit: 'px' },
          width: { value: 752, unit: 'px' },
        },
        children: [],
      }],
    }
    const body = cloneTemplateBody(tree)
    expect(body?.style?.position).toBe('relative')
    expect(body?.style?.display).toBeUndefined()
    expect(body?.style?.left).toBeUndefined()
    expect(body?.style?.width).toEqual({ value: 752, unit: 'px' })
  })

  it('sizes FixedHeight ListView slots from the authored fixed-item-height', () => {
    expect(repeaterItemStyle({ properties: { 'fixed-item-height': '122' } })).toEqual({
      flexShrink: 0,
      height: '122px',
      minHeight: '122px',
    })
    expect(repeaterItemStyle({ properties: { 'virtualization-method': 'DynamicHeight' } })).toEqual({ flexShrink: 0 })
    expect(repeaterItemStyle({ properties: { 'item-width': '338', 'item-height': '67' } })).toEqual({
      flexShrink: 0,
      width: '338px',
      minWidth: '338px',
      height: '67px',
      minHeight: '67px',
    })
  })
})

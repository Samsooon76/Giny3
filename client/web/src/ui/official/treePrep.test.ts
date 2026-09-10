import { describe, expect, it } from 'vitest'
import type { VisualTreeNode } from './types'
import { normalizeGapMargins, applyBindingVisibility, applyContentVariantSlots, applyToggleGroupVariants, atRest, collapsedByHiddenChildren, collapsesUnpaintedHost, hasAuthoredSize, hideRuntimeBadges, mounted, prepared, sizeSecondaryXLargeToggles, stampTextInputIcons, withLiveTextInput } from './treePrep'

describe('tree rest pose', () => {
  it('shows a mounted root that shipped display none', () => {
    const node = { type: 'UXML', style: { display: 'none' }, children: [] }
    expect(mounted(node).style?.display).toBe('flex')
  })

  it('lands a full-bleed relative slide-in at top 0', () => {
    const header = {
      name: 'ctr_header',
      style: {
        position: 'relative',
        width: { value: 100, unit: '%' },
        height: { value: 204, unit: 'px' },
        top: { value: -216, unit: 'px' },
      },
      children: [{ name: 'ctr_search', style: { top: { value: 70, unit: 'px' } } }],
    }
    const rest = atRest({ name: 'root', children: [header] })
    expect(rest.children?.[0].style?.top).toBe(0)
    expect(rest.children?.[0].children?.[0].style?.top).toEqual({ value: 70, unit: 'px' })
  })

  it('does not move an absolute or partial overlap', () => {
    const waiting = {
      name: 'tx_waiting',
      style: { position: 'relative', top: { value: -50, unit: 'px' }, height: { value: 44, unit: 'px' } },
    }
    const glow = {
      name: 'glow',
      style: {
        position: 'absolute',
        width: { value: 100, unit: '%' },
        height: { value: 950, unit: 'px' },
        top: { value: -187, unit: 'px' },
      },
    }
    expect(atRest(waiting).style?.top).toEqual({ value: -50, unit: 'px' })
    expect(atRest(glow).style?.top).toEqual({ value: -187, unit: 'px' })
  })

  it('still reveals the root when combining mount and rest', () => {
    const tree = {
      style: { display: 'none' },
      children: [{
        name: 'ctr_header',
        style: {
          position: 'relative',
          width: { value: 100, unit: '%' },
          height: { value: 204, unit: 'px' },
          top: { value: -216, unit: 'px' },
        },
      }],
    }
    const shown = prepared(tree)
    expect(shown.style?.display).toBe('flex')
    expect(shown.children?.[0].style?.top).toBe(0)
  })

  it('hides empty TextInput value layers so the placeholder can be 100% wide', () => {
    const field = {
      type: 'TextInput',
      children: [{
        binding: 'textInput_content',
        children: [
          { binding: 'textInput_placeholder', text: 'Rechercher un ami...', style: { width: { value: 100, unit: '%' } } },
          { binding: 'textInput_text', style: { width: { value: 100, unit: '%' } } },
          { binding: 'textInput_userText', style: { width: { value: 100, unit: '%' } } },
        ],
      }],
    }
    const parts = atRest(field).children?.[0].children ?? []
    expect(parts.find((node) => node.binding === 'textInput_placeholder')?.style?.display).not.toBe('none')
    expect(parts.find((node) => node.binding === 'textInput_text')?.style?.display).toBe('none')
    expect(parts.find((node) => node.binding === 'textInput_userText')?.style?.display).toBe('none')
  })

  it('nests a magnifier on #textInput_iconLeft inside content and does not hide it', () => {
    const field: VisualTreeNode = {
      type: 'TextInput',
      properties: { icon: 'magnifier' },
      children: [{
        binding: 'textInput_content',
        children: [
          { binding: 'textInput_placeholder', text: 'Rechercher...' },
          { binding: 'textInput_text' },
          { binding: 'textInput_userText' },
        ],
      }],
    }
    const stamped = stampTextInputIcons(field)
    const content = stamped.children?.[0]
    expect(content?.children?.[0].binding).toBe('textInput_iconLeft')
    expect(content?.children?.[0].children?.[0].sprite).toBe('magnifier')
    const rest = prepared(field)
    const icon = rest.children?.[0].children?.[0]
    expect(icon?.binding).toBe('textInput_iconLeft')
    expect(icon?.style?.display).not.toBe('none')
    expect(stampTextInputIcons(stamped).children?.[0].children?.filter((node) => node.binding === 'textInput_iconLeft')).toHaveLength(1)
  })

  it('does not invent a loupe when UXML icon is none', () => {
    const field: VisualTreeNode = {
      type: 'TextInput',
      properties: { icon: 'none' },
      children: [{ binding: 'textInput_content', children: [{ binding: 'textInput_placeholder' }] }],
    }
    expect(stampTextInputIcons(field).children?.[0].children?.[0].binding).toBe('textInput_placeholder')
  })

  it('keeps a filled TextInput value layer and hides the placeholder', () => {
    const field = {
      type: 'TextInput',
      children: [{
        binding: 'textInput_content',
        children: [
          { binding: 'textInput_placeholder', text: 'Rechercher un ami...' },
          { binding: 'textInput_userText', text: 'Hell Mina' },
        ],
      }],
    }
    const parts = atRest(field).children?.[0].children ?? []
    expect(parts.find((node) => node.binding === 'textInput_placeholder')?.style?.display).toBe('none')
    expect(parts.find((node) => node.binding === 'textInput_userText')?.style?.display).not.toBe('none')
  })

  it('shows only the user-text layer on a bound TextInput, without absolute layers', () => {
    const parts = [
      { binding: 'textInput_placeholder', text: 'Rechercher un ami...', style: { display: 'flex' } },
      { binding: 'textInput_text', style: { display: 'none' } },
      { binding: 'textInput_userText', style: { display: 'none' } },
    ]
    const live = withLiveTextInput(parts, 'Iopette') ?? []
    expect(live.find((node) => node.binding === 'textInput_placeholder')?.style?.display).toBe('none')
    expect(live.find((node) => node.binding === 'textInput_text')?.style?.display).toBe('none')
    expect(live.find((node) => node.binding === 'textInput_userText')?.style?.display).toBe('flex')
    expect(live.find((node) => node.binding === 'textInput_userText')?.text).toBe('Iopette')
    expect(live.every((node) => node.style?.position == null)).toBe(true)
  })

  it('collapses an unsized host whose children the resolver hides', () => {
    const toolbar: VisualTreeNode = {
      classes: ['backgroundColor_background_medium90'],
      children: [
        { binding: 'btn_showFightMap' },
        { binding: 'btn_highlight' },
        { binding: 'btn_havenBagSettings' },
      ],
    }
    const hidden = (node: VisualTreeNode) => Boolean(node.binding?.startsWith('btn_'))
    expect(collapsedByHiddenChildren(toolbar, hidden)).toBe(true)
    expect(hasAuthoredSize(toolbar.style)).toBe(false)
    const sized = { ...toolbar, style: { width: { value: 500, unit: 'px' } } }
    expect(collapsedByHiddenChildren(sized, hidden)).toBe(false)
    const withCaption = { ...toolbar, text: 'x' }
    expect(collapsedByHiddenChildren(withCaption, hidden)).toBe(false)
    const infos = { children: [{ binding: 'lbl_mapName' }, { binding: 'btn_showFightMap' }] }
    expect(collapsedByHiddenChildren(infos, hidden)).toBe(false)
    const outer = { children: [toolbar] }
    expect(collapsedByHiddenChildren(outer, hidden)).toBe(true)
  })

  it('keeps login ctr_login when the resolver injects the credential form', () => {
    const ctrLogin: VisualTreeNode = {
      binding: 'ctr_login',
      style: { 'flex-grow': 1, display: 'flex' },
      children: [
        { children: [{ binding: 'btn_play' }] },
        { binding: 'ctr_portSelection', children: [{ binding: 'dd_host' }] },
      ],
    }
    const hidden = (node: VisualTreeNode) => ['btn_play', 'ctr_portSelection', 'dd_host'].includes(node.binding ?? '')
    expect(collapsedByHiddenChildren(ctrLogin, hidden)).toBe(true)
    expect(collapsesUnpaintedHost(ctrLogin, hidden, { replaceChildren: true, children: 'form' })).toBe(false)
    expect(collapsesUnpaintedHost(ctrLogin, hidden)).toBe(true)
    expect(collapsesUnpaintedHost(ctrLogin, hidden, { hidden: false })).toBe(false)
    expect(collapsesUnpaintedHost(ctrLogin, hidden, { hidden: true, replaceChildren: true })).toBe(true)
  })

  it('reveals a binding even when display none lives only in a state rule', () => {
    const missing: { display?: string } = {}
    applyBindingVisibility(missing, false)
    expect(missing.display).toBe('flex')
    const none = { display: 'none' }
    applyBindingVisibility(none, false)
    expect(none.display).toBe('flex')
    const untouched = { display: 'none' }
    applyBindingVisibility(untouched, undefined)
    expect(untouched.display).toBe('none')
  })
})

describe('secondary xLarge toggles', () => {
  it('gives xLarge category tabs a 40px fallback instead of the smaller large variant', () => {
    const btnAll: VisualTreeNode = {
      type: 'DofusToggleButtonCustom',
      name: 'btnAll',
      classes: ['toggle', 'button', 'secondary', 'xLarge', 'normal', 'asset', 'activeFalse'],
      style: { height: { value: 32, unit: 'px' } },
      children: [{
        name: 'toggle_container',
        children: [{
          name: 'toggle_icon',
          children: [{ name: 'toggle_icon_Vector', sprite: 'themes/darkStone/sprites/inventory_all.png', style: { width: { value: 100, unit: '%' }, height: { value: 100, unit: '%' } } }],
        }],
      }],
    }
    const sized = sizeSecondaryXLargeToggles(btnAll)
    expect(sized.style?.width).toEqual({ value: 40, unit: 'px' })
    expect(sized.style?.['flex-shrink']).toBe(0)
    expect(sized.children?.[0].style?.width).toEqual({ value: 100, unit: '%' })
    expect(sized.children?.[0].children?.[0].style?.width).toEqual({ value: 100, unit: '%' })
    expect(sized.children?.[0].children?.[0].children?.[0].style?.['unity-background-scale']).toBe('scale-to-fit')
    expect(prepared(btnAll).style?.width).toEqual({ value: 40, unit: 'px' })
  })

  it('hides the toggle notification dot until a binding reveals it', () => {
    const badge: VisualTreeNode = {
      name: 'toggle_indicatorCircle',
      style: { width: { value: 10, unit: 'px' }, 'background-color': '#f0ff4f' },
    }
    expect(hideRuntimeBadges(badge).style?.display).toBe('none')
    expect(prepared({
      type: 'DofusToggleButtonCustom',
      children: [{ name: 'toggle_container', children: [badge] }],
    }).children?.[0].children?.[0].style?.display).toBe('none')
  })
})

describe('content variant slots', () => {
  const iconButton = (): VisualTreeNode => ({
    type: 'DofusButtonCustom',
    name: 'btn_options',
    classes: ['button', 'secondary', 'medium', 'normal', 'icon'],
    sprite: 'icons/cog.png',
    children: [{
      name: 'button_container',
      children: [
        { name: 'button_label' },
        {
          name: 'button_iconLeft',
          style: { width: { value: 20, unit: 'px' }, height: { value: 20, unit: 'px' } },
          children: [{ name: 'button_iconLeft_Vector', sprite: 'icons/cog.png' }],
        },
        {
          name: 'button_iconRight',
          style: { width: { value: 20, unit: 'px' }, height: { value: 20, unit: 'px' } },
          children: [{ name: 'button_iconRight_Vector' }],
        },
      ],
    }],
  })

  function slot(node: VisualTreeNode, id: string): VisualTreeNode | undefined {
    if ((node.binding ?? node.name) === id) return node
    for (const child of node.children ?? []) {
      const found = slot(child, id)
      if (found) return found
    }
    return undefined
  }

  it('hides the empty 20px iconRight on an icon-only button so the glyph centres', () => {
    const next = applyContentVariantSlots(iconButton())
    expect(slot(next, 'button_iconLeft')?.style?.display).not.toBe('none')
    expect(slot(next, 'button_iconLeft_Vector')?.sprite).toBe('icons/cog.png')
    expect(slot(next, 'button_iconRight')?.style?.display).toBe('none')
    expect(slot(next, 'button_label')?.style?.display).toBe('none')
    expect(prepared(iconButton()).children?.[0].children?.[2].style?.display).toBe('none')
  })

  it('keeps a close-button sprite on a text variant and still drops the empty right slot', () => {
    const close: VisualTreeNode = {
      type: 'DofusButtonCustom',
      name: 'header_buttonRight',
      classes: ['button', 'secondary', 'medium', 'normal', 'text'],
      children: [{
        name: 'button_container',
        children: [
          { name: 'button_label' },
          { name: 'button_iconLeft', children: [{ name: 'button_iconLeft_Vector', sprite: 'styles/images/btn_close_normal.png' }] },
          { name: 'button_iconRight', children: [{ name: 'button_iconRight_Vector' }] },
        ],
      }],
    }
    const next = applyContentVariantSlots(close)
    expect(slot(next, 'button_iconLeft')?.style?.display).not.toBe('none')
    expect(slot(next, 'button_iconLeft_Vector')?.sprite).toBe('styles/images/btn_close_normal.png')
    expect(slot(next, 'button_iconRight')?.style?.display).toBe('none')
    expect(slot(next, 'button_label')?.style?.display).not.toBe('none')
  })

  it('moves the glyph onto iconRight when icon-position is Right', () => {
    const link: VisualTreeNode = {
      type: 'DofusButtonCustom',
      name: 'btn_seeRules',
      classes: ['button', 'link', 'small', 'normal', 'textIcon'],
      properties: { 'icon-position': 'Right', icon: 'link' },
      children: [{
        name: 'button_container',
        children: [
          { name: 'button_label', text: 'Règles' },
          { name: 'button_iconLeft', children: [{ name: 'button_iconLeft_Vector', sprite: 'icons/link.png' }] },
          { name: 'button_iconRight', children: [{ name: 'button_iconRight_Vector' }] },
        ],
      }],
    }
    const next = applyContentVariantSlots(link)
    expect(slot(next, 'button_iconLeft')?.style?.display).toBe('none')
    expect(slot(next, 'button_iconLeft_Vector')?.sprite).toBeUndefined()
    expect(slot(next, 'button_iconRight')?.style?.display).not.toBe('none')
    expect(slot(next, 'button_iconRight_Vector')?.sprite).toBe('icons/link.png')
    expect(slot(next, 'button_label')?.style?.display).not.toBe('none')
  })

  it('hides the unused toggle label on an icon toggle', () => {
    const toggle: VisualTreeNode = {
      type: 'DofusToggleButtonCustom',
      name: 'btnBank',
      classes: ['toggle', 'button', 'secondary', 'small', 'normal', 'icon'],
      children: [{
        name: 'toggle_container',
        children: [
          { name: 'toggle_icon', children: [{ name: 'toggle_icon_Vector', sprite: 'icons/money.png' }] },
          { name: 'toggle_label' },
          { name: 'toggle_asset' },
        ],
      }],
    }
    const next = applyContentVariantSlots(toggle)
    expect(slot(next, 'toggle_icon')?.style?.display).not.toBe('none')
    expect(slot(next, 'toggle_label')?.style?.display).toBe('none')
    expect(slot(next, 'toggle_asset')?.style?.display).toBe('none')
  })
})

describe('toggle group variants', () => {
  it('copies authored group main-style and toggle-size onto unauthored child toggles', () => {
    const group: VisualTreeNode = {
      type: 'DofusToggleButtonGroupCustom',
      name: 'tgl_group',
      properties: { 'main-style': 'primary', 'toggle-size': 'large' },
      classes: [],
      children: [{
        type: 'DofusToggleButtonCustom',
        classes: ['toggle', 'button', 'secondary', 'small', 'normal', 'icon', 'activeFalse'],
        properties: { 'icon-value': 'arrowBigUp' },
      }],
    }
    const stamped = applyToggleGroupVariants(group)
    expect(stamped.classes).toEqual(['primary', 'large'])
    expect(stamped.children?.[0].classes).toEqual(['toggle', 'button', 'primary', 'large', 'normal', 'icon', 'activeFalse'])
    expect(prepared(group).classes).toEqual(['primary', 'large'])
  })

  it('does not override a child that authored its own size', () => {
    const group: VisualTreeNode = {
      type: 'DofusToggleButtonGroupCustom',
      properties: { 'main-style': 'primary', 'toggle-size': 'large' },
      children: [{
        type: 'DofusToggleButtonCustom',
        classes: ['toggle', 'button', 'secondary', 'small', 'normal', 'icon'],
        properties: { 'toggle-size': 'small', 'main-style': 'secondary' },
      }],
    }
    const stamped = applyToggleGroupVariants(group)
    expect(stamped.children?.[0].classes).toEqual(['toggle', 'button', 'secondary', 'small', 'normal', 'icon'])
  })

  it('detects authored size when dimensions are string values like 32px or 100%', () => {
    expect(hasAuthoredSize({ width: '32px' })).toBe(true)
    expect(hasAuthoredSize({ height: '100%' })).toBe(true)
    expect(hasAuthoredSize({ 'min-width': '50px' })).toBe(true)
    expect(hasAuthoredSize({ color: '#fff' })).toBe(false)
  })
})


describe('compiled spacing', () => {
  it('removes duplicated half-gap margins and preserves unrelated authored spacing', () => {
    const row = { style: { gap: 12, 'flex-direction': 'row' }, children: [
      { style: { 'margin-right': 6, 'margin-top': 9 } }, { style: { 'margin-left': 6 } },
    ] }
    const fixed = normalizeGapMargins(row)
    expect(fixed.children?.map(child => child.style)).toEqual([
      { 'margin-right': 0, 'margin-top': 9 }, { 'margin-left': 0 },
    ])
    const unrelated = { ...row, style: { ...row.style, gap: 16 } }
    expect(normalizeGapMargins(unrelated)).toBe(unrelated)
    expect(row.children[0].style['margin-right']).toBe(6)
  })
})


describe('serialized icon precedence', () => {
  it('uses the named vector instead of the editor asset fallback', () => {
    const result = prepared({ type: 'DofusToggleButtonCustom', classes: ['asset'], properties: { 'icon-type': 'Icon', 'icon-value': 'helmet', 'image-url': 'inventory_cosmetics.png' }, children: [{ binding: 'toggle_icon', children: [{ binding: 'toggle_icon_Vector', sprite: 'inventory_cosmetics.png' }] }, { binding: 'toggle_asset' }] })
    expect(result.children?.[0].children?.[0].sprite).toBe('helmet')
    expect(result.classes).toContain('icon')
    expect(result.classes).not.toContain('asset')
    expect(result.children?.[1].style?.display).toBe('none')
  })
})

import { describe, expect, it } from 'vitest'
import { restoreFixedWindowSize, allowsWindowDrag, declaredSize, hostWindows, isChromeOnlyWindow, isFlowWindow, isWindowNode, pendingContentMeasure, readWindowChrome, rectFromStyle, shortcutKey, windowIntrinsicSize, WINDOW_TITLE_PROPERTY } from './windowChrome'
import { withWindowFrame } from './windowFrame'
import { stampFigmaHeaders } from './windowHeaders'
import { titleBarHeight, titleBarUss } from './windowChromeStyles'
import { OFFICIAL_CANVAS } from './surface'
import type { VisualTreeNode } from './types'

/** Properties copied from the extracted trees, spelling included. */
const actionBar: VisualTreeNode = {
  type: 'MagneticDragWindow',
  name: 'ActionBar',
  properties: {
    dragPosition: '4', 'drag-position': 'Right', 'header-title': '[Sorts : ligne 1]', 'header-icon': 'Spell',
    'corner-resizable': 'false', 'horizontal-resizable': 'false', 'vertical-resizable': 'false',
  },
  children: [{ name: 'background' }, { name: 'header' }, { name: 'content' }],
}

const characterInformations: VisualTreeNode = {
  type: 'MagneticDragWindow',
  name: 'CharacterInformations',
  properties: {
    dragPosition: '5', 'drag-position': 'Custom',
    'corner-resizable': 'true', 'horizontal-resizable': 'true', 'vertical-resizable': 'true',
  },
  children: [{ name: 'background' }, { name: 'header' }, { name: 'content' }],
}

const partyDisplay: VisualTreeNode = {
  type: 'MagneticDragWindow',
  name: 'PartyDisplay',
  properties: { 'drag-position': 'Custom', 'header-title': '[GROUPE]', 'drag_handle-height': '30' },
  children: [{ name: 'header' }],
}

const notification: VisualTreeNode = {
  type: 'MagneticDragWindow',
  name: 'InternalNotification',
  properties: { 'is-magnetic': 'true', 'is-magnetic-for-others': 'true', 'allow-snap-preview': 'true' },
}

const statSheet: VisualTreeNode = {
  type: 'WindowFigma',
  name: 'StatSheet',
  properties: {
    'no-ornament-header': 'true', 'header-style': 'primary', 'with-title-bar': 'true',
    'show-close-button': 'true', title: '[Caractéristiques]',
  },
}

function hit(...matches: string[]) {
  const set = new Set(matches)
  return {
    closest(selector: string) {
      return selector.split(',').some((part) => set.has(part.trim())) ? {} : null
    },
  }
}

describe('official window flags', () => {
  it('locks down a window whose UXML says every resize is false', () => {
    const chrome = readWindowChrome(actionBar)
    expect(chrome).toMatchObject({
      kind: 'magnetic', id: 'ActionBar', dragPosition: 'Right', title: 'Sorts : ligne 1',
      resize: { horizontal: false, vertical: false, corner: false },
    })
    expect(chrome?.movable).toBe(true)
  })

  it('reads the window the player may resize in every direction', () => {
    expect(readWindowChrome(characterInformations)?.resize).toEqual({ horizontal: true, vertical: true, corner: true })
  })

  it('treats an absent flag as the component default, the way the class list does', () => {
    const chrome = readWindowChrome(partyDisplay)
    expect(chrome?.resize).toEqual({ horizontal: true, vertical: true, corner: true })
    expect(chrome?.magnetic).toBe(true)
    expect(chrome?.handleHeight).toBe(30)
    expect(chrome?.handleName).toBe('header')
  })

  it('keeps a window that attracts the others apart from one that does not', () => {
    expect(readWindowChrome(notification)).toMatchObject({ magneticForOthers: true, snapPreview: true })
    expect(readWindowChrome(notification)?.handleName).toBeUndefined()
  })

  it('gives a WindowFigma no UXML handle of its own, since C# builds its bar', () => {
    const chrome = readWindowChrome(statSheet)
    expect(chrome).toMatchObject({
      kind: 'figma', closeButton: true, titleBar: true, ornament: false, title: 'Caractéristiques',
    })
    // Nothing in the character sheet's UXML says it may be resized, and the
    // official client does not let the player resize it either.
    expect(chrome?.resize).toEqual({ horizontal: false, vertical: false, corner: false })
    expect(chrome?.handleName).toBeUndefined()
  })

  it('treats the injected .header.primary as the WindowFigma drag handle', () => {
    const stamped = stampFigmaHeaders({
      ...statSheet,
      children: [{ name: 'window_content', binding: 'window_content' }],
    })
    const chrome = readWindowChrome(stamped)
    expect(chrome?.handleName).toBe('header')
    expect(stamped.children?.map((child) => child.name)).toEqual(['header', 'window_content'])
    const label = stamped.children?.[0].children?.find((child) => child.name === 'header_content')
      ?.children?.[0].children?.[0]
    expect(label?.name).toBe('header_titleLabel')
    expect(label?.text).toBe('Caractéristiques')
    expect(stamped.children?.[0].children?.map((child) => child.name)).toEqual([
      'header_left', 'header_content', 'header_right',
    ])
    expect(stamped.children?.[0].children?.find((child) => child.name === 'header_left')?.style?.position).toBe('absolute')
    expect(stamped.children?.[0].children?.find((child) => child.name === 'header_content')?.style?.position).toBe('absolute')
    const titleKids = stamped.children?.[0].children?.find((child) => child.name === 'header_content')
      ?.children?.[0].children?.map((child) => child.name)
    expect(titleKids).toEqual(['header_titleLabel'])
  })

  it('paints UXML shortcut-value as header_shortcut, not an invented [C]', () => {
    expect(shortcutKey('KEY:S')).toBe('S')
    expect(shortcutKey('KEY:F')).toBe('F')
    expect(shortcutKey('V')).toBe('V')
    expect(shortcutKey('KEY:Alt,TXT:+,ICON:mouseLeft')).toBe('Alt')
    expect(shortcutKey('ICON:mouseRight')).toBeUndefined()
    expect(shortcutKey(undefined)).toBeUndefined()
    const spells = stampFigmaHeaders({
      type: 'WindowFigma',
      name: 'PlayerSpell',
      properties: { title: '[Sorts]', 'with-title-bar': 'true', 'shortcut-value': 'KEY:S' },
      children: [{ name: 'window_content', binding: 'window_content' }],
    })
    const title = spells.children?.[0].children?.find((child) => child.name === 'header_content')
      ?.children?.[0]
    expect(title?.children?.map((child) => child.name)).toEqual(['header_titleLabel', 'header_shortcut'])
    const chip = title?.children?.[1]
    expect(chip).toMatchObject({
      type: 'ShortcutFigs',
      classes: ['CTAElements', 'filled', 'single', 'purple'],
    })
    expect(chip?.children?.[0].children?.[0]).toMatchObject({ name: 'CTAElements_label', text: 'S' })
    expect(title?.children?.[0].style?.['flex-grow']).not.toBe(1)
    const close = spells.children?.[0].children?.find((child) => child.name === 'header_right')
      ?.children?.[0]
    expect(close).toMatchObject({ name: 'header_buttonRight', type: 'DofusButtonCustom' })
    expect(spells.children?.[0].children?.find((child) => child.name === 'header_right')
      ?.children?.map((child) => child.name)).toEqual(['header_buttonRight'])
    const market = stampFigmaHeaders({
      type: 'WindowFigma',
      name: 'ctr-window',
      properties: {
        title: '[Hotel de vente]', 'with-title-bar': 'true',
        'show-help-button': 'true', 'help-icon': 'cog',
      },
      children: [{ name: 'window_content', binding: 'window_content' }],
    })
    expect(market.children?.[0].children?.find((child) => child.name === 'header_right')
      ?.children?.map((child) => child.name)).toEqual(['header_buttonHelp', 'header_buttonRight'])
    expect(market.children?.[0].children?.find((child) => child.name === 'header_right')
      ?.children?.[0]).toMatchObject({ name: 'header_buttonHelp', sprite: 'cog' })
    expect(readWindowChrome({
      type: 'WindowFigma', name: 'PlayerSpell', properties: { 'shortcut-value': 'KEY:S' },
    })?.helpButton).toBe(false)
    const noClose = stampFigmaHeaders({
      type: 'WindowFigma',
      name: 'paddockWindow',
      properties: { title: '[Elevage]', 'with-title-bar': 'true', 'show-close-button': 'false' },
      children: [{ name: 'window_content', binding: 'window_content' }],
    })
    expect(noClose.children?.[0].children?.find((child) => child.name === 'header_right')?.children).toEqual([])
    const sheet = stampFigmaHeaders({
      ...statSheet,
      children: [{ name: 'window_content', binding: 'window_content' }],
    })
    const sheetTitle = sheet.children?.[0].children?.find((child) => child.name === 'header_content')
      ?.children?.[0]
    expect(sheetTitle?.children?.map((child) => child.name)).toEqual(['header_titleLabel'])
    expect(readWindowChrome({
      type: 'WindowFigma', name: 'PlayerSpell', properties: { 'shortcut-value': 'KEY:S' },
    })?.shortcut).toBe('S')
    expect(readWindowChrome(statSheet)?.shortcut).toBeUndefined()
  })

  it('injects header_shortcut into a cache header that still lacks it', () => {
    const stamped = stampFigmaHeaders({
      type: 'WindowFigma',
      name: 'FriendsUI',
      properties: { title: '[Amis]', 'with-title-bar': 'true', 'shortcut-value': 'KEY:F' },
      children: [{
        name: 'header',
        binding: 'header',
        classes: ['header', 'primary'],
        children: [{
          name: 'header_content',
          children: [{
            name: 'header_title',
            children: [{ name: 'header_titleLabel', binding: 'header_titleLabel', text: '[Amis]' }],
          }],
        }],
      }, { name: 'window_content', binding: 'window_content' }],
    })
    const title = stamped.children?.[0].children?.find((child) => child.name === 'header_content')
      ?.children?.[0]
    expect(title?.children?.map((child) => child.name)).toEqual(['header_titleLabel', 'header_shortcut'])
    expect(title?.children?.[1].children?.[0].children?.[0].text).toBe('F')
    expect(stamped.children?.[0].children?.find((child) => child.name === 'header_right')
      ?.children?.[0]).toMatchObject({ name: 'header_buttonRight', type: 'DofusButtonCustom' })
  })

  it('writes Cosmétiques onto CosmeticUi header_titleLabel, not Inventaire', () => {
    const stamped = stampFigmaHeaders({
      type: 'WindowFigma',
      name: 'CosmeticUi',
      properties: { title: '[Inventory]', 'with-title-bar': 'true' },
      children: [{ name: 'window_content', binding: 'window_content' }],
    })
    const label = stamped.children?.[0].children?.find((child) => child.name === 'header_content')
      ?.children?.[0].children?.[0]
    expect(label?.text).toBe('Cosmétiques')
  })

  it('writes ui.widgetMinimap onto the CartographyBanner magnetic header_label', () => {
    const stamped = stampFigmaHeaders({
      type: 'MagneticDragWindow',
      name: 'CartographyBanner',
      properties: { 'header-title': '[MINI-MAP]' },
      children: [{
        name: 'header',
        children: [{ name: 'header_label', binding: 'header_label', text: 'MINI-MAP' }],
      }],
    })
    expect(stamped.children?.[0].children?.[0].text).toBe('Mini carte')
  })

  it('CreateHeader omit-default fills header_buttonRight with moreActions', () => {
    expect(readWindowChrome(actionBar)?.rightIcon).toBe('moreActions')
    expect(readWindowChrome({
      type: 'MagneticDragWindow',
      name: 'raidTracking',
      properties: { 'header-icon-right': 'none', 'header-title': '[Raid]' },
      children: [{ name: 'header' }],
    })?.rightIcon).toBeUndefined()
    expect(readWindowChrome({
      type: 'MagneticDragWindow',
      name: 'Chat',
      properties: { 'header-icon-left': 'expand', 'header-title': '[CHAT]' },
      children: [{ name: 'header' }],
    })?.leftIcon).toBe('expand')
    const chat = stampFigmaHeaders({
      type: 'MagneticDragWindow',
      name: 'Chat',
      properties: { 'header-title': '[CHAT]', 'header-icon-left': 'expand' },
      children: [{
        name: 'header',
        children: [{
          name: 'header_content',
          children: [
            { name: 'header_left', binding: 'header_left', children: [] },
            { name: 'header_buttonLeft', binding: 'header_buttonLeft', sprite: 'icons/expand.png' },
            { name: 'header_label', binding: 'header_label', text: 'CHAT' },
          ],
        }],
      }],
    })
    const header = chat.children?.[0]
    expect(header?.children?.map((child) => child.name)).toEqual([
      'header_left', 'header_content', 'header_right',
    ])
    const content = header?.children?.find((child) => child.name === 'header_content')
    expect(content?.children?.some((child) => child.name === 'header_left' || child.name === 'header_buttonLeft')).toBe(false)
    const left = header?.children?.find((child) => child.name === 'header_left')
    expect(left?.style?.position).toBe('absolute')
    expect(left?.children?.[0]).toMatchObject({
      name: 'header_buttonLeft', type: 'DofusButtonCustom', sprite: 'icons/expand.png',
    })
    const right = header?.children?.find((child) => child.name === 'header_right')
    expect(right?.style?.position).toBe('absolute')
    expect(right?.children?.[0]).toMatchObject({
      name: 'header_buttonRight', type: 'DofusButtonCustom', sprite: 'moreActions',
    })
  })

  it('does not invent a magnetic kebab when header-icon-right is none', () => {
    const stamped = stampFigmaHeaders({
      type: 'MagneticDragWindow',
      name: 'raidTracking',
      properties: { 'header-icon-right': 'none', 'header-title': '[Raid en cours]' },
      children: [{
        name: 'header',
        children: [{ name: 'header_label', binding: 'header_label', text: 'Raid en cours' }],
      }],
    })
    expect(stamped.children?.[0].children?.find((child) => child.name === 'header_right')).toBeUndefined()
    expect(stamped.children?.[0].children?.find((child) => child.name === 'header_buttonRight')).toBeUndefined()
  })

  it('localizes the inventory constructor literal in the title bar', () => {
    const chrome = readWindowChrome({
      type: 'WindowFigma', name: 'PlayerInventory',
      properties: { title: '[Inventory]' },
    })
    expect(chrome?.title).toBe('Inventaire')
  })

  it('does not stamp Inventaire on CosmeticUi, which reuses the Inventory slot', () => {
    expect(readWindowChrome({
      type: 'WindowFigma', name: 'CosmeticUi',
      properties: { title: '[Inventory]' },
    })?.title).toBe('Cosmétiques')
    expect(readWindowChrome({
      type: 'WindowFigma', name: 'SomeOtherStorage',
      properties: { title: '[Inventory]' },
    })?.title).toBeUndefined()
  })

  it('localizes the bank constructor literal on BankWindow only', () => {
    expect(readWindowChrome({
      type: 'WindowFigma', name: 'BankWindow',
      properties: { title: '[Bank]' },
    })?.title).toBe('Banque')
    expect(readWindowChrome({
      type: 'WindowFigma', name: 'NpcStore',
      properties: { title: '[Bank]' },
    })?.title).toBeUndefined()
  })

  it('only starts a WindowFigma move from the constructed title bar', () => {
    const chrome = readWindowChrome(statSheet)!
    expect(allowsWindowDrag(chrome, hit())).toBe(false)
    expect(allowsWindowDrag(chrome, hit('[data-drag-handle]'))).toBe(true)
    expect(allowsWindowDrag(chrome, hit('button'))).toBe(false)
    expect(allowsWindowDrag(chrome, hit('[data-window-grip]'))).toBe(true)
  })

  it('keeps a MagneticDragWindow without a header dragging from its body', () => {
    const chrome = readWindowChrome(notification)!
    expect(allowsWindowDrag(chrome, hit())).toBe(true)
    expect(allowsWindowDrag(readWindowChrome(partyDisplay)!, hit())).toBe(false)
    expect(allowsWindowDrag(readWindowChrome(partyDisplay)!, hit('[data-drag-handle]'))).toBe(true)
  })

  it('picks the header variant `header-style` names, and its icon', () => {
    const chrome = readWindowChrome({
      type: 'WindowFigma',
      name: 'PlayerInventory',
      properties: { 'header-style': 'primary', 'img-url': 'Assets/UI/Themes/Figma/menuIcons/inventory.png', title: '[Inventory]' },
    })
    expect(chrome).toMatchObject({ headerStyle: 'primary', icon: 'Assets/UI/Themes/Figma/menuIcons/inventory.png' })
    expect(readWindowChrome({ type: 'WindowFigma', name: 'x', properties: { 'header-style': 'secondary' } })?.headerStyle).toBe('secondary')
    expect(readWindowChrome({ type: 'WindowFigma', name: 'RideParentUi', properties: { title: 'Headline', [WINDOW_TITLE_PROPERTY]: 'Monture' } })?.title).toBeUndefined()
    // A named-index key the extractor has not inlined stays visible. The
    // official string is `ui.common.guild` → «Guilde», written into the cache
    // — the chrome does not invent a French caption of its own.
    expect(readWindowChrome({
      type: 'WindowFigma', name: 'GuildBaseUI',
      properties: { title: '[UI.COMMON.GUILD]', 'with-title-bar': 'true' },
    })?.title).toBe('UI.COMMON.GUILD')
    expect(readWindowChrome({
      type: 'WindowFigma', name: 'GuildBaseUI',
      properties: { title: 'Guilde', 'with-title-bar': 'true' },
    })?.title).toBe('Guilde')
    expect(readWindowChrome({
      type: 'MagneticDragWindow', name: 'BannerMenu',
      properties: { 'header-title': '[Menu]' },
    })?.title).toBe('Menu')
    expect(readWindowChrome({
      type: 'MagneticDragWindow', name: 'CartographyBanner',
      properties: { 'header-title': '[MINI-MAP]' },
    })?.title).toBe('Mini carte')
    // `none` is the UXML way of saying a slot carries no icon at all.
    expect(readWindowChrome({ type: 'MagneticDragWindow', name: 'y', properties: { 'header-icon': 'none' } })?.icon).toBeUndefined()
  })

  it('builds the bar out of the `.header` family, flush on the panel it tops', () => {
    expect(titleBarHeight('primary')).toBe(42)
    expect(titleBarHeight('secondary')).toBe(38)
    const bar = titleBarUss('primary').bar
    // The window's own 12px corners, closed by the bar rather than covered.
    expect(bar['border-top-left-radius']).toEqual({ value: 12, unit: 'px' })
    expect(bar.top).toEqual({ value: 0, unit: 'px' })
    expect(bar.position).toBe('relative')
    // `--background_dark100` under `--header_background`: the bar is the
    // panel's top edge, so the 20% Standard tint sits on the panel fill.
    expect(bar['background-color']).toBe('#1b1d32ff')
    const primary = titleBarUss('primary')
    // MediumFont_Standard tokens (`--header_background`, `--header_gradient`,
    // `--header_ornament`, `--highlight_secondary100`). GoldAndSteel values
    // (`#ff5e3333`, `ornamentGoldAndSteel.png`) are a different theme.
    expect(primary.tint['background-color']).toBe('#b6b3e533')
    expect(primary.highlight['unity-background-image-tint-color']).toBe('#b6b3e5cc')
    expect(primary.ornament['background-image']).toBe('styles/images/ornamentStandard.png')
    expect(primary.ornament['unity-background-image-tint-color']).toBe('#b6b3e6ff')
    expect(titleBarUss('secondary').tint['background-color']).toBe('#b6b3e659')
  })

  it('keeps the official title when the host also supplies a label', () => {
    const framed = withWindowFrame({ type: 'UXML', children: [statSheet] }, { id: 'character', title: 'Personnage', size: { width: 900, height: 880 } })
    expect(readWindowChrome(framed.children![0])?.title).toBe('Caractéristiques')
  })

  it('recognises only the two official window components', () => {
    expect(isWindowNode({ type: 'VisualElement' })).toBe(false)
    expect(isWindowNode(actionBar)).toBe(true)
    expect(readWindowChrome({ type: 'VisualElement', name: 'content' })).toBeUndefined()
  })
})

describe('placement from the extracted USS', () => {
  it('resolves a chat pinned by its left and bottom edges', () => {
    const rect = rectFromStyle(
      { position: 'absolute', left: 0, bottom: 0, width: { value: 400, unit: 'px' }, height: { value: 244, unit: 'px' } },
      OFFICIAL_CANVAS,
      { width: 480, height: 360 },
    )
    expect(rect).toEqual({ x: 0, y: OFFICIAL_CANVAS.height - 244, w: 400, h: 244 })
  })

  it('resolves a banner pinned by its right edge', () => {
    const rect = rectFromStyle(
      { right: 0, top: { value: 55, unit: 'px' }, width: { value: 42, unit: 'px' }, height: { value: 249, unit: 'px' } },
      OFFICIAL_CANVAS,
      { width: 480, height: 360 },
    )
    expect(rect).toMatchObject({ x: OFFICIAL_CANVAS.width - 42, y: 55, w: 42 })
  })

  it('centres a window whose USS pins nothing and falls back for its size', () => {
    const rect = rectFromStyle({}, OFFICIAL_CANVAS, { width: 900, height: 880 })
    expect(rect).toEqual({ x: 510, y: 100, w: 900, h: 880 })
  })

  it('centres a HUD window in the area below the shell inset', () => {
    // API only: GameHud does not pass insetTop (no official shellInset).
    const rect = rectFromStyle({}, OFFICIAL_CANVAS, { width: 900, height: 880 }, 'Custom', 82)
    expect(rect).toEqual({ x: 510, y: 141, w: 900, h: 880 })
  })

  it('reports an undeclared axis, so the window is measured instead of guessed', () => {
    // The character sheet is authored `height: 880` and nothing else: Unity
    // sizes an absolute element to its content, so its width is not a value
    // the client may invent.
    expect(declaredSize({ height: { value: 880, unit: 'px' }, position: 'absolute' })).toEqual({ width: false, height: true })
    // A percentage is not a size either: it measures the host, and the window
    // is the host.
    expect(declaredSize({ width: { value: 100, unit: '%' }, height: { value: 100, unit: '%' } })).toEqual({ width: false, height: false })
    expect(declaredSize({ width: { value: 1330, unit: 'px' }, height: { value: 930, unit: 'px' } })).toEqual({ width: true, height: true })
  })

  it('docks an unpinned window against the edge its drag-position names', () => {
    const right = rectFromStyle({}, OFFICIAL_CANVAS, { width: 200, height: 100 }, 'Right')
    expect(right.x).toBe(OFFICIAL_CANVAS.width - 200)
    const top = rectFromStyle({}, OFFICIAL_CANVAS, { width: 200, height: 100 }, 'Top')
    expect(top.y).toBe(0)
  })

  it('lets the USS win over the drag-position it was authored with', () => {
    const rect = rectFromStyle({ left: { value: 636, unit: 'px' }, top: { value: 990, unit: 'px' } }, OFFICIAL_CANVAS, { width: 706, height: 90 }, 'Right')
    expect(rect).toMatchObject({ x: 636, y: 990 })
  })
})

describe('framing a tree that ships no window', () => {
  const bare: VisualTreeNode = { type: 'UXML', name: 'CraftUI', children: [{ type: 'DofusVisualElement', name: 'craftUI' }] }

  it('wraps a bare tree in a synthetic WindowFigma the renderer can drive', () => {
    const framed = withWindowFrame(bare, { id: 'craft', title: 'Craft', size: { width: 1100, height: 820 } })
    const chrome = readWindowChrome(framed.children![0])
    expect(chrome).toMatchObject({ kind: 'figma', id: 'craft', title: undefined, titleBar: true, closeButton: true })
    expect(chrome?.resize).toEqual({ horizontal: true, vertical: true, corner: true })
    expect(chrome?.fallbackSize).toEqual({ width: 1100, height: 820 })
    expect(pendingContentMeasure(chrome!, framed.children![0])).toEqual({ width: false, height: false })
    expect(windowIntrinsicSize(chrome!, { w: 542, h: 422 })).toEqual({ width: 1100, height: 820 })
    // The interior is clipped by a box of its own so a loose root panel cannot
    // spill outside the frame.
    const content = framed.children![0].children![0]
    expect(content.style?.overflow).toBe('hidden')
    expect(content.children?.[0].name).toBe('craftUI')
  })

  it('stamps the host id on the official window instead of adding another', () => {
    const withWindow: VisualTreeNode = { type: 'UXML', name: 'quests', children: [{ type: 'WindowFigma', name: 'Quests', properties: { 'header-style': 'primary' } }] }
    const framed = withWindowFrame(withWindow, { id: 'quests', title: 'Quêtes', size: { width: 1000, height: 740 } })
    expect(framed.children).toHaveLength(1)
    expect(framed.children![0].type).toBe('WindowFigma')
    expect(readWindowChrome(framed.children![0])?.id).toBe('quests')
    expect(readWindowChrome(framed.children![0])?.title).toBeUndefined()
  })

  it('does not stamp a catalogue size over a WindowFigma that declares pixels', () => {
    const quests: VisualTreeNode = {
      type: 'UXML',
      children: [{
        type: 'WindowFigma', name: 'Quests',
        properties: { 'header-style': 'primary' },
        style: { width: { value: 1330, unit: 'px' }, height: { value: 930, unit: 'px' } },
      }],
    }
    const framed = withWindowFrame(quests, { id: 'quests', size: { width: 1000, height: 740 } })
    expect(readWindowChrome(framed.children![0])?.fallbackSize).toBeUndefined()
    expect(pendingContentMeasure(readWindowChrome(framed.children![0])!, framed.children![0])).toEqual({ width: false, height: false })
  })

  it('stamps catalogue width on a WindowFigma that only declares height', () => {
    const cosmetics: VisualTreeNode = {
      type: 'UXML',
      children: [{
        type: 'WindowFigma', name: 'CosmeticUi',
        properties: { title: '[Inventory]', 'with-title-bar': 'true' },
        style: { height: { value: 880, unit: 'px' }, position: 'absolute' },
      }],
    }
    const framed = withWindowFrame(cosmetics, { id: 'appearance', size: { width: 1304, height: 880 } })
    const chrome = readWindowChrome(framed.children![0])!
    expect(chrome.fallbackSize).toEqual({ width: 1304 })
    expect(pendingContentMeasure(chrome, framed.children![0])).toEqual({ width: false, height: false })
    expect(windowIntrinsicSize(chrome)).toMatchObject({ width: 1304 })
  })

  it('stamps catalogue width on PlayerSpell, which only declares height', () => {
    const spells: VisualTreeNode = {
      type: 'UXML',
      children: [{
        type: 'WindowFigma', name: 'PlayerSpell',
        properties: { title: '[Sorts]', 'with-title-bar': 'true' },
        style: { height: { value: 940, unit: 'px' }, 'min-height': { value: 940, unit: 'px' } },
      }],
    }
    const framed = withWindowFrame(spells, { id: 'spells', size: { width: 1440, height: 940 } })
    const chrome = readWindowChrome(framed.children![0])!
    expect(chrome.fallbackSize).toEqual({ width: 1440 })
    expect(pendingContentMeasure(chrome, framed.children![0])).toEqual({ width: false, height: false })
    expect(windowIntrinsicSize(chrome, { w: 76, h: 940 })).toEqual({ width: 1440, height: 940 })
  })

  it('still stamps the host on a WindowFigma that fills it with percentages', () => {
    const recipes: VisualTreeNode = {
      type: 'UXML',
      children: [{
        type: 'WindowFigma', name: 'ItemRecipes',
        properties: { title: '[Recettes]' },
        style: { width: { value: 100, unit: '%' }, height: { value: 100, unit: '%' } },
      }],
    }
    const framed = withWindowFrame(recipes, { id: 'recipes', size: { width: 900, height: 720 } })
    expect(readWindowChrome(framed.children![0])?.fallbackSize).toEqual({ width: 900, height: 720 })
  })

  it('stamps a WindowFigma behind a single-child wrapper, without a second frame', () => {
    const appearance: VisualTreeNode = {
      type: 'UXML',
      children: [{
        type: 'VisualElement',
        children: [{
          type: 'WindowFigma', name: 'Appearance',
          style: { width: { value: 716, unit: 'px' }, height: { value: 600, unit: 'px' } },
        }],
      }],
    }
    const framed = withWindowFrame(appearance, { id: 'appearanceEditor', size: { width: 716, height: 600 } })
    expect(hostWindows(framed).map((node) => node.name)).toEqual(['Appearance'])
    expect(framed.children![0].type).toBe('VisualElement')
    expect(framed.children![0].children![0].type).toBe('WindowFigma')
    expect(readWindowChrome(framed.children![0].children![0])?.id).toBe('appearanceEditor')
    expect(readWindowChrome(framed.children![0].children![0])?.fallbackSize).toBeUndefined()
  })

  it('keeps sibling WindowFigmas in their USS flex row', () => {
    const bankWindow: VisualTreeNode = {
      type: 'WindowFigma', name: 'BankWindow',
      properties: { title: '[Bank]', 'no-ornament-header': 'true', 'show-close-button': 'false' },
      style: { width: { value: 492, unit: 'px' }, height: { value: 880, unit: 'px' } },
    }
    const storageWindow: VisualTreeNode = {
      type: 'WindowFigma', name: 'StorageWindow',
      properties: { 'no-ornament-header': 'true' },
      style: { width: { value: 492, unit: 'px' }, height: { value: 880, unit: 'px' } },
    }
    const bank: VisualTreeNode = {
      type: 'UXML',
      children: [{
        type: 'VisualElement', name: 'storageBankRoot',
        children: [{
          type: 'VisualElement', name: 'storageBank',
          children: [bankWindow, storageWindow],
        }],
      }],
    }
    const framed = withWindowFrame(bank, { id: 'bank', title: 'Banque', size: { width: 1150, height: 860 } })
    expect(framed.children![0].type).toBe('VisualElement')
    expect(framed.children![0].name).toBe('storageBankRoot')
    const windows = framed.children![0].children![0].children!
    expect(windows.map((node) => node.name)).toEqual(['BankWindow', 'StorageWindow'])
    expect(isFlowWindow(windows[0])).toBe(true)
    expect(isFlowWindow(windows[1])).toBe(true)
    expect(readWindowChrome(windows[0])?.id).toBe('bank')
    expect(readWindowChrome(windows[1])?.id).toBe('bank')
    expect(readWindowChrome(windows[0])).toMatchObject({ titleBar: false, closeButton: false, title: 'Banque' })
    expect(readWindowChrome(windows[1])?.titleBar).toBe(false)
    expect(readWindowChrome(windows[0])?.fallbackSize).toBeUndefined()
    expect(readWindowChrome(windows[1])?.fallbackSize).toBeUndefined()
  })

  it('keeps the auction house pair and its constructed title bar', () => {
    const auction: VisualTreeNode = {
      type: 'UXML',
      children: [{
        type: 'DofusVisualElement', name: 'container',
        children: [
          {
            type: 'WindowFigma', name: 'ctr-window',
            properties: { title: '[Hotel de vente]', 'header-style': 'primary' },
            style: { width: { value: 872, unit: 'px' }, height: { value: 880, unit: 'px' } },
          },
          {
            type: 'WindowFigma', name: 'storageWindow',
            properties: { 'no-ornament-header': 'true' },
            style: { width: { value: 492, unit: 'px' }, height: { value: 882, unit: 'px' } },
          },
        ],
      }],
    }
    const framed = withWindowFrame(auction, { id: 'market', title: 'Hôtel de vente', size: { width: 1100, height: 800 } })
    const windows = framed.children![0].children!
    expect(windows.map((node) => node.name)).toEqual(['ctr-window', 'storageWindow'])
    expect(isFlowWindow(windows[0])).toBe(true)
    expect(readWindowChrome(windows[0])).toMatchObject({
      id: 'market', title: 'Hotel de vente', titleBar: true, closeButton: true,
    })
    expect(readWindowChrome(windows[1])?.titleBar).toBe(false)
    expect(readWindowChrome(windows[0])?.fallbackSize).toBeUndefined()
  })

  it('does not wrap a mixed C# screen; nested WindowFigmas keep USS chrome', () => {
    const craft: VisualTreeNode = {
      type: 'UXML', name: 'craft',
      children: [{
        type: 'DofusVisualElement', name: 'ctr',
        children: [
          { type: 'VisualElement', name: 'ctr_recipe' },
          { type: 'WindowFigma', name: 'CraftStorageWindow', properties: { 'no-ornament-header': 'true' } },
        ],
      }],
    }
    const framed = withWindowFrame(craft, { id: 'craft', title: 'Craft', size: { width: 1100, height: 820 } })
    expect(framed.children![0].name).toBe('ctr')
    const nested = framed.children![0].children![1]
    expect(nested.name).toBe('CraftStorageWindow')
    expect(isFlowWindow(nested)).toBe(false)
    expect(isChromeOnlyWindow(nested)).toBe(true)
  })

  it('keeps cartography overlay WindowFigmas in USS instead of a host frame', () => {
    const map: VisualTreeNode = {
      type: 'UXML', name: 'cartographyUi',
      children: [
        { type: 'VisualElement', name: 'mapView' },
        {
          type: 'WindowFigma', name: 'resourceQuantities',
          properties: { title: 'Quantité', 'header-style': 'secondary' },
          style: { position: 'absolute', right: { value: 16, unit: 'px' }, top: { value: 40, unit: '%' } },
        },
      ],
    }
    const framed = withWindowFrame(map, { id: 'map', title: 'Carte', size: { width: 1100, height: 760 } })
    expect(framed.children![0].name).toBe('mapView')
    expect(framed.children![1].name).toBe('resourceQuantities')
    expect(isChromeOnlyWindow(framed.children![1])).toBe(true)
    expect(isFlowWindow(framed.children![1])).toBe(false)
    expect(framed.children![1].style?.position).toBe('absolute')
  })
})


it('groups cached title icons and shortcuts beside the caption on repeated preparation', () => {
  const cached: VisualTreeNode = { type: 'WindowFigma', properties: { 'header-title': 'Inventory' }, children: [
    { name: 'header', children: [
      { name: 'header_left', children: [{ name: 'header_icon', children: [{ name: 'header_icon_asset', sprite: 'inventory' }] }] },
      { name: 'header_content', children: [{ name: 'header_title', children: [{ name: 'header_titleLabel' }] }] },
    ] }, { name: 'window_content' },
  ] }
  const framed = withWindowFrame(cached, { id: 'test', title: 'Inventaire', shortcut: 'I', size: { width: 1013, height: 880 } })
  const again = stampFigmaHeaders(framed)
  const header = again.children?.find(child => child.name === 'header')
  const title = header?.children?.find(child => child.name === 'header_content')?.children?.find(child => child.name === 'header_title')
  expect(title?.children?.map(child => child.name)).toEqual(['header_icon', 'header_titleLabel', 'header_shortcut'])
  expect(header?.children?.find(child => child.name === 'header_left')?.children).toEqual([])
})


it('updates fixed constructor sizes while keeping saved placement and resizable sizes', () => {
  const chrome = readWindowChrome({ ...statSheet, properties: { ...statSheet.properties, 'giny-window-width': '520' } })!
  const saved = { x: 80, y: 40, w: 900, h: 880 }
  expect(restoreFixedWindowSize(chrome, saved)).toEqual({ x: 80, y: 40, w: 520, h: 880 })
  expect(restoreFixedWindowSize({ ...chrome, resize: { horizontal: true, vertical: true, corner: true } }, saved)).toBe(saved)
})

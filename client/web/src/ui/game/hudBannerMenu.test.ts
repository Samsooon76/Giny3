import { describe, expect, it, vi } from 'vitest'
import { resolveBannerMenu } from './hudBannerMenu'
import { GAME_WINDOWS } from './windows'

const openTree = vi.fn()
const onBrowse = vi.fn()
const toggleMore = vi.fn()

function model(overrides: Partial<Parameters<typeof resolveBannerMenu>[2]> = {}) {
  return {
    entries: [GAME_WINDOWS[0], GAME_WINDOWS[1], 'more' as const],
    hidden: GAME_WINDOWS.slice(2),
    more: false,
    openIds: new Set<string>(),
    cells: 3,
    width: 42,
    height: 249,
    openTree,
    onBrowse,
    toggleMore,
    ...overrides,
  }
}

describe('bannerMenu bindings', () => {
  it('forwards the official icon when a tile opens its window', () => {
    const slot = resolveBannerMenu('slot_0', 'gd_btnUis:0', model())
    expect(slot?.tooltip).toMatchObject({ text: 'Personnage' })
    slot?.onClick?.({} as never)
    expect(openTree).toHaveBeenCalledWith(
      'character', 'Personnage', 'characterSheetUi', GAME_WINDOWS[0].size, GAME_WINDOWS[0].icon,
    )
  })

  it('paints the icon on the official itemTile slots, not a homemade wrapper', () => {
    expect(resolveBannerMenu('itemTile_icon', 'gd_btnUis:0', model())?.sprite).toBe(GAME_WINDOWS[0].icon)
    expect(resolveBannerMenu('itemTile_icon_Vector', 'gd_btnUis:1', model())?.sprite).toBe(GAME_WINDOWS[1].icon)
    expect(resolveBannerMenu('itemTile_container', 'gd_btnUis:0', model())?.children).toBeUndefined()
    expect(resolveBannerMenu('itemTile_container', 'gd_btnUis:0', model())?.replaceChildren).toBeUndefined()
    expect(resolveBannerMenu('itemTile_icon', 'gd_btnUis:2', model())?.sprite).toBe('plus')
  })

  it('keeps the interface picto in colour on the tinted glyph slot', () => {
    // `.itemTile.xSmall.button.icon [data-name="itemTile_icon_Vector"]` carries
    // `--uitk-tint: #b6b3e6`; leaving it on masks a colour picto flat.
    const style = resolveBannerMenu('itemTile_icon_Vector', 'gd_btnUis:1', model())?.style
    expect(style).toMatchObject({ '--uitk-tint': 'transparent' })
    expect(resolveBannerMenu('itemTile_icon', 'gd_btnUis:1', model())?.style).toBeUndefined()
  })

  it('reveals the official overflow grid instead of injecting HTML', () => {
    expect(resolveBannerMenu('BannerMenu', undefined, model())?.children).toBeUndefined()
    expect(resolveBannerMenu('BannerMenu', undefined, model({ more: true }))?.className).toBe('hud-banner-menu is-more')
    expect(resolveBannerMenu('ctr_moreBtn', undefined, model({ more: false }))?.hidden).toBe(true)
    expect(resolveBannerMenu('ctr_moreBtn', undefined, model({ more: true }))?.hidden).toBe(false)
    expect(resolveBannerMenu('ctr_moreBtn', undefined, model({ more: true }))?.style).toBeUndefined()
    expect(resolveBannerMenu('content', undefined, model({ more: true }))?.style?.overflow).toBe('visible')
    expect(resolveBannerMenu('gd_additionalBtns', undefined, model({ more: true }))?.repeat).toBe(
      GAME_WINDOWS.slice(2).length + 1,
    )
    expect(resolveBannerMenu('gd_btnUis', undefined, model())?.style?.flexDirection).toBe('row')
    expect(resolveBannerMenu('gd_additionalBtns', undefined, model({ more: true }))?.style?.flexDirection).toBe('row')
    expect(resolveBannerMenu('itemTile_icon', 'gd_additionalBtns:0', model())?.sprite).toBe(GAME_WINDOWS[2].icon)
    expect(GAME_WINDOWS[1].icon).toBe('/dofus3/menuIcons/spells.png')
    expect(GAME_WINDOWS[2].icon).toBe('/dofus3/menuIcons/inventory.png')
    expect(resolveBannerMenu('header_label', undefined, model())?.hidden).toBe(true)
    expect(resolveBannerMenu('header_label', undefined, model({ width: 249, height: 42 }))?.text).toBe('MENUS')
  })

  it('applies a live icon override without changing the other tiles', () => {
    const withHead = model({ iconOverrides: { character: 'Head_80' } })
    expect(resolveBannerMenu('itemTile_icon', 'gd_btnUis:0', withHead)?.sprite).toBe('Head_80')
    expect(resolveBannerMenu('itemTile_icon', 'gd_btnUis:1', withHead)?.sprite).toBe(GAME_WINDOWS[1].icon)
  })
})

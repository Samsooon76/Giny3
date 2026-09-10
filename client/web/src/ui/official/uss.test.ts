import { describe, expect, it } from 'vitest'
import type { CSSProperties } from 'react'
import { applyAuthoredSingleLine, applyResolvedSprite, cssText, hasTintedBackground, iconCandidates, uiUrl, ussToCss } from './uss'

describe('USS to CSS conversion', () => {
  it('centres text carried by a VisualElement', () => {
    const css = ussToCss({ 'unity-text-align': 'middle-center' }, false)
    expect(css.justifyContent).toBe('center')
    expect(css.alignItems).toBe('center')
    expect(css.textAlign).toBe('center')
  })

  it('preserves Unity flex, absolute coordinates and corner radii', () => {
    const css = ussToCss({
      position: 'absolute',
      left: { value: 12, unit: 'px' },
      width: { value: 50, unit: '%' },
      'flex-basis': { value: 80, unit: 'px' },
      'border-top-left-radius': { value: 7, unit: 'px' },
    })
    expect(css).toMatchObject({ position: 'absolute', left: '12px', width: '50%', flexBasis: '80px', borderTopLeftRadius: '7px' })
  })

  it('converts transforms, text outlines and scale-to-fit images', () => {
    const css = ussToCss({
      'background-image': 'styles/images/logoDofus.png',
      'unity-background-scale': 'scale-to-fit',
      rotate: { value: 180, unit: 'deg' },
      scale: 0.75,
      'unity-text-outline-width': 2,
      'unity-text-outline-color': '#000000aa',
    })
    expect(css.backgroundImage).toContain('/ui-data/styles/images/logoDofus.png')
    expect(css.backgroundSize).toBe('contain')
    expect(css.transform).toBe('scale(0.75) rotate(180deg)')
    expect(css.textShadow).toContain('#000000aa')
  })

  it('creates a valid nine-slice border without applying layout defaults to states', () => {
    const css = ussToCss({
      'background-image': 'styles/images/panel.png',
      'unity-slice-top': 8, 'unity-slice-right': 9, 'unity-slice-bottom': 10, 'unity-slice-left': 11,
    })
    expect(css.borderImageSlice).toBe('8 9 10 11 fill')
    expect(css.borderStyle).toBe('solid')
    expect(cssText({ color: '#fff' })).toBe('color:#fff')
  })

  it('resolves official asset and shadow-icon candidates', () => {
    expect(uiUrl('textures/Head_10.png')).toBe('/ui-data/textures/Head_10.png')
    expect(iconCandidates('triangleWarning', true)[0]).toBe('/ui-data/icons/triangleWarningShadowOutline.png')
    expect(iconCandidates('Assets/UI/Themes/darkStone/texture/inventory_all.png')[0]).toBe('/ui-data/styles/images/inventory_all.png')
    expect(iconCandidates('Assets/UI/Themes/Figma/menuIcons/characteristic.png')[0]).toBe('/ui-data/icons/characteristic.png')
    expect(iconCandidates('Assets/UI/Themes/Figma/Inventory/Cosmetics/iconAura.png')[0]).toBe('/ui-data/icons/iconAura.png')
    expect(iconCandidates('Assets/UI/Themes/Figma/Inventory/Cosmetics/iconAura.png')).toContain('/ui-data/icons/aura.png')
    expect(iconCandidates('world')).toContain('/ui-data/icons/world.png')
    expect(iconCandidates('chest')).toContain('/ui-data/icons/bank.png')
    expect(iconCandidates('icon_pa')).toContain('/ui-data/styles/images/icon_pa.png')
    expect(iconCandidates('styles/images/mount.png')[0]).toBe('/ui-data/styles/images/mount.png')
    expect(iconCandidates('styles/images/guild.png')[0]).toBe('/ui-data/styles/images/guild.png')
    expect(iconCandidates('webShop')[0]).toBe('/ui-data/icons/webShop.png')
    expect(iconCandidates('Head_10')[0]).toBe('/ui-data/icons/Head_10.png')
    expect(iconCandidates('cosmetics')[0]).toBe('/ui-data/icons/cosmetics.png')
    expect(iconCandidates('guild_c9e58fe2_9054786557142999329')[0]).toBe('/ui-data/icons/guild_c9e58fe2_9054786557142999329.png')
    expect(iconCandidates('character_c9e58fe2_n6523567435991881375')[0]).toBe('/ui-data/icons/character_c9e58fe2_n6523567435991881375.png')
    expect(iconCandidates('bank')[0]).toBe('/ui-data/icons/bank.png')
    expect(iconCandidates('/game-data/pictos/achievements/58.png')).toEqual(['/game-data/pictos/achievements/58.png'])
  })

  it('does not emit Unity function tokens or numeric values as CSS colors', () => {
    const css = ussToCss({
      color: [{ type: 'function', value: null }, 1, '--foreground'],
      'border-top-color': { type: 'function', value: null },
      'background-color': '#15172be6',
    })
    expect(css.color).toBe('var(--foreground)')
    expect(css.borderTopColor).toBeUndefined()
    expect(css.backgroundColor).toBe('#15172be6')
    expect(cssText({ color: [{ type: 'function', value: null }, 1] })).toBe('')
    expect(ussToCss({ opacity: 80 }).opacity).toBe(80)
    expect(ussToCss({ opacity: 0.5 }).opacity).toBe(0.5)
  })

  it('emits transition duration, delay and comma-separated lists', () => {
    const css = ussToCss({
      'transition-property': 'opacity',
      'transition-duration': { value: 500, unit: 'ms' },
      'transition-delay': { value: 500, unit: 'ms' },
      'transition-timing-function': 'ease-in-out',
    }, false, false)
    expect(css).toMatchObject({
      transitionProperty: 'opacity',
      transitionDuration: '500ms',
      transitionDelay: '500ms',
      transitionTimingFunction: 'ease-in-out',
    })
    const list = ussToCss({
      'transition-duration': [
        { value: 0.5, unit: 's' },
        { type: 'comma', index: 0, value: null },
        { value: 0.5, unit: 's' },
      ],
    }, false, false)
    expect(list.transitionDuration).toBe('0.5s, 0.5s')
  })

  it('maps -unity-text-align through the UITK column default, and swaps on row', () => {
    const column = ussToCss({ 'unity-text-align': 'middle-left' })
    expect(column).toMatchObject({ textAlign: 'left', justifyContent: 'center', alignItems: 'flex-start' })
    const row = ussToCss({ 'flex-direction': 'row', 'unity-text-align': 'middle-left' })
    expect(row).toMatchObject({ textAlign: 'left', justifyContent: 'flex-start', alignItems: 'center' })
    const authored = ussToCss({ 'unity-text-align': 'middle-left', 'justify-content': 'flex-end', 'align-items': 'stretch' })
    expect(authored.justifyContent).toBe('flex-end')
    expect(authored.alignItems).toBe('stretch')
  })

  it('maps abspos align-self to the inline axis so top+bottom can stretch', () => {
    const middle = ussToCss({
      position: 'absolute',
      width: { value: 400, unit: 'px' },
      top: { value: 40, unit: 'px' },
      bottom: { value: 40, unit: 'px' },
      'align-self': 'center',
      'align-items': 'center',
      'justify-content': 'space-around',
    })
    expect(middle.position).toBe('absolute')
    expect(middle.top).toBe('40px')
    expect(middle.bottom).toBe('40px')
    expect(middle.width).toBe('400px')
    expect(middle.alignSelf).toBeUndefined()
    expect(middle.left).toBe('0px')
    expect(middle.right).toBe('0px')
    expect(middle.marginLeft).toBe('auto')
    expect(middle.marginRight).toBe('auto')
    expect(middle.alignItems).toBe('center')
    const inFlow = ussToCss({ 'align-self': 'center' })
    expect(inFlow.alignSelf).toBe('center')
    expect(inFlow.marginLeft).toBeUndefined()
    const stretched = ussToCss({ position: 'absolute', 'align-self': 'stretch', top: 0, bottom: 0 })
    expect(stretched.alignSelf).toBe('stretch')
    expect(stretched.left).toBeUndefined()
  })

  it('does not let UITK flex defaults beat a cascade-sliced unity-text-align', () => {
    const inline = ussToCss({}, false, true, new Set(['unity-text-align', 'position', 'width']))
    expect(inline.justifyContent).toBeUndefined()
    expect(inline.alignItems).toBeUndefined()
    expect(inline.textAlign).toBeUndefined()
    expect(inline.position).toBeUndefined()
    expect(cssText({
      position: 'absolute',
      width: { value: 100, unit: '%' },
      height: { value: 100, unit: '%' },
      'unity-text-align': 'middle-center',
    })).toMatch(/justify-content:center/)
  })

  it('honours authored background-size and 9-slices a tinted sprite via mask-border variables', () => {
    expect(ussToCss({
      'background-image': 'styles/images/logoDofus.png',
      'background-size': 'contain',
    }).backgroundSize).toBe('contain')
    const tinted = ussToCss({
      'background-image': 'styles/images/panel.png',
      'unity-background-image-tint-color': '#3d405ce5',
      'unity-slice-top': 8, 'unity-slice-right': 9, 'unity-slice-bottom': 10, 'unity-slice-left': 11,
    }) as Record<string, unknown>
    expect(tinted['--official-tint']).toBe('#3d405ce5')
    expect(String(tinted['--official-mask-border'])).toContain('panel.png')
    expect(tinted['--official-mask-slice']).toBe('8 9 10 11 fill')
    expect(tinted['--official-mask-width']).toBe('8px 9px 10px 11px')
    expect(tinted['--official-mask-image']).toBe('none')
    expect(tinted.maskImage).toBeUndefined()
    expect(tinted.WebkitMaskBoxImageSource).toBeUndefined()
    expect(tinted.backgroundColor).toBeUndefined()
    expect(tinted.borderImageSlice).toBeUndefined()
    expect(hasTintedBackground({
      'background-image': 'styles/images/panel.png',
      'unity-background-image-tint-color': '#3d405ce5',
    })).toBe(true)
    expect(hasTintedBackground({
      'background-image': 'styles/images/panel.png',
      'unity-background-image-tint-color': '#ffffffff',
    })).toBe(false)
    expect(hasTintedBackground({
      'background-image': 'styles/images/panel.png',
      'unity-background-image-tint-color': '#fff',
    })).toBe(false)
    expect(hasTintedBackground({
      'background-image': 'styles/images/panel.png',
      'unity-background-image-tint-color': 'rgba(255, 255, 255, 1)',
    })).toBe(false)
  })

  it('rejects non-color keywords and defaults unauthored width to fit-content when centered in absolute', () => {
    const css = ussToCss({
      color: 'none',
      'border-color': 'auto',
      'background-color': '#112233',
    }, false, false)
    expect(css.color).toBeUndefined()
    expect(css.borderColor).toBeUndefined()
    expect(css.backgroundColor).toBe('#112233')

    const centeredNoWidth = ussToCss({
      position: 'absolute',
      'align-self': 'center',
    })
    expect(centeredNoWidth.width).toBe('fit-content')
    expect(centeredNoWidth.left).toBe('0px')
    expect(centeredNoWidth.right).toBe('0px')
    expect(centeredNoWidth.marginLeft).toBe('auto')
    expect(centeredNoWidth.marginRight).toBe('auto')
  })

  it('does not put a tinted sprite mask on the element, so descendants stay visible', () => {
    const panel = ussToCss({
      'background-image': 'styles/images/charactHeader.png',
      'unity-background-image-tint-color': '#1b1d32cc',
      'unity-slice-left': 40,
      'unity-slice-right': 40,
    }, false, false) as Record<string, unknown>
    expect(panel.maskImage).toBeUndefined()
    expect(panel.WebkitMaskImage).toBeUndefined()
    expect(cssText({
      'background-image': 'styles/images/charactHeader.png',
      'unity-background-image-tint-color': '#1b1d32cc',
    })).toContain('--official-tint:#1b1d32cc')
    expect(cssText({
      'background-image': 'styles/images/charactHeader.png',
      'unity-background-image-tint-color': '#1b1d32cc',
    })).not.toMatch(/(?:^|;)mask-image:/)
  })

  it('paints a resolved leaf sprite on the host without inventing a pixel box', () => {
    const css: Record<string, unknown> = { width: '24px', height: '24px' }
    applyResolvedSprite(css as CSSProperties, 'icons/playShadowOutline.png', {
      'unity-background-image-tint-color': '#ffffffcc',
    })
    expect(css.width).toBe('24px')
    expect(css.height).toBe('24px')
    expect(css.backgroundImage).toBeUndefined()
    expect(css.maskImage).toBeUndefined()
    expect(css['--official-tint']).toBe('#ffffffcc')
    expect(String(css['--official-mask-image'])).toContain('/ui-data/icons/playShadowOutline.png')
    expect(css['--official-mask-size']).toBe('100% 100%')
    const plain: Record<string, unknown> = {}
    applyResolvedSprite(plain as CSSProperties, '/ui-data/icons/success.png')
    expect(plain.backgroundImage).toBe('url("/ui-data/icons/success.png")')
    expect(plain.backgroundSize).toBe('100% 100%')
    expect(plain.width).toBeUndefined()
    expect(plain.height).toBeUndefined()
  })
})

describe('UITK text-overflow ellipsis', () => {
  it('lowers Unity ellipsis to a single-line CSS clip', () => {
    const css = ussToCss({ 'text-overflow': 'ellipsis' })
    expect(css).toMatchObject({ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' })
  })
})

describe('DofusLabel.SetSingleLine', () => {
  it('overrides compiled white-space:normal when the UXML flag is on', () => {
    const css = ussToCss({ 'white-space': 'normal', 'text-overflow': 'ellipsis', overflow: 'visible' })
    applyAuthoredSingleLine(css, { isSingleLine: 'true' })
    expect(css.whiteSpace).toBe('nowrap')
    expect(css.overflow).toBe('hidden')
  })

  it('accepts the camelCase serialized flag and leaves false/unset to USS', () => {
    const on = ussToCss({ 'white-space': 'normal' })
    applyAuthoredSingleLine(on, { 'is-single-line': '1' })
    expect(on.whiteSpace).toBe('nowrap')
    expect(on.overflow).toBe('visible')
    const off = ussToCss({ 'white-space': 'nowrap' })
    applyAuthoredSingleLine(off, { isSingleLine: 'false' })
    expect(off.whiteSpace).toBe('nowrap')
    const unset = ussToCss({ 'white-space': 'normal' })
    applyAuthoredSingleLine(unset, {})
    expect(unset.whiteSpace).toBe('normal')
  })
})

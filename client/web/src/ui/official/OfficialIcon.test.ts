import { describe, expect, it } from 'vitest'
import { hostSpriteName, implicitImageSize, propertySprite } from './OfficialIcon'

describe('hostSpriteName', () => {
  it('paints a leaf Image/Vector sprite on the host, not a child', () => {
    expect(hostSpriteName({ sprite: 'icons/success.png' })).toBe('icons/success.png')
    expect(hostSpriteName({
      sprite: 'icons/playShadowOutline.png',
      properties: { 'image-url': 'icons/ignored.png' },
    })).toBe('icons/playShadowOutline.png')
  })

  it('does not cover a Slot/button fill when the constructor also named a sprite', () => {
    expect(hostSpriteName({
      sprite: 'character',
      children: [{ sprite: 'character' }],
    })).toBeUndefined()
    expect(hostSpriteName(
      { children: [{ name: 'itemTile_icon_Vector' }] },
      'plus',
    )).toBeUndefined()
  })

  it('lets a runtime override and a property icon fill an empty leaf', () => {
    expect(hostSpriteName({}, 'plus')).toBe('plus')
    expect(propertySprite({ 'tile-icon-value': 'map' })).toBe('map')
    expect(hostSpriteName({ properties: { icon: 'quests' } })).toBe('quests')
    expect(propertySprite({ icon: '12' })).toBeUndefined()
  })

  it('paints a catalog override on a host whose only child is an overlay', () => {
    expect(hostSpriteName(
      { children: [{ name: 'tx_border', type: 'VisualElement' }] },
      '/game-data/pictos/achievements/58.png',
    )).toBe('/game-data/pictos/achievements/58.png')
  })
})

describe('implicitImageSize', () => {
  it('does not let the PNG rect beat a USS box lifted into a state rule', () => {
    expect(implicitImageSize('DofusIcon', {
      width: { value: 24, unit: 'px' },
      height: { value: 24, unit: 'px' },
    }, [64, 64])).toBeUndefined()
    expect(implicitImageSize('DofusIcon', {}, [32, 32])).toEqual({ width: '32px', height: '32px' })
    expect(implicitImageSize('VisualElement', {}, [32, 32])).toBeUndefined()
  })
})

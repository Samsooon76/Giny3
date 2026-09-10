import { describe, expect, it } from 'vitest'
import { boxText, paintedImage, uniqueSurfaces } from './dumpBoxes'

describe('paintedImage', () => {
  it('reports a tinted USS sprite that paints through mask-border, not background-image', () => {
    expect(paintedImage({
      backgroundImage: 'none',
      maskImage: 'none',
      webkitMaskBoxImageSource: 'url("/ui-data/styles/images/defaultBackgoundButton_28369203_6441872113072935610.png")',
      maskBorderSource: 'none',
    })).toContain('defaultBackgoundButton_28369203_6441872113072935610.png')
  })

  it('reads the ::before paint of a tinted sprite that no longer masks the host', () => {
    expect(paintedImage({
      backgroundImage: 'none',
      maskImage: 'url("/ui-data/styles/images/charactHeader.png")',
    })).toContain('charactHeader.png')
  })

  it('keeps sibling canvases and drops a canvas nested in another', () => {
    const outer = { id: 'stage', contains(other: { id: string }) { return other.id === 'nested' } }
    const nested = { id: 'nested', contains() { return false } }
    const overlay = { id: 'header', contains() { return false } }
    expect(uniqueSurfaces([outer, nested, overlay]).map((node) => node.id)).toEqual(['stage', 'header'])
  })

  it('falls back to background-image and ignores none tokens', () => {
    expect(paintedImage({ backgroundImage: 'none', maskImage: 'none' })).toBeNull()
    expect(paintedImage({
      backgroundImage: 'url("/ui-data/styles/images/slot_dark_background_empty.png")',
      maskImage: 'none',
    })).toContain('slot_dark_background_empty.png')
  })
})

describe('boxText', () => {
  it('reads text UITK paints on the host, not a nested label span', () => {
    const host = {
      childNodes: [
        { nodeType: 1, textContent: 'css' },
        { nodeType: 3, textContent: '  Afficher uniquement mes personnages  ' },
      ],
    }
    const parent = {
      childNodes: [
        { nodeType: 1, textContent: 'Afficher uniquement mes personnages' },
      ],
    }
    expect(boxText(host)).toBe('Afficher uniquement mes personnages')
    expect(boxText(parent)).toBeNull()
  })
})

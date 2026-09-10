import { beforeEach, describe, expect, it } from 'vitest'
import { hydrateCatalog, resetCatalog } from './catalog'
import { itemIconUrls, spellIconUrls } from './contentIcons'

const INDEX = {
  items: { '16041': '16041.png' },
  spells: { sort_12145: 'sort_12145.png', weapon_3: 'weapon_3.png' },
}

describe('catalog picto index', () => {
  beforeEach(() => {
    resetCatalog()
    hydrateCatalog({
      pictos: INDEX,
      items: { '2411': { id: 2411, iconId: 16041, name: 'Coiffe du Bouftou', picto: 'pictos/items/16041.png' } },
    })
  })

  it('does not invent a URL when the index is empty', () => {
    resetCatalog()
    expect(spellIconUrls(3)).toEqual([])
    expect(spellIconUrls(12145)).toEqual([])
    expect(itemIconUrls({ gid: 2411, icon_id: 16041 })).toEqual([])
  })

  it('resolves a spell through sort_* then weapon_*, never sort_3', () => {
    expect(spellIconUrls(12145)).toEqual(['/game-data/pictos/spells/sort_12145.png'])
    expect(spellIconUrls(3)).toEqual(['/game-data/pictos/spells/weapon_3.png'])
    expect(spellIconUrls()).toEqual([])
  })

  it('resolves an item through iconId, ignoring appearance id and gid', () => {
    expect(itemIconUrls({ gid: 2411, icon_id: 16041 })).toEqual(['/game-data/pictos/items/16041.png'])
    expect(itemIconUrls({ gid: 2411 })).toEqual(['/game-data/pictos/items/16041.png'])
    expect(itemIconUrls({ gid: 2411, icon_id: 16041 } as { gid: number; icon_id?: number; appearance_id?: number })).not.toContain(
      '/game-data/client/item-icons/2411.png',
    )
    expect(itemIconUrls({ gid: 2411 })[0]).not.toContain('2411.png')
    expect(itemIconUrls({ gid: 2411 })[0]).toContain('16041.png')
  })
})

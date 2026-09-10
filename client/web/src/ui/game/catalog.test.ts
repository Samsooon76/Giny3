import { describe, expect, it } from 'vitest'
import { decodeEffectLine, hydrateCatalog, resetCatalog, stampNames, tableRecords } from './catalog'

describe('tableRecords', () => {
  it('unwraps a by_id wrapper and keeps a flat id map', () => {
    expect(tableRecords({ by_id: { '1': { id: 1 } } })).toEqual({ '1': { id: 1 } })
    expect(tableRecords({ '44': { id: 44, nameId: 995824 } })).toEqual({
      '44': { id: 44, nameId: 995824 },
    })
    expect(tableRecords(null)).toBeUndefined()
  })
})

describe('stampNames', () => {
  it('fills name and description from I18n by_id without inventing captions', () => {
    const table = {
      '44': { id: 44, nameId: 995824, descriptionId: 995825, iconId: 6007 },
    }
    const named = stampNames(table, {
      '995824': 'Épée de Boisaille',
      '995825': 'Épée de simple facture.',
    })
    expect(named?.['44']).toMatchObject({
      id: 44,
      iconId: 6007,
      name: 'Épée de Boisaille',
      description: 'Épée de simple facture.',
    })
  })

  it('leaves an already present name alone and skips unknown ids', () => {
    const table = {
      '1': { id: 1, nameId: 9, name: 'Garde' },
      '2': { id: 2, nameId: 8 },
    }
    const named = stampNames(table, { '9': 'Ignoré' })
    expect(named?.['1']).toMatchObject({ name: 'Garde' })
    expect(named?.['2']).not.toHaveProperty('name')
  })

  it('decodes a spell effect line from the stamped description template', () => {
    resetCatalog()
    hydrateCatalog({
      effects: {
        '97': { id: 97, description: '#1{{~1~2 à }}#2 dommages Terre' },
        '157': { id: 157, description: '-#1{{~1~2 à -}}#2 Force' },
      },
    })
    expect(decodeEffectLine({ effectId: 97, diceNum: 17, diceSide: 20 })).toBe('17 à 20 dommages Terre')
    expect(decodeEffectLine({ effectId: 157, diceNum: 40, duration: 3 })).toBe('-40 Force (3 tours)')
    resetCatalog()
  })

  it('uses resultNameId for recipes and nameMaleId for titles', () => {
    const recipe = stampNames({ '1': { resultId: 44, resultNameId: 7 } }, { '7': 'Pain' })
    const title = stampNames({ '1': { id: 1, nameMaleId: 3 } }, { '3': 'Le Téméraire' })
    expect(recipe?.['1']).toMatchObject({ name: 'Pain' })
    expect(title?.['1']).toMatchObject({ name: 'Le Téméraire' })
  })

})

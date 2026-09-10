import { describe, expect, it, vi } from 'vitest'
import { creationHeadSprite, resolveCreationChoiceSlot, resolveCreationName, resolveCreationSpellSlot } from './creationBindings'

describe('character creation bindings', () => {
  it('names the official class-head picto, not a capture-sampled file', () => {
    expect(creationHeadSprite(1, 'male')).toBe('Head_10')
    expect(creationHeadSprite(1, 'female')).toBe('Head_11')
  })

  it('paints the portrait on the Slot and hides extras, without replaceChildren', () => {
    const onSelect = vi.fn()
    const filled = resolveCreationChoiceSlot(true, true, 'Head_10', onSelect)
    expect(filled.replaceChildren).toBeUndefined()
    expect(filled.children).toBeUndefined()
    expect(filled.sprite).toBe('Head_10')
    expect(filled.state).toBe('selected')
    filled.onClick?.({} as never)
    expect(onSelect).toHaveBeenCalled()
    expect(resolveCreationChoiceSlot(false, false, undefined, onSelect)).toEqual({ hidden: true })
  })

  it('assigns the catalog spell picto on the official Slot, without replaceChildren', () => {
    const filled = resolveCreationSpellSlot({ icon: 'spell-icons/sort_3.png' })
    expect(filled.replaceChildren).toBeUndefined()
    expect(filled.children).toBeUndefined()
    expect(filled.sprite).toBe('/game-data/client/spell-icons/sort_3.png')
    expect(resolveCreationSpellSlot()).toEqual({ hidden: true })
  })

  it('keeps the official TextInput interior and does not invent a placeholder', () => {
    const onChange = vi.fn()
    const field = resolveCreationName('Iopette', onChange)
    expect(field.replaceChildren).toBeUndefined()
    expect(field.children).toBeUndefined()
    expect(field.text).toBe('Iopette')
    field.onInput?.({ currentTarget: { value: 'Feca' } } as never)
    expect(onChange).toHaveBeenCalledWith('Feca')
  })
})

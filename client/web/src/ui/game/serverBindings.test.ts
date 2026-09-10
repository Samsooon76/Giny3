import { describe, expect, it, vi } from 'vitest'
import { resolveServerCard } from './serverBindings'

const card = { id: 7, name: 'Giny', charactersCount: 1, selectable: true, status: 'Online', characters: [{ id: 1, name: 'Hugo', look: '{1|10}' }] }

describe('server card bindings', () => {
  it('fills server data and its character portrait slot', () => {
    const onSelect = vi.fn()
    const onCreate = vi.fn()
    expect(resolveServerCard('lbl_name', card, 7, onSelect, onCreate, false)?.text).toBe('Giny')
    expect(resolveServerCard('ctr_serverCard', card, 7, onSelect, onCreate, false)?.state).toBe('selected')
    expect(resolveServerCard('tag', card, 7, onSelect, onCreate, false)).toBeUndefined()
    expect(resolveServerCard('lbl_characters', card, 7, onSelect, onCreate, false)?.text).toBe('PERSONNAGE (1)')
    expect(resolveServerCard('ctr_characterContent', card, 7, onSelect, onCreate, false)?.children).toHaveLength(1)
    expect(resolveServerCard('ctr_character', card, 7, onSelect, onCreate, false)?.hidden).toBe(false)
    expect(resolveServerCard('ctr_newCharacter', card, 7, onSelect, onCreate, false)?.hidden).toBe(true)
  })
})

it('uses World status for the indicator, even when Auth reports selectable', () => {
  const bind = (status: string) => resolveServerCard('icon_status', { ...card, status }, 7, vi.fn(), vi.fn(), false)
  expect(bind('Online')?.tooltip?.text).toBe('World en ligne')
  for (const status of ['Offline', 'Starting', 'Maintenance', 'Unknown']) expect(bind(status)?.tooltip?.text).toContain('hors ligne')
})

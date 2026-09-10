import { describe, expect, it } from 'vitest'
import { EXTRA_WINDOWS, GAME_WINDOWS, HUD_CHROME_LAYERS, HUD_LAYERS, OPENABLE_WINDOWS, TREE_WRAPPERS, officialTreeFor } from './windows'

describe('official window wrappers', () => {
  it('opens menu entries on the official host tree, not the nested body', () => {
    const tree = Object.fromEntries(GAME_WINDOWS.map((entry) => [entry.id, entry.tree]))
    expect(tree.spells).toBe('playerSpell')
    expect(tree.guild).toBe('guildBase')
    expect(tree.cosmetics).toBe('cosmeticUi')
    expect(tree.profile).toBe('PlayerInfoUi')
    expect(tree.map).toBe('CartographyMapUI')
  })

  it('redirects a known body to the wrapper that carries WindowFigma', () => {
    expect(TREE_WRAPPERS.spellBase).toBe('playerSpell')
    expect(officialTreeFor('spellBase')).toBe('playerSpell')
    expect(officialTreeFor('guild')).toBe('guildBase')
    expect(officialTreeFor('characterSheetUi')).toBe('characterSheetUi')
    expect(officialTreeFor('mountPaddock')).toBe('mountPaddock')
    expect(TREE_WRAPPERS.mountPaddock).toBeUndefined()
    expect(officialTreeFor('AppearanceUI')).toBe('AppearanceUI')
    expect(TREE_WRAPPERS.AppearanceUI).toBeUndefined()
  })

  it('fills the banner with the 24 official tiles, colour pictos, not NPC screens', () => {
    expect(GAME_WINDOWS.every((entry) => entry.icon.length > 0)).toBe(true)
    expect(GAME_WINDOWS.map((entry) => entry.id)).toEqual([
      'character', 'spells', 'inventory', 'cosmetics', 'quests', 'map',
      'calendar', 'ladder', 'groupSearch', 'profile', 'friends', 'guild',
      'alliance', 'achievements', 'shop', 'encyclopedia', 'jobs', 'guide',
      'builds', 'dreams', 'havenbag', 'kolizeum', 'breeding', 'companions',
    ])
    const icon = Object.fromEntries(GAME_WINDOWS.map((entry) => [entry.id, entry.icon]))
    expect(icon.cosmetics).toBe('/dofus3/menuIcons/cosmetics.png')
    expect(icon.profile).toBe('/dofus3/menuIcons/character.png')
    expect(icon.guild).toBe('/dofus3/menuIcons/guild.png')
    expect(icon.alliance).toBe('/dofus3/menuIcons/alliance.png')
    expect(icon.achievements).toBe('/dofus3/menuIcons/success.png')
    expect(icon.shop).toBe('/dofus3/menuIcons/webShop.png')
    expect(icon.havenbag).toBe('/dofus3/menuIcons/havenbag.png')
    expect(EXTRA_WINDOWS.map((entry) => entry.id)).toEqual([
      'collection', 'bak', 'fightResult', 'mount', 'alignment', 'bank', 'market', 'craft', 'recipes',
    ])
    expect(OPENABLE_WINDOWS).toHaveLength(GAME_WINDOWS.length + EXTRA_WINDOWS.length)
  })

  it('opens cosmetics and inventory on the UXML column sums, not a 900px guess', () => {
    const size = Object.fromEntries(GAME_WINDOWS.map((entry) => [entry.id, entry.size]))
    expect(size.cosmetics).toEqual({ width: 1304, height: 880 })
    expect(size.inventory).toEqual({ width: 1013, height: 880 })
    expect(size.spells).toEqual({ width: 1440, height: 940 })
  })

  it('stacks the official XP gauge on the world HUD', () => {
    expect(HUD_LAYERS.map((layer) => layer.tree)).toContain('widgetProgressGauge')
    expect(HUD_LAYERS.map((layer) => layer.tree)).toContain('characterInformations')
  })

  it('paints GameMenu as HUD chrome, not a widget under opened windows', () => {
    expect(HUD_LAYERS.map((layer) => layer.tree)).not.toContain('gameMenu')
    expect(HUD_CHROME_LAYERS.map((layer) => layer.tree)).toEqual(['widgetManager', 'gameMenu'])
  })
})

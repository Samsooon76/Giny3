import { describe, expect, it, beforeEach, vi } from 'vitest'
import { defaultChatTabs, readChatTabs, matchesChatTab } from './chatTabs'

beforeEach(() => vi.resetModules())
describe('chat tab preferences', () => {
  it('restores filters, icons and the combat tab together', () => {
    const saved = defaultChatTabs()
    saved.tabs[0].channels = [9, 10]
    saved.tabs[0].icon = 'shield'
    saved.combatId = 'combat'
    expect(readChatTabs(JSON.stringify(saved))).toEqual(saved)
    expect(readChatTabs('{broken')).toEqual(defaultChatTabs())
    expect(readChatTabs(JSON.stringify({ ...saved, tabs: [] }))).toEqual(defaultChatTabs())
  })
  it('rejects invalid assets and fixes stale selected tab ids', () => {
    const saved = defaultChatTabs()
    saved.activeId = 'removed'
    saved.combatId = 'removed'
    expect(readChatTabs(JSON.stringify(saved))).toMatchObject({ activeId: 'general', combatId: null })
    saved.tabs[0].icon = '../../unknown'
    expect(readChatTabs(JSON.stringify(saved))).toEqual(defaultChatTabs())
  })
  it('filters system messages by their actual channel', () => {
    const tab = { ...defaultChatTabs().tabs[0], channels: [11] }
    expect(matchesChatTab(tab, { id: '1', channel: 11, kind: 'info', content: 'Combat', timestamp: 1 })).toBe(true)
    expect(matchesChatTab(tab, { id: '2', channel: 10, kind: 'info', content: 'Info', timestamp: 1 })).toBe(false)
  })
  it('changes only the targeted tab and selects the combat preference on entry', async () => {
    const { chatTabs } = await import('./chatTabs')
    const before = chatTabs.snapshot().tabs[1]
    chatTabs.toggleChannel('general', 0)
    expect(chatTabs.snapshot().tabs[0].channels).not.toContain(0)
    expect(chatTabs.snapshot().tabs[1]).toEqual(before)
    chatTabs.setCombat('combat')
    chatTabs.enterCombat()
    expect(chatTabs.snapshot().activeId).toBe('combat')
    chatTabs.remove('combat')
    expect(chatTabs.snapshot()).toMatchObject({ activeId: 'general', combatId: null })
    chatTabs.remove('recruitment')
    chatTabs.remove('general')
    expect(chatTabs.snapshot().tabs).toHaveLength(1)
  })
})

import { combatTargetInfo, targetInfoLayer } from './combatTargetInfo'
import themes from '../official/themes.json'
import { worldDisplayStore } from './worldDisplayStore'
import { InventoryRecipes } from './InventoryRecipes'
import { SHORTCUT_SECTIONS, shortcutPreferences, keyLabel } from '../screens/shortcutPreferences'
import { moduleVisible, useHudWidgetManager } from './hudWidgetManager'
import { chatTabs, matchesChatTab } from './chatTabs'
import { ChatTabMenu, type ChatTabMenuAnchor } from './ChatTabMenu'
import { REFERENCE_CHAT } from './referencePreview'
import { useLiveActions } from './LiveActions'
import type { GameAction } from '../../giny/actions'
import type { QuestState } from '../../giny/questState'
import { RecurringQuestsPanel } from './RecurringQuestsPanel'
import { useShop } from './shop'
import { useCombatPresentation, REFERENCE_FIGHT } from './combatPresentation'
import { useLiveCombat, type LiveCombat } from './liveCombat'
import { useAchievements } from './achievements'
import { useLadder } from './ladder'
import { useCalendar } from './calendar'
import { useProfile } from './profile'
import { useJobs } from './jobs'
import { useCompanions } from './companions'
import { useGuide } from './guide'
import { moduleOptions } from '../official/moduleOptions'
import { type MouseEvent, createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { HUD_LAYOUT, HUD_LAYOUT_VERSION } from './hudLayout'
import './hudLayout.css'
import { MapSearch } from './MapSearch'
import { useSpells } from './spells'
import { useGuild } from './guild'
import { useBreeding } from './breeding'
import { useCosmetics } from './cosmetics'
import { useQuests } from './quests'
import { referenceFixups } from './referenceFixups'
import { useEncyclopedia } from './encyclopedia'
import { OfficialHud, type OfficialTreeName, type TreeFrameRequest } from '../official/OfficialScreen'
import { WindowLayoutContext, useWindowLayout } from '../official/OfficialWindow'
import { layoutStore, windowStackStore } from '../official/layoutStore'
import { OFFICIAL_CANVAS } from '../official/surface'
import type { SizeQuantizer } from '../official/magnetism'
import { BANNER_WINDOW_ID, useBannerMenu } from './hudBannerMenu'
import { bannerQuantizer } from './bannerGeometry'
import { GAME_WINDOWS, HUD_CHROME_LAYERS, HUD_LAYERS, OPENABLE_WINDOWS, WINDOW_SEEDS, officialTreeFor } from './windows'
import { createHudResolver, PREVIEW_HUD, type CartographyMode, type CharacterSheetUi, type ChatUi, type HudView, type MinimapUi } from './hudBindings'
import { chromeMenuStore } from './chromeMenuStore'
import { chatChannelShortcut, chatStore, nextChatLineId, splitChatPrefix } from './chatStore'
import { loadGameCatalog, locationWorldmapId, worldmap } from './catalog'
import { mapCellCenter } from './worldmap'
import { worldmapViewStore } from './worldmapStore'
import { chatRepeaters, windowRepeaters } from './hudRepeaters'
import type { CharacterHud } from '../../giny/types'
import { CHAT_CHANNEL } from '../../giny/types'

type OpenWindow = {
  key: string
  label: string
  tree: OfficialTreeName
  size: { width: number; height: number }
  icon?: string
}

type GameHudProps = {
  liveCombat?: LiveCombat
  questState?: QuestState | null
  onAction?: (command: GameAction) => Promise<void>
  hud?: CharacterHud | null
  accountTag?: string
  onSendChat?: (content: string, channel: number) => void
}

/** Sélecteurs officiels du chat (`chatview`) dans le DOM rendu. */
function chatListElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const list = document.querySelector('[data-tree="chatview"] [data-binding="listChat"]')
  return list instanceof HTMLElement ? list : null
}

function chatInputElement(): HTMLInputElement | null {
  if (typeof document === 'undefined') return null
  const input = document.querySelector<HTMLInputElement>('[data-tree="chatview"] [data-binding="ti_chatInput"] input')
  return input ?? null
}

/** Épinglé en bas ? Seuil large : l'historique suit tant qu'on lit le bas. */
function chatPinned(list: HTMLElement): boolean {
  return list.scrollHeight - list.scrollTop - list.clientHeight < 28
}

function scrollChatToBottom(): void {
  const list = chatListElement()
  if (list) list.scrollTop = list.scrollHeight
  chatStore.markRead()
}

/** In-game overlay: the official HUD widgets and every interface the player
    opens, all on the one official runtime surface.

    The window controller owns gestures and persistence; HUD_LAYOUT supplies
    the initial rectangles measured from the official reference. */
function windowsFromQuery(): OpenWindow[] {
  if (typeof window === 'undefined') return []
  const params = new URLSearchParams(location.search)
  if (params.get('ui-preview') !== 'hud') return []
  return (params.get('open') ?? '').split(',').flatMap((id) => {
    const entry = OPENABLE_WINDOWS.find((item) => item.id === id.trim())
    return entry ? [{ key: entry.id, label: entry.label, tree: entry.tree, size: entry.size, icon: entry.icon }] : []
  })
}

export function GameHud({ hud, accountTag, onSendChat, onAction, questState, liveCombat }: GameHudProps) {
  useLayoutEffect(() => {
    layoutStore.applyPreset(HUD_LAYOUT_VERSION, HUD_LAYOUT, OFFICIAL_CANVAS)
    moduleOptions.applyChatDensityPreset(HUD_LAYOUT_VERSION)
  }, [])
  const combatTarget = useSyncExternalStore(combatTargetInfo.subscribe,combatTargetInfo.snapshot,combatTargetInfo.snapshot)
  const officialCombat = useLiveCombat(hud ?? null, liveCombat)
  const actions = useLiveActions(hud ?? null, onAction)
  const [open, setOpen] = useState<OpenWindow[]>(windowsFromQuery)
  const [browsing, setBrowsing] = useState(false)
  const [sheetView, setSheetView] = useState<NonNullable<CharacterSheetUi['view']>>(() => (
    typeof window !== 'undefined' && new URLSearchParams(location.search).get('sheet') === 'simple' ? 'simple' : 'detailed'
  ))
  const [sheetDetails, setSheetDetails] = useState(false)
  const [mapMode, setMapMode] = useState<CartographyMode>(() => {
    const requested = typeof window !== 'undefined' ? new URLSearchParams(location.search).get('map') : null
    return requested === 'anomaly' || requested === 'conquest' ? requested : 'worldmap'
  })
  const companions = useCompanions(open.some(w=>w.tree==='companionUi'))
  const guide = useGuide(open.some(w=>w.tree==='guidebookBase'),hud)
  const calendar = useCalendar(open.some(w=>w.tree==='calendarUI'))
  const profile = useProfile(hud ?? null)
  const jobs = useJobs(hud ?? null)
  const achievements = useAchievements(open.some(w=>w.tree==='achievements'),hud ?? null)
  const ladder = useLadder(hud ?? null)
  const shop = useShop(open.some(w=>w.tree==='webBase'))
  const combatPreview = !liveCombat && import.meta.env.DEV && new URLSearchParams(location.search).get('combat-preview') === 'preparation'
  const combat = useCombatPresentation(hud ?? null,import.meta.env.DEV && new URLSearchParams(location.search).has('ui-preview') ? REFERENCE_FIGHT : undefined)
  const worldDisplay = useSyncExternalStore(worldDisplayStore.subscribe, worldDisplayStore.snapshot)
  const modulePrefs = useSyncExternalStore(moduleOptions.subscribe,moduleOptions.snapshot)
  useLayoutEffect(() => {
    const bar = layoutStore.get('ActionBar')
    const height = 39 + 46 * moduleOptions.get('ActionBar').rows
    if (bar && bar.h !== height) layoutStore.set('ActionBar', {
      ...bar, y: Math.max(0, bar.y + bar.h - height), h: height,
    })
  }, [modulePrefs])
  const [catalogTick, setCatalogTick] = useState(0)
  useEffect(() => {
    void loadGameCatalog(fetch, 'core').then(() => setCatalogTick((n) => n + 1)).catch(() => undefined)
  }, [])
  const catalogWindows = open.map(window => window.tree).sort().join(',')
  useEffect(() => {
    const windows = catalogWindows.split(',')
    const groups: Array<'achievements' | 'jobs' | 'cosmetics'> = []
    if (windows.includes('achievements')) groups.push('achievements')
    if (windows.includes('jobUI') || windows.includes('recipesUI')) groups.push('jobs')
    if (windows.includes('cosmeticUi')) groups.push('cosmetics')
    let alive = true
    void Promise.all(groups.map(group => loadGameCatalog(fetch, group)))
      .then(() => { if (alive && groups.length) setCatalogTick(n => n + 1) }).catch(() => undefined)
    return () => { alive = false }
  }, [catalogWindows])
  const mapView = useSyncExternalStore(worldmapViewStore.subscribe, worldmapViewStore.snapshot, worldmapViewStore.snapshot)
  const view = useMemo<HudView | null>(() => {
    const source = hud ?? (import.meta.env.DEV && new URLSearchParams(location.search).get('ui-preview') === 'hud' ? PREVIEW_HUD : null)
    if (!source) return null
    const me = officialCombat.me
    return { ...source, ...(me ? {life:{current:me.life,max:me.max_life,shield:me.shield},points:{...source.points,ap:me.ap,mp:me.mp}} : {}), account: { ...source.account, tag: accountTag } }
  }, [accountTag, hud, officialCombat.me])
  const encyclopedia = useEncyclopedia(open.some(item => item.tree === 'encyclopediaBase'), view)
  const cosmetics = useCosmetics(open.some(item => item.tree === 'cosmeticUi'), view, onAction ? command => { void actions.run(command) } : undefined, actions.pending)
  const quests = useQuests(view)
  const breeding = useBreeding(view)
  const guild = useGuild(view)
  const spells = useSpells(view, onAction ? id => { void actions.run({ action: 'spell.activate', args: { spellId: id } }) } : undefined, actions.pending)
  const sheet = useMemo<CharacterSheetUi>(() => ({
    view: sheetView,
    detailsOpen: sheetDetails,
    onView: setSheetView,
    onToggleDetails: () => setSheetDetails((current) => !current),
  }), [sheetDetails, sheetView])
  const cartography = useMemo(() => ({ mode: mapMode, onMode: setMapMode }), [mapMode])
  const menuOpen = useSyncExternalStore(chromeMenuStore.subscribe, chromeMenuStore.snapshot, chromeMenuStore.snapshot)
  const widgetManagerResolve = useHudWidgetManager()
  const gameMenu = useMemo(() => ({ open: menuOpen, onToggle: chromeMenuStore.toggle, onOptions: chromeMenuStore.showOptions }), [menuOpen])
  const tabState = useSyncExternalStore(chatTabs.subscribe, chatTabs.snapshot, chatTabs.snapshot)
  const activeChatTab = tabState.tabs.find(tab => tab.id === tabState.activeId) ?? tabState.tabs[0]
  const [chatMenu, setChatMenu] = useState<ChatTabMenuAnchor | null>(null)
  const closeChatMenu = useCallback(() => setChatMenu(null), [])
  const inCombat = Boolean(liveCombat?.state.snapshot) || combatPreview
  const wasInCombat = useRef(false)
  useEffect(() => {
    if (inCombat && !wasInCombat.current) chatTabs.enterCombat()
    wasInCombat.current = inCombat
  }, [inCombat])
  const chatState = useSyncExternalStore(chatStore.subscribe, chatStore.snapshot, chatStore.snapshot)
  const focusChatInput = useCallback(() => chatInputElement()?.focus(), [])
  const sendChat = useCallback(() => {
    const snapshot = chatStore.snapshot()
    const raw = snapshot.draft.trim()
    if (!raw) return
    // `/g salut` route vers la guilde et mémorise le canal, comme l'officiel.
    const { channel, content } = splitChatPrefix(raw, snapshot.channel)
    const text = content.trim()
    if (!text) return
    if (channel !== snapshot.channel) chatStore.setChannel(channel)
    chatStore.setDraft('')
    chatStore.markRead()
    // L'envoi colle en bas : l'historique suit même si on lisait plus haut.
    requestAnimationFrame(scrollChatToBottom)
    if (onSendChat) {
      try {
        onSendChat(text, channel)
      } catch (error) {
        chatStore.append({
          id: nextChatLineId(),
          kind: 'error',
          channel: CHAT_CHANNEL.INFO,
          content: error instanceof Error ? error.message : String(error),
          timestamp: Math.trunc(Date.now() / 1000),
        })
      }
      return
    }
    chatStore.append({
      id: nextChatLineId(),
      kind: 'message',
      channel,
      sender: view?.character.name,
      content: text,
      timestamp: Math.trunc(Date.now() / 1000),
    })
  }, [onSendChat, view?.character.name])
  const addChatChannel = useCallback(() => {
    if (chatStore.snapshot().collapsed) chatStore.setCollapsed(false)
    chatTabs.add()
  }, [])
  const chat = useMemo<ChatUi>(() => ({
    draft: chatState.draft,
    onDraft: chatStore.setDraft,
    onSend: sendChat,
    channel: chatState.channel,
    channelShortcut: chatChannelShortcut(chatState.channel),
    onCycleChannel: chatStore.cycleChannel,
    onAddChannel: addChatChannel,
    unread: chatState.unread,
    onScrollBottom: scrollChatToBottom,
    collapsed: chatState.collapsed,
    onToggleCollapsed: chatStore.toggleCollapsed,
  }), [addChatChannel, chatState.channel, chatState.collapsed, chatState.draft, chatState.unread, sendChat])
  // Suivi d'historique officiel : épinglé en bas, `btn_news` compte les lignes
  // manquées, et tout suivi (lignes, resize de la fenêtre, repli) recolle.
  const chatPinnedRef = useRef(true)
  const chatLineCount = useRef(chatState.lines.length)
  useEffect(() => {
    const previous = chatLineCount.current
    chatLineCount.current = chatState.lines.length
    const arrived = chatState.lines.length - previous
    if (arrived <= 0) {
      if (chatState.collapsed) return
      if (chatPinnedRef.current) scrollChatToBottom()
      return
    }
    if (chatState.collapsed || !chatPinnedRef.current) {
      chatStore.markUnread(Math.min(99, chatStore.snapshot().unread + arrived))
      return
    }
    scrollChatToBottom()
  }, [chatState.collapsed, chatState.lines])
  useEffect(() => {
    const list = chatListElement()
    if (!list) return
    chatPinnedRef.current = chatPinned(list)
    const onScroll = () => {
      const node = chatListElement()
      if (!node) return
      chatPinnedRef.current = chatPinned(node)
      if (chatPinnedRef.current) chatStore.markRead()
    }
    // Resize de la fenêtre de chat : la liste grandit, l'historique reste
    // collé en bas au lieu de laisser la saisie flotter au milieu du vide.
    const observer = new ResizeObserver(() => {
      if (chatPinnedRef.current) scrollChatToBottom()
    })
    list.addEventListener('scroll', onScroll, { passive: true })
    observer.observe(list)
    return () => {
      list.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [])

  const openTree = useCallback((key: string, label: string, tree: OfficialTreeName, size: { width: number; height: number }, icon?: string) => {
    setOpen((current) => {
      if (current.some((item) => item.key === key)) return current.filter((item) => item.key !== key)
      return [...current, { key, label, tree, size, icon }]
    })
  }, [])
  const close = useCallback((key: string) => { if(['combatResult','FightResult','combatResultSimple','FightResultSimple'].includes(key)) liveCombat?.client.dismissCombatResult(); else setOpen((current) => current.filter((item) => item.key !== key)) }, [liveCombat?.client])

  // Opening geometry comes from the reference preset; resizes snap the menu
  // to whole slots, using the same density as its rendered grid.
  const quantizer = useCallback((id: string): SizeQuantizer | undefined => (id === BANNER_WINDOW_ID ? bannerQuantizer : undefined), [])
  const seed = useCallback((id: string) => id === 'fightTimelineMagneticDragWindow' ? {x:(1920-Math.min(860,58+(liveCombat?.state.snapshot?.fighters.length??2)*86))/2,y:28,w:Math.min(860,58+(liveCombat?.state.snapshot?.fighters.length??2)*86),h:96} : id === 'EndTurnWidget' ? {x:1275,y:936,w:218,h:144} : id === 'window_challengesSettings' ? {x:16,y:210,w:200,h:192} : id === 'UIChallengeChoiceDisplay' ? {x:1548,y:510,w:360,h:240} : WINDOW_SEEDS[id], [liveCombat?.state.snapshot?.fighters.length])
  // Official WindowFigmas centre on the 1920×1080 canvas. There is no
  // IL2CPP `shellInset` / `hudInset`. Passing 82 here clamped BannerMenu
  // (USS `top: 55`) down to y=82 and shifted untitled-axis windows off true
  // canvas centre. Title-bar hanging stays a WindowFigma constructor issue.
  const windows = useWindowLayout({ bounds: OFFICIAL_CANVAS, onClose: close, quantizer, seed })

  const shortcutState = useSyncExternalStore(shortcutPreferences.subscribe, shortcutPreferences.snapshot, shortcutPreferences.snapshot)
  const shortcuts = useMemo(() => {
    const menus = SHORTCUT_SECTIONS.find(section => section.title === 'Menus')!.rows
    return new Map(OPENABLE_WINDOWS.flatMap(item => {
      const row = menus.find(row => row.windowId === item.id)
      const key = row ? shortcutPreferences.get(row.id) : item.shortcut?.replace('shift+', 'Maj + ').toUpperCase()
      return key ? [[key, item] as const] : []
    }))
  }, [shortcutState])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.defaultPrevented || document.querySelector('.options-window') || chromeMenuStore.snapshot()) return
      // Tab dans la saisie : cycle du canal officiel sans perdre le focus.
      if (event.key === 'Tab' && target instanceof HTMLInputElement
        && target.closest('[data-tree="chatview"] [data-binding="ti_chatInput"]')) {
        event.preventDefault()
        chatStore.cycleChannel()
        return
      }
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return
      if (event.key === 'Enter' && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
        event.preventDefault()
        focusChatInput()
        return
      }
      if (event.key === 'Escape') { setOpen((current) => current.slice(0, -1)); return }
      const entry = shortcuts.get(keyLabel(event))
      if (entry) { event.preventDefault(); openTree(entry.id, entry.label, entry.tree, entry.size, entry.icon) }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [focusChatInput, openTree, shortcuts])

  const openIds = useMemo(() => new Set(open.map((item) => item.key)), [open])
  const bannerResolve = useBannerMenu({ openIds, openTree, onBrowse: () => setBrowsing(true) })

  // MINI-CARTE officielle : le clic sur `mapView` ouvre la grande Carte
  // (même entrée que le raccourci `;` / la tuile du banner).
  const openMap = useCallback(() => {
    const entry = GAME_WINDOWS.find((item) => item.id === 'map')
    if (!entry) return
    openTree(entry.id, entry.label, entry.tree, entry.size, entry.icon)
  }, [openTree])
  const minimap = useMemo<MinimapUi>(() => ({ onOpenMap: openMap }), [openMap])

  // Cartographie officielle : la vue s'ouvre sur la carte du joueur, à son
  // `startScale`, centrée sur lui, et le suit tant qu'on ne l'a pas déplacée
  // (`ui.cartography.centerOnPlayer` la ré-accroche).
  const playerWorldmapId = view ? locationWorldmapId(view.map) : 0
  useEffect(() => {
    if (!view || !playerWorldmapId) return
    const meta = worldmap(playerWorldmapId)
    if (!meta) return
    const focus = mapCellCenter(meta, view.map.x, view.map.y)
    const state = worldmapViewStore.snapshot()
    if (state.worldmapId !== playerWorldmapId) worldmapViewStore.open(playerWorldmapId, focus)
    else if (state.followPlayer) worldmapViewStore.centerOn(focus, true)
  }, [catalogTick, playerWorldmapId, view])

  const layers = useMemo(
    () => [...HUD_LAYERS, { tree: 'SmileyUI' },...(combatPreview?[{tree:'FightTimeline'},{tree:'EndTurnWidget'}]:[])].map((layer) => ({
      ...layer,
      resolve: layer.tree === 'SmileyUI' ? (binding: string) => binding === 'Smiley' ? { hidden: !moduleVisible('Smiley') } : undefined : layer.tree === 'FightTimeline' || layer.tree === 'EndTurnWidget' ? combat.resolve : layer.tree === 'bannerMenu'
        ? bannerResolve
        : createHudResolver(layer.tree, view, sheet, undefined, undefined, undefined, undefined, layer.tree === 'chatview' ? chat : undefined, layer.tree === 'CartographyBannerUI' ? minimap : undefined),
      repeaters: layer.tree === 'FightTimeline' ? combat.timelineRepeaters : layer.tree === 'chatview'
        ? {...chatRepeaters((chatState.lines.length ? chatState.lines : import.meta.env.DEV && new URLSearchParams(location.search).has('ui-preview') ? REFERENCE_CHAT : []).filter(line => matchesChatTab(activeChatTab, line))),ctr_toggleButtons: [
            ...tabState.tabs,
            { id: 'add', label: 'Ajouter un onglet', icon: 'plus' },
          ].map(({id, label, icon}) => ({
            key: id,
            template: 'DofusTab',
            resolve: (binding: string) => {
              if (binding === 'tab_label') return { text: label, className: 'chat-tab-label' }
              if (binding === 'tab_icon') return {
                hidden: false,
                style: {
                  display: 'block', width: 24, height: 24,
                  backgroundColor: 'currentColor',
                  mask: `url(/dofus3/icons/${icon}.png) center / contain no-repeat`,
                  WebkitMask: `url(/dofus3/icons/${icon}.png) center / contain no-repeat`,
                },
              }
              if (!binding) return {
                style: { width: 32, height: 32, minWidth: 0, padding: 0 },
                className: `chat-channel-tab ${id === 'add' ? 'chat-channel-add' : ''} ${tabState.activeId === id ? 'activeTrue' : 'activeFalse'}`,
                onContextMenu: id === 'add' ? undefined : (event: MouseEvent<HTMLElement>) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setChatMenu({ id, x: event.clientX, y: event.clientY })
                },
                onClick: () => {
                  closeChatMenu()
                  if (id === 'add') addChatChannel()
                  else chatTabs.select(id)
                },
              }
              return undefined
            },
          }))}
        : (view ? windowRepeaters(layer.tree, view) : undefined),
    })),
    [addChatChannel, bannerResolve, catalogTick, chat, chatState.lines, activeChatTab, tabState, closeChatMenu, minimap, sheet, view, modulePrefs, worldDisplay, combatPreview, combat],
  )
  const chrome = useMemo(
    () => HUD_CHROME_LAYERS.map((layer) => ({
      ...layer,
      resolve: layer.tree === 'widgetManager' ? widgetManagerResolve : createHudResolver(layer.tree, view, sheet, undefined, undefined, gameMenu),
    })),
    [catalogTick, gameMenu, sheet, view, widgetManagerResolve],
  )
  const openAppearance = useCallback(() => {
    // UXML WindowFigma `Appearance` is 716×600; no constructor title/icon.
    openTree('appearanceEditor', '', 'AppearanceUI', { width: 716, height: 600 })
  }, [openTree])
  const hosted = useMemo(
    () => open.map((item) => ({
      key: item.key,
      tree: item.tree,
      resolve: (binding: string, scope?: string) => {
        if (item.tree === 'equipmentStorageUi' && binding === 'btn_checkCraft') return {
          text: 'RECETTES', onClick: () => {
            const entry = OPENABLE_WINDOWS.find(window => window.id === 'recipes')!
            windowStackStore.raise(entry.id)
            setOpen(current => current.some(window => window.key === entry.id) ? current : [...current, { key: entry.id, label: entry.label, tree: entry.tree, size: entry.size, icon: entry.icon }])
          },
        }
        if (item.tree === 'recipesUI' && binding === 'recipesUI') return {
          hidden: false, replaceChildren: true, className: 'inventory-recipes-host', children: createElement(InventoryRecipes, { hud: view, catalogTick }),
        }
        if (binding === 'header_buttonRight') return { onClick: () => close(item.key) }
        if (item.tree === 'CartographyMapUI' && binding === 'cartographyUi') return { children: createElement('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 } }, createElement(MapSearch)) }
        if (item.tree === 'CartographyMapUI' && binding === 'btn_openConfig') return { text: 'FERMER LA CARTE', onClick: () => close(item.key), style: { position: 'fixed' as const, left: 8, top: 4 } }
        if(binding==='btn_closeUI' && item.tree==='fightResult')return {onClick:()=>close(item.key)}
        const controller = item.tree === 'fightResult' ? combat : item.tree === 'webBase' ? shop : item.tree === 'achievements' ? achievements : item.tree === 'LadderUI' ? ladder : item.tree === 'calendarUI' ? calendar : item.tree === 'PlayerInfoUi' ? profile : item.tree === 'jobUI' ? jobs : item.tree === 'companionUi' ? companions : item.tree === 'guidebookBase' ? guide : item.tree === 'encyclopediaBase' ? encyclopedia : item.tree === 'cosmeticUi' ? cosmetics : item.tree === 'quests' ? quests : item.tree === 'BreedingUi' ? breeding : item.tree === 'guildBase' ? guild : item.tree === 'playerSpell' ? spells : undefined
        const live = controller?.resolve(binding, scope)
        const fix = referenceFixups(item.tree)(binding, scope)
        const base = live ?? fix ?? createHudResolver(item.tree, view, sheet, openAppearance, cartography, undefined, () => close(item.key))(binding, scope)
        const action = actions.resolve(item.tree, binding, scope)
        return action ? { ...base, ...action } : base
      },
      repeaters: item.tree === 'recipesUI' ? {} : item.tree === 'fightResult' ? combat.repeaters : item.tree === 'webBase' ? shop.repeaters : item.tree === 'achievements' ? achievements.repeaters : item.tree === 'LadderUI' ? ladder.repeaters : item.tree === 'calendarUI' ? calendar.repeaters : item.tree === 'PlayerInfoUi' ? profile.repeaters : item.tree === 'jobUI' ? jobs.repeaters : item.tree === 'companionUi' ? companions.repeaters : item.tree === 'guidebookBase' ? guide.repeaters : item.tree === 'encyclopediaBase' ? encyclopedia.repeaters : item.tree === 'cosmeticUi' ? { ...(view ? windowRepeaters(item.tree,view) : {}), ...cosmetics.repeaters } : item.tree === 'quests' ? quests.repeaters : item.tree === 'BreedingUi' ? breeding.repeaters : item.tree === 'guildBase' ? guild.repeaters : item.tree === 'playerSpell' ? spells.repeaters : view ? windowRepeaters(item.tree, view) : undefined,
      frame: { id: item.key, title: item.label, icon: item.icon, size: item.size, shortcut: GAME_WINDOWS.find(entry => entry.id === item.key)?.shortcut?.toUpperCase() } satisfies TreeFrameRequest,
    })),
    [catalogTick, cartography, mapView, open, openAppearance, sheet, view, encyclopedia, cosmetics, quests, breeding, guild, spells, companions, guide, calendar, profile, jobs, achievements, ladder, shop, combat, actions],
  )

  return <div className="game-hud" data-combat={!!liveCombat?.state.snapshot}>
    {liveCombat?.state.snapshot && <style>{`.game-hud[data-combat="true"] .official-canvas,.game-hud[data-combat="true"] .official-tree-host{${Object.entries(themes.find(t=>t.id==='Tribute')!.tokens).map(([k,v])=>`${k}:${v} !important;`).join('')}--header_ornament:url("${themes.find(t=>t.id==='Tribute')!.ornament}") !important;}`}</style>}
    {chatMenu && tabState.tabs.some(tab => tab.id === chatMenu.id) && <ChatTabMenu
      key={chatMenu.id} anchor={chatMenu} tab={tabState.tabs.find(tab => tab.id === chatMenu.id)!}
      combat={tabState.combatId === chatMenu.id} canDelete={tabState.tabs.length > 1} onClose={closeChatMenu}
    />}
    {actions.panel}
    {open.some(w => w.tree === 'quests') && actions.supports('quests.sync') && <RecurringQuestsPanel state={questState ?? null} run={actions.run} pending={actions.pending} />}
    {view?.synchronized === false && <div className="hud-sync-warning" role="status">
      Données du personnage en cours de synchronisation avec Giny…
    </div>}
    <WindowLayoutContext value={windows}>
      <OfficialHud layers={[
        ...layers.map(l => ({...l,resolve:(b:string,scope?:string)=>officialCombat.resolveHud(l.tree)(b,scope)??l.resolve?.(b,scope)})),
        ...officialCombat.layers,
        ...(liveCombat?.state.snapshot && combatTarget ? [targetInfoLayer(combatTarget,layoutStore.snapshot().ActionBar??HUD_LAYOUT.ActionBar)] : []),
      ]} windows={[
        ...hosted,
        ...(officialCombat.result ? [officialCombat.compactResult
          ? {key:'combatResultSimple',tree:'fightResultSimple',resolve:officialCombat.compactResolve,repeaters:officialCombat.compactRepeaters,frame:{id:'combatResultSimple',title:'',size:{width:450,height:128}}}
          : {key:'combatResult',tree:'fightResult',resolve:officialCombat.resultResolve,repeaters:officialCombat.repeaters,frame:{id:'combatResult',title:'Combat terminé',size:{width:1250,height:900}}}] : []),
      ]} chrome={chrome} />
    </WindowLayoutContext>

    {browsing && <InterfaceBrowser
      onClose={() => setBrowsing(false)}
      onReset={() => layoutStore.reset()}
      onPick={(name) => {
        const promoted = OPENABLE_WINDOWS.find((entry) => entry.tree === name)
        if (promoted) {
          openTree(promoted.id, promoted.label, promoted.tree, promoted.size, promoted.icon)
          return
        }
        openTree(`tree:${name}`, name, name, { width: 1000, height: 760 })
      }}
    />}
  </div>
}

/** Lists official window wrappers by default. The extracted catalogue is 600+
    trees, many of them templates or nested bodies that need a host. */
function InterfaceBrowser({ onPick, onClose, onReset }: { onPick: (name: string) => void; onClose: () => void; onReset: () => void }) {
  const [names, setNames] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [catalog, setCatalog] = useState<'windows' | 'all'>('windows')
  useEffect(() => {
    let active = true
    fetch('/ui-data/manifest.json')
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest: { tree_index?: string[] } | null) => { if (active && manifest?.tree_index) setNames(manifest.tree_index) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])
  const source = catalog === 'windows' ? OPENABLE_WINDOWS.map((entry) => entry.tree) : names
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const unique = [...new Set(source)]
    return needle ? unique.filter((name) => name.toLowerCase().includes(needle)) : unique
  }, [filter, source])
  return <aside className="game-browser">
    <header>
      <strong>{catalog === 'windows' ? 'Fenêtres officielles' : 'Tous les arbres'}</strong>
      <button type="button" onClick={onClose} aria-label="Fermer la liste">×</button>
    </header>
    <div className="game-browser-tabs">
      <button type="button" className={catalog === 'windows' ? 'is-active' : undefined} onClick={() => setCatalog('windows')}>Fenêtres</button>
      <button type="button" className={catalog === 'all' ? 'is-active' : undefined} onClick={() => setCatalog('all')}>Arbres extraits</button>
    </div>
    <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={`Filtrer ${shown.length} ${catalog === 'windows' ? 'fenêtres' : 'arbres'}…`} />
    <ul>
      {shown.map((name) => (
        <li key={name}><button type="button" onClick={() => onPick(officialTreeFor(name))}>{name}</button></li>
      ))}
    </ul>
    <footer>
      <button type="button" onClick={onReset}>Réinitialiser les positions</button>
    </footer>
  </aside>
}

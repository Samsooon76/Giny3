import { NpcInteractions, type NpcTarget } from '../game/NpcInteractions'
import { componentStyles } from '../official/stylesheet'
import { HudRefreshQueue } from '../../giny/HudRefreshQueue'
import { CharacterContextMenu } from '../game/CharacterContextMenu'
import { WorldContextMenu, type WorldMenuAnchor } from '../game/WorldContextMenu'
import { LoadingScreen } from './LoadingScreen'
import { CharacterTooltip, type CharacterHover } from '../game/CharacterTooltip'
import { MonsterGroupTooltip } from '../game/CombatHud'
import type { HudSpell, WorldActor } from '../../giny/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RuntimeStats } from '../../debug/stats'
import { logEvent } from '../../debug/sessionLogger'
import { GameRenderer } from '../../game/renderer/GameRenderer'
import type { GinyClient } from '../../giny/GinyClient'
import type { WorldSession } from '../../giny/types'
import { GameHud } from '../game/GameHud'
import { chatStore } from '../game/chatStore'
import { hudFromSession, sessionWithHud } from '../game/hudBindings'

export function WorldView({ session, client, message, onMessage, onSession }: {
  session: WorldSession
  client: GinyClient
  message: string
  onMessage: (message: string) => void
  onSession: (session: WorldSession) => void
}) {
  const [worldMenu, setWorldMenu] = useState<WorldMenuAnchor | null>(null)
  const closeWorldMenu = useCallback(() => setWorldMenu(null), [])
  const hostRef = useRef<HTMLDivElement>(null), rendererRef = useRef<GameRenderer | null>(null)
  // Captured once: later updates reach the renderer through setSession below.
  const initialSession = useRef(session)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const statsRef = useRef<RuntimeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [combatState, setCombatState] = useState(() => client.getCombatState())
  const [combatBusy, setCombatBusy] = useState(client.combatBusy)
  const [npcTarget, setNpcTarget] = useState<NpcTarget | null>(null)
  const closeNpcMenu = useCallback(() => setNpcTarget(null), [])
  useEffect(() => setNpcTarget(null), [session.mapId, combatState.snapshot?.phase])
  const [characterMenu, setCharacterMenu] = useState<CharacterHover | null>(null)
  const closeCharacterMenu = useCallback(() => setCharacterMenu(null), [])
  useEffect(() => setCharacterMenu(null), [session.mapId, combatState.snapshot?.phase])
  const [characterHover, setCharacterHover] = useState<CharacterHover | null>(null)
  const [monsterHover, setMonsterHover] = useState<{ actor: WorldActor; x: number; y: number } | null>(null)
  const monsterHideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const keepMonsterPopup = () => clearTimeout(monsterHideTimer.current)
  const hideMonsterPopup = () => {
    keepMonsterPopup()
    monsterHideTimer.current = setTimeout(() => setMonsterHover(null), 250)
  }
  const closeMonsterPopup = () => { keepMonsterPopup(); setMonsterHover(null) }
  useEffect(() => () => clearTimeout(monsterHideTimer.current), [])
  const [selectedSpell, setSelectedSpell] = useState<HudSpell | null>(null)
  const selectedRef = useRef<HudSpell | null>(null)
  const selectSpell = (spell: HudSpell | null) => { selectedRef.current = spell; setSelectedSpell(spell); rendererRef.current?.selectCombatSpell(spell) }
  useEffect(() => client.onCombat(() => { setCombatState(client.getCombatState()); setCombatBusy(client.combatBusy) }), [client])
  const [questState, setQuestState] = useState(() => client.getQuestState())
  useEffect(() => {
    setQuestState(client.getQuestState())
    return client.onQuestState(() => setQuestState(client.getQuestState()))
  }, [client, session.character.id])
  const report = (error: unknown) => {
    const text = error instanceof Error ? error.message : String(error)
    logEvent('error', 'worldview', text)
    onMessage(text)
  }
  // The renderer owns the WebGL context, the texture cache and the player
  // entity: it is mounted once and receives session updates in place, so
  // crossing a border never tears the whole scene down and rebuilds it.
  useEffect(() => {
    if (!hostRef.current) return
    // Network callbacks may run in the same React batch. Publish the new map
    // to subsequent HUD/snapshot callbacks immediately, not after React paints.
    const adoptSession = (next: WorldSession) => {
      sessionRef.current = next
      onSession(next)
    }
    const renderer = new GameRenderer({
      session: initialSession.current,
      onWorldContextMenu: setWorldMenu,
      onCharacterHover: setCharacterHover,
      onNpcClick: target => { setCharacterMenu(null); setWorldMenu(null); setCharacterHover(null); setNpcTarget(target) },
      onCharacterClick: target => { setNpcTarget(null); setWorldMenu(null); setCharacterHover(null); setCharacterMenu(target) },
      onMonsterHover: hover => {
        if (hover) { keepMonsterPopup(); setMonsterHover(hover) }
        else hideMonsterPopup()
      },
      attackMonster: id => { try { client.combatCommand('attack', id) } catch (error) { report(error) } },
      onCombatCell: (cell, path) => {
        try {
          onMessage('')
          const fight = client.getCombatState().snapshot
          if (fight?.phase === 'preparation') client.combatCommand('place', cell)
          else if (selectedRef.current) { client.combatCommand('cast', selectedRef.current.id, cell); selectSpell(null) }
          else client.combatMove(path)
        } catch (error) { report(error) }
      },
      onStats: stats => { statsRef.current = stats },
      requestMovement: (path, mapId) => { onMessage(''); return client.requestMovement(path, mapId) },
      cancelMovement: (mapId, cellId) => client.cancelMovement(mapId, cellId),
      confirmMovement: (mapId) => client.confirmMovement(mapId),
      changeMap: async (mapId) => {
        const next = await client.changeMap(mapId)
        adoptSession(next)
      },
      useInteractive: (elementId) => { onMessage(''); client.useInteractive(elementId) },
      onLoading: value => {
        setLoading(value)
        if (value) onMessage('')
        const host = hostRef.current
        if (host) {
          if (value) delete host.dataset.readyMap
          else host.dataset.readyMap = String(rendererRef.current?.performanceSnapshot().mapId ?? '')
        }
      },
      onMapError: setMapError,
      onError: onMessage,
    })
    rendererRef.current = renderer
    const debug = window as unknown as { __ginyCombat?: () => unknown }
    if (import.meta.env.DEV) debug.__ginyCombat = () => client.getCombatState()
    const controller = new AbortController()
    const mounted = renderer.mount(hostRef.current).then(() => renderer.presentCombat(null, client.getCombatState(), controller.signal))
    void mounted.catch(report)
    client.setCombatPresenter(async (event, state, signal) => { await mounted; if (!controller.signal.aborted) await renderer.presentCombat(event, state, signal) })
    let mapSnapshotPending = false
    const refreshActors = async () => {
      if (document.hidden || client.getCombatState().snapshot || mapSnapshotPending || controller.signal.aborted) return
      mapSnapshotPending = true
      const mapId = sessionRef.current.mapId
      try {
        const snapshot = await client.snapshot()
        if (!controller.signal.aborted && !client.getCombatState().snapshot && mapId === sessionRef.current.mapId) adoptSession({ ...sessionRef.current, ...snapshot })
      } catch { /* Next map refresh reconciles actors after a transition. */ }
      finally { mapSnapshotPending = false }
    }
    const actorRefresh = new HudRefreshQueue(refreshActors)
    const requestActorRefresh = () => actorRefresh.request()
    const unsubscribeActors = client.onActorsChanged(requestActorRefresh)
    const actorsTimer = setInterval(requestActorRefresh, 10000)
    document.addEventListener('visibilitychange', requestActorRefresh)
    window.addEventListener('focus', requestActorRefresh)
    const unsubscribeMovement = client.onMovement((movement) => renderer.playActorMovement(movement.actorId, movement.path))
    const unsubscribeHud = client.onHud((hud) => adoptSession(sessionWithHud(sessionRef.current, hud)))
    const unsubscribeInteractive = client.onInteractive((event) => renderer.onInteractiveEvent(event))
    // A door, a zaap or a death moves the character server-side: the emulator
    // just pushes CurrentMap, and the reloaded session lands here.
    const unsubscribeMap = client.onMapChanged((next) => { renderer.resyncWorldPosition(next); onMessage(''); adoptSession(next) })
    chatStore.clear()
    const unsubscribeChat = client.onChat((line) => chatStore.append(line))
    const unsubscribeSpeech = client.onChat((line) => { if (line.senderId == null || !chatStore.isIgnored(line.senderId)) renderer.showSpeech(line) }, false)
    const stopHudSynchronization = client.startHudSynchronization()
    renderer.setOverlay({ showGrid: false, showCellIds: false, showWalkability: false, showElementBounds: false })
    return () => {
      delete debug.__ginyCombat
      controller.abort(); clearInterval(actorsTimer); actorRefresh.reset(); unsubscribeActors()
      document.removeEventListener('visibilitychange', requestActorRefresh)
      window.removeEventListener('focus', requestActorRefresh)
      client.setCombatPresenter(null)
      unsubscribeMovement(); unsubscribeHud(); unsubscribeInteractive(); unsubscribeMap(); unsubscribeChat(); unsubscribeSpeech()
      stopHudSynchronization(); renderer.destroy(); rendererRef.current = null
    }
  }, [client, onMessage, onSession])
  useEffect(() => {
    void rendererRef.current?.setSession(session).catch(report)
  }, [onMessage, session])
  return <div className={`world-screen ${combatState.snapshot ? 'in-combat' : ''}`}>
    <div className="world-viewport" ref={hostRef} />
    {loading && <LoadingScreen label="Chargement de la carte…" />}
    {(mapError || message) && <div className="world-message">{mapError || message}{mapError && !loading && <button type="button" onClick={() => { void componentStyles.retry(); void rendererRef.current?.retryMap() }}>Réessayer le chargement</button>}</div>}
    {worldMenu && rendererRef.current && !loading && <WorldContextMenu anchor={worldMenu} renderer={rendererRef.current} onClose={closeWorldMenu} />}
    {characterMenu && !combatState.snapshot && !loading && <CharacterContextMenu target={characterMenu} onClose={closeCharacterMenu} onZoom={() => rendererRef.current?.zoomWorld('in', characterMenu)} />}
    {!combatState.snapshot && !loading && <NpcInteractions client={client} target={npcTarget} actors={session.actors} mapId={session.mapId} onCloseMenu={closeNpcMenu} onError={onMessage} />}
    <CharacterTooltip hover={npcTarget || characterMenu || combatState.snapshot || loading ? null : characterHover} />
    <MonsterGroupTooltip hover={combatState.snapshot ? null : monsterHover} hud={session.hud} onPointerEnter={keepMonsterPopup} onPointerLeave={hideMonsterPopup} onClose={closeMonsterPopup} />
    <GameHud
      liveCombat={{ display: rendererRef.current?.combatDisplay, state: combatState, client, busy: combatBusy, selected: selectedSpell, select: selectSpell, report }}
      hud={hudFromSession(session)}
      accountTag={session.account.tag}
      onSendChat={(content, channel) => client.sendChat(content, channel)}
      onAction={(command) => client.performAction(command)}
      questState={questState}
    />
  </div>
}

/** Dev harness: render one map without a world server (?map=<id>). */
export function MapPreview({ mapId }: { mapId: number }) {
  const rendererRef = useRef<GameRenderer | null>(null)
  const [worldMenu, setWorldMenu] = useState<WorldMenuAnchor | null>(null)
  const closeWorldMenu = useCallback(() => setWorldMenu(null), [])
  const hostRef = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [stats, setStats] = useState<RuntimeStats | null>(null)
  useEffect(() => {
    if (!hostRef.current) return
    const renderer = new GameRenderer({ mapId, onWorldContextMenu: setWorldMenu, onStats: setStats, onLoading: value => { setLoading(value); if (value) setMessage('') }, onMapError: setMapError, onError: setMessage })
    rendererRef.current = renderer
    void renderer.mount(hostRef.current).catch((error) => setMessage(error instanceof Error ? error.message : String(error)))
    renderer.setOverlay({ showGrid: false, showCellIds: false, showWalkability: false, showElementBounds: false })
    return () => { renderer.destroy(); rendererRef.current = null }
  }, [mapId])
  return <div className="world-screen">{worldMenu && rendererRef.current && !loading && <WorldContextMenu anchor={worldMenu} renderer={rendererRef.current} onClose={closeWorldMenu} />}<div className="world-viewport" ref={hostRef} />{loading && <LoadingScreen label="Chargement de la carte…" />}{(mapError || message) && <div className="world-message">{mapError || message}{mapError && !loading && <button type="button" onClick={() => { void componentStyles.retry(); void rendererRef.current?.retryMap() }}>Réessayer le chargement</button>}</div>}<div className="world-identity">map {stats?.mapId ?? mapId} · {Math.round(stats?.loadMs ?? 0)} ms · {stats?.spriteCount ?? 0} sprites</div></div>
}

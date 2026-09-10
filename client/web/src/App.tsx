import { lazy, useEffect, useMemo, useRef, useState } from 'react'
import { GinyClient } from './giny/GinyClient'
import { logEvent, logError } from './debug/sessionLogger'
import { SessionLogViewer, toggleLogViewer } from './debug/sessionLogViewer'
import type { Account, Character, CreationCatalog, GameServer, SelectedServer, WorldSession } from './giny/types'
const NpcReview = lazy(() => import('./debug/NpcReview').then(module => ({ default: module.NpcReview })))
const InventoryPreview = lazy(() => import('./ui/bubble/windows/inventory/InventoryPreview').then(module => ({ default: module.InventoryPreview })))
const GameHud = lazy(() => import('./ui/game/GameHud').then(module => ({ default: module.GameHud })))
const OfficialCombatReview = lazy(() => import('./ui/game/OfficialCombatReview').then(module => ({ default: module.OfficialCombatReview })))
import { REFERENCE_HUD as PREVIEW_HUD } from './ui/game/referencePreview'
import { AuthenticatedChrome } from './ui/screens/AuthenticatedChrome'
const CharacterScreen = lazy(() => import('./ui/screens/CharacterScreen').then(module => ({ default: module.CharacterScreen })))
const CreationScreen = lazy(() => import('./ui/screens/CreationScreen').then(module => ({ default: module.CreationScreen })))
import { effectiveColors, hexNumber } from './ui/screens/creation'
import { LoadingScreen } from './ui/screens/LoadingScreen'
import { LoginScreen } from './ui/screens/LoginScreen'
const ServerScreen = lazy(() => import('./ui/screens/ServerScreen').then(module => ({ default: module.ServerScreen })))
const UiPreview = lazy(() => import('./ui/screens/UiPreview').then(module => ({ default: module.UiPreview })))
const MapPreview = lazy(() => import('./ui/screens/WorldView').then(module => ({ default: module.MapPreview })))
const WorldView = lazy(() => import('./ui/screens/WorldView').then(module => ({ default: module.WorldView })))
import { PREVIEW_ACCOUNT, PREVIEW_CHARACTER } from './ui/screens/previewData'
import { INITIAL_CREATION, type CreationState, type Screen } from './ui/screens/types'
import './App.css'

export default function App() {
  const client = useMemo(() => new GinyClient(), [])
  useEffect(() => {
    if (!import.meta.env.DEV) return
    let disposed = false
    const cleanups: Array<() => void> = []
    void Promise.all([
      import('./ui/official/dumpBoxes'),
      import('./ui/official/UiInspector'),
    ]).then(([boxes, inspector]) => {
      if (disposed) return
      cleanups.push(boxes.installDumpClientBoxes(), inspector.installUiInspector())
    }).catch(error => logEvent('error', 'ui-dev-tools', String(error)))
    return () => {
      disposed = true
      for (const cleanup of cleanups) cleanup()
    }
  }, [])
  const credentials = useRef<{ identifier: string; password: string } | null>(null)
  const [screen, setScreen] = useState<Screen>('login')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [account, setAccount] = useState<Account | null>(null)
  const [servers, setServers] = useState<GameServer[]>([])
  const [selectedServerId, setSelectedServerId] = useState(0)
  const [server, setServer] = useState<SelectedServer | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = useState(0)
  const [catalog, setCatalog] = useState<CreationCatalog | null>(null)
  const [creation, setCreation] = useState<CreationState>(INITIAL_CREATION)
  const [session, setSession] = useState<WorldSession | null>(null)
  useEffect(() => () => client.close(), [client])
  useEffect(() => client.onServers(listed => {
    setServers(listed)
    setSelectedServerId(previous => listed.some(item => item.id === previous) ? previous : listed.find(item => item.selectable)?.id ?? listed[0]?.id ?? 0)
    setMessage('')
  }), [client])
  useEffect(() => { logEvent('load', 'screen', screen) }, [screen])
  useEffect(() => {
    return client.onDisconnect((reason) => {
      logout(reason)
    })
  }, [client])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        toggleLogViewer()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setMessage('')
    const startedAt = performance.now()
    try { await work() } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logError('action-failed', error, { durationMs: Math.round(performance.now() - startedAt) })
      setMessage(message)
    }
    finally { setBusy(false) }
  }
  const login = (identifier: string, password: string) => run(async () => {
    const authenticated = await client.authenticate(identifier, password)
    credentials.current = { identifier, password }
    setAccount(authenticated)
    const listed = await client.listServers()
    setServers(listed); setSelectedServerId(listed.find((item) => item.selectable)?.id ?? listed[0]?.id ?? 0); setScreen('servers')
  })
  const chooseServer = (destination: 'characters' | 'creation' = 'characters') => run(async () => {
    if (!selectedServerId) throw new Error('Sélectionne un serveur disponible.')
    const selected = await client.selectServer(selectedServerId); setServer(selected)
    if (!selected.canCreateCharacter && destination === 'creation') throw new Error('La création de personnage est indisponible sur ce serveur.')
    const result = await client.listCharacters()
    setCharacters(result.characters); setCatalog(result.catalog); setSelectedCharacterId(result.characters[0]?.id ?? 0); setScreen(destination)
  })
  const enterWorld = () => run(async () => {
    if (!selectedCharacterId) throw new Error('Sélectionne un personnage.')
    setScreen('loading')
    try {
      const world = await client.enterWorld(selectedCharacterId)
      setSession(world)
      setScreen('world')
    } catch (error) {
      setScreen('characters')
      throw error
    }
  })
  const createCharacter = () => run(async () => {
    if (!catalog) throw new Error('Catalogue officiel indisponible.')
    const selectedClass = catalog.classes[creation.classIndex], variant = selectedClass.variants[creation.gender]
    const head = variant.heads[creation.headIndex], colors = effectiveColors(creation, variant.colors)
    const created = await client.createCharacter({ name: creation.name, breedId: selectedClass.breed_id, sex: creation.gender === 'female', cosmeticId: head.id, colors: colors.slice(0, 5).map(hexNumber) })
    const result = await client.listCharacters()
    setCharacters(result.characters); setSelectedCharacterId(created.id); setCreation(INITIAL_CREATION); setScreen('characters')
  })
  const reconnect = async (target: 'servers' | 'characters') => {
    const secret = credentials.current
    if (!secret) throw new Error('La session a expiré. Reconnecte-toi.')
    client.close()
    const authenticated = await client.authenticate(secret.identifier, secret.password)
    setAccount(authenticated)
    const listed = await client.listServers()
    setServers(listed)
    setSession(null)
    if (target === 'servers') {
      setServer(null); setCharacters([]); setSelectedCharacterId(0)
      setSelectedServerId(listed.find((item) => item.id === server?.id)?.id ?? listed.find((item) => item.selectable)?.id ?? listed[0]?.id ?? 0)
      setScreen('servers')
      return
    }
    if (!server) throw new Error('Aucun serveur actif.')
    const selected = await client.selectServer(server.id)
    const result = await client.listCharacters()
    setServer(selected); setCharacters(result.characters); setCatalog(result.catalog)
    setSelectedCharacterId(session?.character.id ?? result.characters[0]?.id ?? 0)
    setScreen('characters')
  }
  const changeCharacter = () => run(() => reconnect('characters'))
  const changeServer = () => run(() => reconnect('servers'))
  const logout = (notice = '') => {
    client.close(); credentials.current = null
    setAccount(null); setServers([]); setServer(null); setCharacters([]); setCatalog(null); setSession(null)
    setSelectedServerId(0); setSelectedCharacterId(0); setCreation(INITIAL_CREATION); setMessage(notice); setBusy(false); setScreen('login')
  }

  const previewEnabled = import.meta.env.DEV || import.meta.env.MODE === 'benchmark'
  const previewMode = previewEnabled ? new URLSearchParams(location.search).get('ui-preview') : null
  // `?ui-preview=hud` mounts the in-game HUD without a session, which is how the
  // official widgets get looked at while they are being wired up.
  // `?ui-preview=inventory` is the Bubble inventory workshop: presentation only,
  // no Giny connection. The same InventoryView later binds to live items.
  if (previewMode === 'npc') return <NpcReview />
  if (previewMode === 'inventory') return <InventoryPreview />
  if (previewMode === 'hud' && new URLSearchParams(location.search).has('combat-preview')) return <OfficialCombatReview phase={new URLSearchParams(location.search).get('combat-preview') ?? 'preparation'} />
  if (previewMode === 'hud') return <div className="world-screen"><GameHud hud={new URLSearchParams(location.search).get('quest-state') === 'completed' ? {...PREVIEW_HUD,quests:PREVIEW_HUD.quests.map(q=>({...q,completed:true}))} : PREVIEW_HUD} accountTag={PREVIEW_ACCOUNT.tag} /><AuthenticatedChrome account={PREVIEW_ACCOUNT} character={PREVIEW_CHARACTER} screen="world" busy={false} onChangeCharacter={() => { location.search = "?ui-preview=characters" }} onChangeServer={() => { location.search = "?ui-preview=servers" }} onLogout={() => { location.search = "?ui-preview=login" }} /></div>
  if (previewMode === 'login') return <LoginScreen busy={false} message="" onSubmit={() => undefined} />
  if (previewMode === 'loading') return <LoadingScreen />
  if (previewMode) return <UiPreview mode={previewMode} />
  const mapPreview = previewEnabled ? Number(new URLSearchParams(location.search).get('map')) : 0
  if (mapPreview > 0) return <MapPreview mapId={mapPreview} />

  let content
  if (screen === 'login') content = <LoginScreen busy={busy} message={message} onSubmit={login} />
  else if (screen === 'servers') content = <ServerScreen account={account} servers={servers} selected={selectedServerId} busy={busy} message={message} onSelect={setSelectedServerId} onPlay={() => chooseServer()} onCreate={() => chooseServer('creation')} />
  else if (screen === 'characters') content = <CharacterScreen server={server} characters={characters} selected={selectedCharacterId} busy={busy} message={message} onSelect={setSelectedCharacterId} onCreate={() => { setMessage(''); setScreen('creation') }} onPlay={enterWorld} onChangeServer={changeServer} />
  else if (screen === 'creation' && catalog) content = <CreationScreen server={server} catalog={catalog} value={creation} busy={busy} message={message} onChange={setCreation} onBack={() => setScreen('characters')} onCreate={createCharacter} onChangeServer={changeServer} />
  else if (screen === 'world' && session) content = <WorldView session={session} client={client} message={message} onMessage={setMessage} onSession={setSession} />
  else content = <LoadingScreen />
  return <>{content}{message && screen !== 'login' && <div className="app-error-banner" role="alert">{message}</div>}{account && screen !== 'login' && <AuthenticatedChrome key={screen} account={account} character={session?.character ?? characters.find((item) => item.id === selectedCharacterId)} screen={screen} busy={busy} onChangeCharacter={changeCharacter} onChangeServer={changeServer} onLogout={logout} />}<SessionLogViewer /></>
}

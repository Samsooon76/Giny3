import { useEffect, useState } from 'react'
import type { CreationCatalog } from '../../giny/types'
import { AuthenticatedChrome } from './AuthenticatedChrome'
import { CharacterScreen } from './CharacterScreen'
import { CreationScreen } from './CreationScreen'
import { ServerScreen } from './ServerScreen'
import { PREVIEW_ACCOUNT, PREVIEW_CHARACTER, PREVIEW_SERVER } from './previewData'
import { INITIAL_CREATION, type CreationState, type Screen } from './types'

export function UiPreview({ mode }: { mode: string }) {
  const [catalog, setCatalog] = useState<CreationCatalog | null>(null)
  const [creation, setCreation] = useState<CreationState>({ ...INITIAL_CREATION, name: 'Hugo' })
  const [previewScreen, setPreviewScreen] = useState<Screen>(mode === 'creation' ? 'creation' : mode === 'characters' ? 'characters' : 'servers')
  useEffect(() => { void fetch('/game-data/client/creation_catalog.json').then((response) => response.json()).then(setCatalog) }, [])
  const params = new URLSearchParams(location.search)
  const previewOffline = params.get('server-status') === 'offline'
  const portraitCount = Math.max(0, Math.min(5, Number(params.get('character-count') ?? 1) || 0))
  const previewServer = { ...PREVIEW_SERVER, status: previewOffline ? 'Offline' : 'Online', selectable: !previewOffline,
    charactersCount: portraitCount, characters: Array.from({ length: portraitCount }, (_, index) => ({ ...PREVIEW_CHARACTER, id: index + 1, name: index ? `Personnage ${index + 1}` : PREVIEW_CHARACTER.name })) }
  const noop = () => undefined
  let content
  if (previewScreen === 'characters') {
    content = <CharacterScreen server={PREVIEW_SERVER} characters={[PREVIEW_CHARACTER]} selected={1} busy={false} message="" onSelect={noop} onCreate={() => setPreviewScreen('creation')} onPlay={noop} onChangeServer={() => setPreviewScreen('servers')} />
  } else if (previewScreen === 'creation' && catalog) {
    content = <CreationScreen server={PREVIEW_SERVER} catalog={catalog} value={creation} busy={false} message="" onChange={setCreation} onBack={() => setPreviewScreen('characters')} onCreate={() => setPreviewScreen('characters')} onChangeServer={() => setPreviewScreen('servers')} />
  } else if (previewScreen === 'creation') content = <div className="loading-screen">Chargement…</div>
  else content = <ServerScreen account={PREVIEW_ACCOUNT} servers={[previewServer]} selected={50} busy={false} message="" onSelect={noop} onPlay={() => setPreviewScreen('characters')} onCreate={() => setPreviewScreen('creation')} />
  return <>
    {content}
    <div className="app-error-banner" style={{ top: 'auto', bottom: 4, fontSize: 10, padding: '3px 8px', pointerEvents: 'none', opacity: .7, border: '1px solid #eab308', color: '#fef08a', background: '#251c07f2' }}>
      Mode Aperçu UI fictif (?ui-preview={mode}) — Déconnecté du serveur Giny
    </div>
    <AuthenticatedChrome account={PREVIEW_ACCOUNT} character={PREVIEW_CHARACTER} screen={previewScreen} busy={false} onChangeCharacter={() => setPreviewScreen('characters')} onChangeServer={() => setPreviewScreen('servers')} onLogout={noop} />
  </>
}

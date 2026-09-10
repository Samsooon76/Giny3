import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { formatInspectDump, hitOfficialNode, inspectEnabled, inspectPayload, type InspectPayload } from './inspector'
import './official.css'

/** Hover inspector for the official UI tree.

    Enabled with `?ui-inspect=1` or Alt+Shift+I in dev. Click pins a node;
    Escape unpins, then disables. The overlay is a second React root so every
    preview route (HUD, login, world) gets it without threading props. */
export function useUiInspector() {
  useEffect(() => {
    if (!import.meta.env.DEV) return
    return installUiInspector()
  }, [])
}

export function installUiInspector(): () => void {
  const host = document.createElement('div')
  host.id = 'giny-ui-inspector-host'
  document.body.appendChild(host)
  const root = createRoot(host)
  root.render(<InspectorApp />)
  let disposed = false
  return () => {
    // React may run this passive-effect cleanup while the parent root is still
    // committing (notably under StrictMode). Unmounting the inspector root
    // synchronously in that phase triggers React's nested-root warning.
    queueMicrotask(() => {
      if (disposed) return
      disposed = true
      root.unmount()
      host.remove()
      document.documentElement.classList.remove('ui-inspecting')
      delete window.__uiInspect
    })
  }
}

function InspectorApp() {
  const [enabled, setEnabled] = useState(() => inspectEnabled())
  const [hover, setHover] = useState<InspectPayload | null>(null)
  const [pin, setPin] = useState<InspectPayload | null>(null)

  useEffect(() => {
    window.__uiInspect = {
      enabled: () => enabled,
      payload: () => pin ?? hover,
      dump: () => {
        const current = pin ?? hover
        return current ? formatInspectDump(current) : ''
      },
    }
    return () => { delete window.__uiInspect }
  }, [enabled, hover, pin])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'i') {
        event.preventDefault()
        setEnabled((value) => !value)
        setPin(null)
        setHover(null)
        return
      }
      if (event.key !== 'Escape' || !enabled) return
      if (pin) { setPin(null); return }
      setEnabled(false)
      setHover(null)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [enabled, pin])

  useEffect(() => {
    document.documentElement.classList.toggle('ui-inspecting', enabled)
    if (!enabled) return
    const fromEvent = (event: Event) => {
      const target = event.target
      if (target instanceof Element && target.closest('#giny-ui-inspector-host')) return null
      return hitOfficialNode(target)
    }
    const onMove = (event: PointerEvent) => {
      const node = fromEvent(event)
      setHover(node ? inspectPayload(node) : null)
    }
    const onClick = (event: PointerEvent) => {
      if (event.button !== 0) return
      const node = fromEvent(event)
      if (!node) return
      event.preventDefault()
      event.stopPropagation()
      setPin(inspectPayload(node))
    }
    addEventListener('pointermove', onMove, true)
    addEventListener('click', onClick, true)
    return () => {
      removeEventListener('pointermove', onMove, true)
      removeEventListener('click', onClick, true)
    }
  }, [enabled])

  if (!enabled) return null
  const active = pin ?? hover
  return <>
    {hover && <div className="ui-inspect-outline" style={box(hover.rect)} />}
    {pin && <div className="ui-inspect-outline is-pinned" style={box(pin.rect)} />}
    <aside className="ui-inspect-panel">
      <header>
        <strong>UI inspect</strong>
        <span>clic pour figer · Esc · Alt+Shift+I</span>
      </header>
      {active ? <InspectBody payload={active} pinned={Boolean(pin)} /> : <p className="ui-inspect-empty">Survole un élément extrait.</p>}
    </aside>
  </>
}

function InspectBody({ payload, pinned }: { payload: InspectPayload; pinned: boolean }) {
  const dump = formatInspectDump(payload)
  const copy = () => { void navigator.clipboard.writeText(dump) }
  return <>
    <dl>
      <dt>chemin</dt>
      <dd className="ui-inspect-path">{payload.path || '—'}</dd>
      <dt>source</dt>
      <dd>{payload.tree ? `${payload.tree}.uxml` : '—'}</dd>
      <dt>type</dt>
      <dd>{payload.fullType || payload.type || '—'}</dd>
      <dt>giny</dt>
      <dd>{payload.giny || '—'}{pinned ? ' · figé' : ''}</dd>
      <dt>id</dt>
      <dd>{payload.id || '—'}</dd>
      <dt>box</dt>
      <dd>{payload.box.w}×{payload.box.h} @ {payload.box.x},{payload.box.y}</dd>
      <dt>sprite</dt>
      <dd>{payload.sprite || payload.paint || '—'}</dd>
      {payload.slice ? <><dt>slice</dt><dd>{payload.slice}</dd></> : null}
      {payload.classes.length > 0 && <><dt>classes</dt><dd>{payload.classes.join(' ')}</dd></>}
      {payload.host && <>
        <dt>hôte</dt>
        <dd>{payload.host.path} · {payload.host.giny} · {payload.host.fullType || payload.host.type}</dd>
      </>}
    </dl>
    <button type="button" className="ui-inspect-copy" onClick={copy}>copier le dump</button>
  </>
}

function box(rect: InspectPayload['rect']) {
  return { left: rect.x, top: rect.y, width: rect.w, height: rect.h }
}

declare global {
  interface Window {
    __uiInspect?: {
      enabled: () => boolean
      payload: () => InspectPayload | null
      dump: () => string
    }
  }
}

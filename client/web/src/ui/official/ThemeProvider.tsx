import { useLayoutEffect, useSyncExternalStore } from 'react'
import { UI_THEMES, themeStore } from './themeStore'
import { applyUitkEffects } from './uitk'
import './themeOverrides.css'

export function ThemeProvider() {
  const id = useSyncExternalStore(themeStore.subscribe, themeStore.snapshot, themeStore.snapshot)
  const theme = UI_THEMES.find(entry => entry.id === id)!
  const tokens = Object.entries(theme.tokens).map(([key, value]) => `${key}:${value} !important;`).join('')
  useLayoutEffect(() => {
    document.documentElement.dataset.uiTheme = id
    applyUitkEffects(document)
  }, [id])
  return <style>{`html:root,html .uitk-root,html .official-canvas,html .official-tree-host{${tokens}--header_ornament:url("${theme.ornament}") !important;}`}</style>
}

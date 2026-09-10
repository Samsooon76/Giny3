/**
 * "Everything comes from this machine" policy for the Electron shell.
 *
 * Maps, gfx, entity looks, props and the whole UI are extracted from the
 * installed Dofus client and served by the `app://` protocol, and the game
 * itself speaks to Auth/World over the IPC bridge in the main process. So the
 * renderer never has a reason to open a connection to the outside world: a
 * remote request means a forgotten absolute URL or an asset that escaped the
 * extractor, not a fallback source of data. main.mjs cancels those instead of
 * letting them silently succeed and download game content.
 */

/** Schemes that can only ever reach local content. */
const LOCAL_SCHEMES = new Set(['app:', 'file:', 'data:', 'blob:', 'devtools:', 'chrome-extension:'])

/** Schemes that leave the process — allowed on loopback only, and only in dev. */
const NETWORK_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:'])

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/**
 * Whether a renderer request stays on this machine.
 *
 * `allowLoopback` is the `GINY_VITE_URL` case: the renderer is served by the
 * vite dev server, so http/ws to 127.0.0.1 is the app itself. Without it the
 * renderer lives entirely under `app://` and nothing HTTP is legitimate.
 */
export function isLocalRequest(rawUrl, { allowLoopback = false } = {}) {
  let url
  try {
    url = new URL(String(rawUrl))
  } catch {
    return false
  }
  if (LOCAL_SCHEMES.has(url.protocol)) return true
  if (NETWORK_SCHEMES.has(url.protocol)) return allowLoopback && LOOPBACK_HOSTS.has(url.hostname)
  return false
}

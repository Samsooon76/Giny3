// Pixi workers may turn /dofus3/x into app://dofus3/x. DOM images normally
// retain the renderer host: app://-/dofus3/x. Serve the same bundled file.
const STATIC_HOSTS = new Set(['dofus3', 'combat-assets', 'assets', 'bubble'])
export function staticRequestPath(url) {
  if (STATIC_HOSTS.has(url.hostname)) return `${url.hostname}${decodeURIComponent(url.pathname)}`
  if (url.hostname !== '-') return null
  const pathname = decodeURIComponent(url.pathname)
  return pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
}

import { app, BrowserWindow, ipcMain, protocol, session, shell } from 'electron'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import zlib from 'node:zlib'
import { Readable, pipeline } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { isLocalRequest } from './localOnly.mjs'
import { runtimeCatalogRoot } from '../server/runtimeCatalogRoot.mjs'
import { createBubbleAssets, validBubbleKey } from '../server/bubbleMap3Assets.mjs'
import { fileResponse } from '../server/fileResponse.mjs'
import { staticRequestPath } from './staticRequestPath.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUNTIME_CATALOG_ROOT = runtimeCatalogRoot(path.resolve(__dirname, '../../..'))

// Same roots and environment contract as vite.config.ts: the dev server stays
// the canonical implementation, this shell replays it without HTTP.
const DATA_CANDIDATES = process.env.GINY_DATA_ROOT ? [path.resolve(process.env.GINY_DATA_ROOT)] : [
  path.join(process.resourcesPath, 'runtime-assets/catalog'),
  path.resolve(__dirname, '../runtime-assets/catalog'),
]
const UI_ROOT = path.resolve(__dirname, '../runtime-assets/ui')
if (RUNTIME_CATALOG_ROOT) DATA_CANDIDATES.unshift(RUNTIME_CATALOG_ROOT)
const UITK_ROOT = path.resolve(__dirname, '../runtime-assets/uitk')
const DIST_ROOT = process.env.GINY_DIST_ROOT ? path.resolve(process.env.GINY_DIST_ROOT) : path.resolve(__dirname, '../dist')
const AUTH_HOST = process.env.GINY_AUTH_HOST ?? '127.0.0.1'
const AUTH_PORT = Number(process.env.GINY_AUTH_PORT ?? 8443)
const WORLD_PORT = Number(process.env.GINY_WORLD_PORT ?? 5555)

// Attach to a running `npm run dev` only when explicitly asked; otherwise the
// shell always serves the built renderer, dev included.
const VITE_DEV_SERVER_URL = process.env.GINY_VITE_URL || undefined


const FILE_MIME = {
  '.wasm': 'application/wasm',
  '.avif': 'image/avif',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const resolvedFileCache = new Map()

/** Mirror of cachePlugin's per-request root probe and path guard. */
function resolveDataFile(prefix, roots) {
  const relative = decodeURIComponent(prefix).replace(/^\/+/, '')
  if (!relative || relative.includes('\0') || relative.includes('\\')) return {}
  const cacheKey = `${roots.join('|')}::${relative}`
  const cached = resolvedFileCache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached
  if (cached) resolvedFileCache.delete(cacheKey)
  if (resolvedFileCache.size >= 4096) resolvedFileCache.delete(resolvedFileCache.keys().next().value)
  const segments = relative.split('/')
  if (segments.some((segment) => segment === '..' || segment === '')) return {}
  let forbidden = false
  for (const root of roots) {
    const candidate = path.resolve(root, relative)
    if (!candidate.startsWith(root + path.sep) && candidate !== root) {
      forbidden = true
      continue
    }
    try {
      if (fs.statSync(candidate).isFile()) {
        const hit = { file: candidate, expires: Date.now() + 1000 }
        resolvedFileCache.set(cacheKey, hit)
        return hit
      }
    } catch {
      /* missing */
    }
    // Big extractor JSONs are stored gzipped at rest; resolveDataFile callers
    // decompress transparently so clients keep fetching plain .json paths.
    const gz = `${candidate}.gz`
    try {
      if (fs.statSync(gz).isFile()) {
        const hit = { file: gz, gzipped: true, expires: Date.now() + 1000 }
        resolvedFileCache.set(cacheKey, hit)
        return hit
      }
    } catch {
      /* missing */
    }
  }
  return { forbidden }
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
])

const APP_DATA_MOUNTS = [
  { name: 'game-data', roots: DATA_CANDIDATES },
  { name: 'ui-data', roots: [UI_ROOT] },
  { name: 'uitk', roots: [UITK_ROOT] },
]

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' }

// Renderer-side half of the local-only policy (see electron/localOnly.mjs):
// every scheme the app legitimately uses is a local one, so allowing `app:`,
// `blob:` (Pixi's texture workers) and `data:` and nothing else means no remote
// origin can be reached even before onBeforeRequest gets a say.
//
// `unsafe-eval` and `unsafe-inline` are required, not sloppiness: Pixi builds
// its shader and uniform-sync code with the Function constructor (it aliases
// `Function`, so grepping the bundle for `new Function(` finds nothing) and
// dies with "Current environment does not allow unsafe-eval" the moment the
// world view mounts. Neither token can reach the network, so dropping them
// buys nothing here — what keeps game data on this machine is the scheme list
// above plus enforceLocalOnly(). Electron logs an "Insecure CSP" warning about
// `unsafe-eval`; that warning is about XSS, not downloads.
const CSP_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self' app: blob: data: 'unsafe-inline' 'unsafe-eval'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; '),
}

/**
 * Map an `app://` request onto a data-root file.
 *
 * Chromium treats custom schemes as standard URLs, so a worker fetch of
 * `/game-data/gfx/x.png` becomes `app://game-data/gfx/x.png` (hostname
 * `game-data`, pathname `/gfx/x.png`) instead of `app://-/game-data/gfx/x.png`.
 * Both shapes have to resolve to the same file or Pixi never paints the map.
 */
function resolveAppRequest(requestUrl) {
  const url = new URL(requestUrl)
  const host = url.hostname
  const pathname = decodeURIComponent(url.pathname)
  for (const mount of APP_DATA_MOUNTS) {
    if (host === mount.name) {
      return resolveDataFile(pathname, mount.roots)
    }
    const prefix = `/${mount.name}/`
    if (pathname.startsWith(prefix)) {
      return resolveDataFile(pathname.slice(prefix.length), mount.roots)
    }
  }
  if (host === 'game-data' || host === 'ui-data' || host === 'uitk') {
    return {}
  }
  const relative = staticRequestPath(url)
  if (relative === null) return {}
  const candidate = path.resolve(DIST_ROOT, relative)
  if (candidate.startsWith(DIST_ROOT + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return { file: candidate }
  }
  return {}
}

function registerAppProtocol() {
  const bubble = createBubbleAssets(path.resolve(__dirname, '../../..'), { output: path.join(app.getPath('userData'), 'bubble/0.1.328/data'), prepared: [path.join(DIST_ROOT, 'bubble/data'), path.resolve(__dirname, '../public/bubble/data')] })
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    const bubblePath = url.hostname === 'bubble' ? url.pathname : url.pathname.startsWith('/bubble/') ? url.pathname.slice('/bubble'.length) : ''
    let resolved
    if (bubblePath.startsWith('/data/')) {
      let key
      try { key = decodeURIComponent(bubblePath.slice('/data/'.length)) } catch { return new Response(null, { status: 400 }) }
      if (!validBubbleKey(key)) return new Response(null, { status: 400 })
      try { resolved = { file: await bubble.resolve(key) } } catch (error) { return new Response(String(error), { status: 500 }) }
    } else resolved = resolveAppRequest(request.url)
    if (resolved.forbidden) return new Response('forbidden', { status: 403, headers: CORS_HEADERS })
    if (!resolved.file) return new Response('not found', { status: 404, headers: CORS_HEADERS })
    const immutable = /(?:^|[/-])[a-f0-9]{32,64}(?:\.|-)/i.test(resolved.file)
      || /[/\\]assets[/\\][^/\\]+-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(resolved.file)
    const headers = {
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Content-Type': resolved.gzipped ? 'application/json; charset=utf-8'
        : FILE_MIME[path.extname(resolved.file).toLowerCase()] ?? 'application/octet-stream',
      ...CORS_HEADERS, ...CSP_HEADERS,
    }
    try {
      if (!resolved.gzipped) return await fileResponse(resolved.file, request, headers)
      const file = await fs.promises.open(resolved.file, 'r')
      if (request.method === 'HEAD') { await file.close(); return new Response(null, { headers }) }
      const source = file.createReadStream()
      const body = resolved.gzipped ? pipeline(source, zlib.createGunzip(), () => {}) : source
      return new Response(Readable.toWeb(body), { headers })
    } catch (error) {
      if (error.code === 'ENOENT') return new Response('not found', { status: 404, headers: CORS_HEADERS })
      throw error
    }
  })
}

// --- Giny TCP ↔ IPC bridge (mirror of giny-websocket-bridge) ------------------

function attachGinyBridge() {
  // One current TCP target at a time, replaced on each connect — same lifetime
  // as the vite bridge's per-WebSocket socket. Listeners are registered once.
  let tcp = null
  const closeTcp = () => {
    const current = tcp
    tcp = null
    current?.destroy()
  }
  ipcMain.on('giny:frame', (_event, bytes) => {
    if (tcp?.writable) tcp.write(Buffer.from(bytes))
  })
  ipcMain.on('giny:close', closeTcp)
  ipcMain.on('giny:connect', (event, raw) => {
    const reply = (message) => {
      if (!event.sender.isDestroyed()) event.sender.send('giny:control', JSON.stringify(message))
    }
    let control
    try {
      control = JSON.parse(String(raw))
    } catch {
      reply({ type: 'error', message: 'Commande de passerelle invalide.' })
      return
    }
    let host, port
    if (control.type === 'connect-auth') {
      host = AUTH_HOST
      port = AUTH_PORT
    } else {
      const local = control.host === 'localhost' || control.host === '127.0.0.1'
      if (!local || control.port !== WORLD_PORT) {
        reply({ type: 'error', message: 'Destination World refusée.' })
        return
      }
      host = '127.0.0.1'
      port = WORLD_PORT
    }
    closeTcp()
    const connection = net.createConnection({ host, port })
    tcp = connection
    connection.on('connect', () => {
      if (tcp === connection) reply({ type: 'connected' })
    })
    connection.on('data', (chunk) => {
      if (tcp === connection && !event.sender.isDestroyed()) event.sender.send('giny:data', chunk)
    })
    connection.on('error', (error) => {
      if (tcp === connection) reply({ type: 'error', message: error.message })
    })
    connection.on('close', () => {
      if (tcp === connection) reply({ type: 'disconnected' })
    })
  })
}

// --- Local-only asset policy -------------------------------------------------

/**
 * Cancel every renderer request that would leave this machine.
 *
 * Maps, sprites, entity looks and the UI are all served from the extracted
 * Dofus client through `app://`, so a remote URL is a bug rather than a data
 * source (see electron/localOnly.mjs). Blocking it here makes that a hard
 * guarantee: the shell cannot download game content even if a stray absolute
 * URL slips into the renderer.
 */
function enforceLocalOnly(target) {
  // Under GINY_VITE_URL the renderer is served by the dev server, so loopback
  // http/ws is the app itself; the built shell needs neither.
  const allowLoopback = Boolean(VITE_DEV_SERVER_URL)
  target.webRequest.onBeforeRequest((details, callback) => {
    if (isLocalRequest(details.url, { allowLoopback })) {
      callback({})
      return
    }
    console.warn(`[local-only] blocked ${details.resourceType} request: ${details.url}`)
    callback({ cancel: true })
  })
}

// --- App lifecycle ------------------------------------------------------------

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    title: 'Giny',
    backgroundColor: '#1b1d2a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (VITE_DEV_SERVER_URL) void win.loadURL(VITE_DEV_SERVER_URL)
  else void win.loadURL('app://-/index.html')
}

app.whenReady().then(() => {
  enforceLocalOnly(session.defaultSession)
  registerAppProtocol()
  attachGinyBridge()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

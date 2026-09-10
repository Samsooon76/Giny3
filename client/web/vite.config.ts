import { bubbleMap3Assets } from './server/bubbleMap3Assets.mjs'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig } from 'vitest/config'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { preparedUiPlugin } from './build/preparedUi'
import { runtimeCatalogRoot } from './server/runtimeCatalogRoot.mjs'
import { WebSocketServer, type WebSocket } from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUNTIME_CATALOG_ROOT = runtimeCatalogRoot(path.resolve(__dirname, '../..'))

const DATA_CANDIDATES = process.env.GINY_DATA_ROOT ? [path.resolve(process.env.GINY_DATA_ROOT)] : [
  path.resolve(__dirname, 'runtime-assets/catalog'),
]

const UI_ROOT = path.resolve(__dirname, 'runtime-assets/ui')
const UITK_ROOT = path.resolve(__dirname, 'runtime-assets/uitk')

function resolveDataRoot(): string {
  for (const dir of DATA_CANDIDATES) {
    if (fs.existsSync(path.join(dir, 'maps', '154644.json.gz')) || fs.existsSync(path.join(dir, 'maps', '154644.json'))) {
      return dir
    }
  }
  return DATA_CANDIDATES[0]
}

const MIME: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
}

function cachePlugin(name: string, prefix: string, resolveRoots: () => string[]): Plugin {
  // Several roots can back one prefix: maps land in the runtime cache while the
  // creation catalog and spell icons stay in the extractor output. Probing one
  // root and committing to it makes whichever directory loses the probe 404,
  // so every root is tried per request instead.
  const roots = resolveRoots().map((root) => path.resolve(root))

  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url?.split('?')[0] ?? ''
    if (!url.startsWith(prefix)) {
      next()
      return
    }
    const relative = decodeURIComponent(url.slice(prefix.length))
    if (!relative || relative.includes('\0') || path.isAbsolute(relative)) {
      res.statusCode = 400
      res.end('bad path')
      return
    }
    const segments = relative.split(/[\\/]/)
    if (segments.some((segment) => segment === '..')) {
      res.statusCode = 400
      res.end('bad path')
      return
    }
    let file: string | null = null
    let forbidden = false
    let gzipped = false
    for (const root of roots) {
      const candidate = path.resolve(root, relative)
      if (!candidate.startsWith(root + path.sep) && candidate !== root) {
        forbidden = true
        continue
      }
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        file = candidate
        break
      }
      // Big extractor JSONs are stored gzipped at rest; serve them transparently
      // decompressed so clients keep fetching plain .json paths.
      const gz = `${candidate}.gz`
      if (fs.existsSync(gz) && fs.statSync(gz).isFile()) {
        file = gz
        gzipped = true
        break
      }
    }
    if (!file) {
      res.statusCode = forbidden ? 403 : 404
      res.end(forbidden ? 'forbidden' : 'not found')
      return
    }
    const ext = path.extname(gzipped ? file.slice(0, -3) : file).toLowerCase()
    res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
    res.setHeader('Cache-Control', /^optimized\/(maps|pages|entities|clips|previews)\//.test(relative) ? 'public, max-age=31536000, immutable' : 'no-store')
    if (gzipped) {
      fs.createReadStream(file).pipe(zlib.createGunzip()).pipe(res)
    } else {
      fs.createReadStream(file).pipe(res)
    }
  }

  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(handler)
  }

  return {
    name,
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

/**
 * Same local-only policy as the Electron shell (electron/localOnly.mjs), for
 * the dev/preview server.
 *
 * Maps, gfx, looks and the official UI are all served from disk by the
 * middlewares above, so the page has no business reaching another origin. The
 * dev server cannot cancel a browser request the way `session.webRequest` does,
 * so the guarantee is handed to the browser as a CSP on the document: inline
 * code and eval stay allowed (vite's HMR preamble needs them) and only
 * same-origin plus the loopback HMR socket can be fetched.
 */
function localOnlyCspPlugin(): Plugin {
  const policy = [
    "default-src 'self' blob: data: 'unsafe-inline' 'unsafe-eval'",
    "connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')

  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((req, res, next) => {
      // Only the document carries the policy; the asset responses inherit it.
      if (req.headers.accept?.includes('text/html')) {
        res.setHeader('Content-Security-Policy', policy)
      }
      next()
    })
  }

  return { name: 'giny-local-only-csp', configureServer: attach, configurePreviewServer: attach }
}

type BridgeControl = { type: 'connect-auth' } | { type: 'connect-world'; host: string; port: number }

function ginyBridgePlugin(): Plugin {
  const authHost = process.env.GINY_AUTH_HOST ?? '127.0.0.1'
  const authPort = Number(process.env.GINY_AUTH_PORT ?? 8443)
  const worldPort = Number(process.env.GINY_WORLD_PORT ?? 5555)

  const attach = (server: ViteDevServer | PreviewServer) => {
    const httpServer = server.httpServer
    if (!httpServer) return
    const bridge = new WebSocketServer({ noServer: true })
    httpServer.on('upgrade', (request, socket, head) => {
      if (request.url !== '/giny') return
      bridge.handleUpgrade(request, socket, head, (webSocket) => bridge.emit('connection', webSocket))
    })
    bridge.on('connection', (webSocket: WebSocket) => {
      let tcp: net.Socket | null = null
      const closeTcp = () => {
        tcp?.destroy()
        tcp = null
      }
      const connect = (host: string, port: number) => {
        closeTcp()
        const connection = net.createConnection({ host, port })
        tcp = connection
        connection.on('connect', () => webSocket.send(JSON.stringify({ type: 'connected' })))
        connection.on('data', (chunk) => webSocket.send(chunk, { binary: true }))
        connection.on('error', (error) => {
          if (tcp === connection) webSocket.send(JSON.stringify({ type: 'error', message: error.message }))
        })
        connection.on('close', () => {
          if (tcp === connection && webSocket.readyState === webSocket.OPEN) {
            webSocket.send(JSON.stringify({ type: 'disconnected' }))
          }
        })
      }
      webSocket.on('message', (data, binary) => {
        if (binary) {
          if (tcp?.writable) tcp.write(data as Buffer)
          return
        }
        try {
          const control = JSON.parse(data.toString()) as BridgeControl
          if (control.type === 'connect-auth') connect(authHost, authPort)
          if (control.type === 'connect-world') {
            const localHost = control.host === 'localhost' || control.host === '127.0.0.1'
            if (!localHost || control.port !== worldPort) {
              webSocket.send(JSON.stringify({ type: 'error', message: 'Destination World refusée.' }))
              return
            }
            connect('127.0.0.1', worldPort)
          }
        } catch {
          webSocket.send(JSON.stringify({ type: 'error', message: 'Commande de passerelle invalide.' }))
        }
      })
      webSocket.on('close', closeTcp)
    })
  }
  return { name: 'giny-websocket-bridge', configureServer: attach, configurePreviewServer: attach }
}


export default defineConfig({
  plugins: [
    bubbleMap3Assets(path.resolve(__dirname, '../..')),
    react(),
    preparedUiPlugin(path.join(UI_ROOT, 'trees')),
    localOnlyCspPlugin(),
    cachePlugin('giny-game-data', '/game-data/', () => RUNTIME_CATALOG_ROOT ? [RUNTIME_CATALOG_ROOT, ...DATA_CANDIDATES] : [resolveDataRoot(), ...DATA_CANDIDATES]),
    cachePlugin('giny-ui-data', '/ui-data/', () => [UI_ROOT]),
    cachePlugin('giny-uitk', '/uitk/', () => [UITK_ROOT]),
    ginyBridgePlugin(),
  ],
  server: {
    watch: { ignored: ['**/runtime-assets/**', '**/dist-benchmark/**', '**/game-data/**', '**/game-data.staging/**'] },
    // The harness assigns a free port through PORT when 5173 is already taken
    // by another dev server; 5173 stays the default everyone types by hand.
    port: Number(process.env.PORT) || 5173,
    fs: {
      allow: [path.resolve(__dirname, '..'), ...DATA_CANDIDATES],
    },
  },
  build: { rollupOptions: { input: { main: path.resolve(__dirname, 'index.html') } } },
  test: {
    exclude: ['server/*.test.mjs', '**/node_modules/**', '**/dist/**', '**/dist-benchmark/**', '**/e2e/**', '**/game-data/**', '**/game-data.staging/**'],
  },
})

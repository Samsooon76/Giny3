import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'
import { prepared } from '../src/ui/official/treePrep'
import type { VisualTreeNode } from '../src/ui/official/types'

/** Compile immutable document adaptations on the host, before browser mounting. */
export function preparedUiPlugin(root: string): Plugin {
  const virtualId = 'virtual:giny-prepared-ui'
  const resolvedId = `\0${virtualId}`
  let assets: Map<string, string> | undefined
  let routes: Record<string, string> = {}
  function compile() {
    if (assets) return
    const output = new Map<string, string>()
    const names: Record<string, string> = {}
    for (const name of fs.readdirSync(root).filter(name => name.endsWith('.json')).sort()) {
      const node = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')) as VisualTreeNode
      const body = JSON.stringify(prepared(node))
      const hash = createHash('sha256').update(body).digest('hex')
      const file = `ui-prepared/${hash}.json`
      output.set(file, body)
      names[name.slice(0, -5)] = `/${file}`
    }
    assets = output
    routes = names
  }
  return {
    name: 'giny-prepared-ui',
    buildStart() { compile() },
    resolveId(id) { if (id === virtualId) return resolvedId },
    load(id) {
      if (id !== resolvedId) return
      compile()
      return `export default ${JSON.stringify(routes)}`
    },
    generateBundle() {
      compile()
      for (const [fileName, source] of assets!) this.emitFile({ type: 'asset', fileName, source })
    },
    configureServer(server) {
      server.watcher.add(root)
      server.watcher.on('all', (event, file) => {
        if (file.startsWith(root + path.sep) && ['add', 'change', 'unlink'].includes(event)) void server.restart()
      })
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!url.startsWith('/ui-prepared/')) return next()
        compile()
        const body = assets!.get(url.slice(1))
        if (body === undefined) { res.statusCode = 404; res.end('Prepared UI missing'); return }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        res.end(body)
      })
    },
  }
}

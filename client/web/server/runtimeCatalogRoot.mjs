import fs from 'node:fs'
import path from 'node:path'

/** Only a published Giny runtime export may override the visual asset roots. */
export function runtimeCatalogRoot(projectRoot, override = process.env.GINY_RUNTIME_CATALOG_ROOT) {
  const pointer = path.join(projectRoot, '.local/catalog/active-runtime.json')
  if (!override && !fs.existsSync(pointer)) return null
  const publication = override ? { clientExport: override } : JSON.parse(fs.readFileSync(pointer, 'utf8'))
  const root = path.resolve(publication.clientExport)
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
  if (manifest.format !== 'giny.runtime-catalog.v1' || manifest.origin !== 'giny-sql' ||
      !manifest.catalogVersion || (publication.catalogVersion && publication.catalogVersion !== manifest.catalogVersion)) {
    throw new Error('Le catalogue publié ne correspond pas à la version Giny préparée.')
  }
  return root
}

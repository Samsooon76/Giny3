import { gameDataUrl } from '../../data/assetUrl'
import { TaskQueue, type LoadOptions } from '../assets/TaskQueue'
import { adaptEntityDocument } from './adapter'
import { parseEntityJson } from './parseEntityJson'

// Keep fallback I/O and decoding bounded too; the prepared path has its own queue.
const legacyDocuments = new TaskQueue(4)
export function readLegacyEntityDocument(relative: string, options: LoadOptions = {}) {
  return legacyDocuments.run(async () => {
    const response = await fetch(gameDataUrl(relative), { cache: 'no-store', signal: options.signal })
    if (!response.ok) return null
    return adaptEntityDocument(parseEntityJson(await response.text()))
  }, options)
}

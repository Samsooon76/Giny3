import { decodeBC7 } from './bc7'
const controllers = new Map<number, AbortController>()
self.onmessage = async (event: MessageEvent<{ id: number; url?: string; cancel?: boolean }>) => {
  const { id, url, cancel } = event.data
  if (cancel) { controllers.get(id)?.abort(); return }
  if (!url) return
  const controller = new AbortController(); controllers.set(id, controller)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`KTX2 HTTP ${response.status}`)
    const result = decodeBC7(await response.arrayBuffer())
    self.postMessage({ id, ...result }, { transfer: [result.blocks.buffer] })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  } finally { controllers.delete(id) }
}

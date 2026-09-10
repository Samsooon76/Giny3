import { cancellable, throwIfAborted, TaskQueue, type LoadOptions } from '../game/assets/TaskQueue'
export type EnsureKind = 'map' | 'prop' | 'look'

export type EnsureResult = { ok: boolean; path?: string; error?: string }

/** Full surface of the Electron preload bridge (`electron/preload.cjs`). */
export type GinyNative = {
  ensureData(kind: EnsureKind, value: string | number): Promise<EnsureResult>
  connect(control: string): void
  sendFrame(bytes: Uint8Array): void
  close(): void
  onControl(callback: (text: string) => void): () => void
  onData(callback: (bytes: Uint8Array) => void): () => void
}

declare global {
  interface Window {
    ginyNative?: GinyNative
  }
}

/** Ask for a game-data file to exist, extracting it if needed.

    Electron shell: a direct IPC invoke of the main-process extractor. Browser /
    vite dev: the HTTP `ensure-data` endpoint. Both return the same shape. */
const extractionQueue = new TaskQueue(1)
export async function ensureData(kind: EnsureKind, value: string | number, signal?: AbortSignal, options: LoadOptions = {}): Promise<EnsureResult> {
  throwIfAborted(signal)
  return cancellable(extractionQueue.run(async () => {
  // Extraction jobs keep their slot until completion on both transports.
  // Disconnecting HTTP does not terminate the server-side extractor.
  if (window.ginyNative) return window.ginyNative.ensureData(kind, value)
  const response = await fetch('/ensure-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, value }),
  })
  const result = await response.json().catch(() => ({})) as EnsureResult
  return { ok: response.ok && result.ok !== false, path: result.path, error: result.error }
  }, { ...options, signal }), signal)
}

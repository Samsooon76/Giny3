import type { GinyNative } from '../data/ensureData'
import { logEvent } from '../debug/sessionLogger'

/** The slice of the WebSocket API GinyClient relies on.

    Two carriers implement it: the vite WebSocket bridge (`/giny`) and, under
    the Electron shell, IPC events bridged to a TCP socket in the main process.
    Byte payloads travel as `Uint8Array` in both, control messages as JSON
    strings, so the client's frame codec is untouched. */
export type GinyTransport = {
  send(data: string | Uint8Array): void
  close(): void
  isOpen(): boolean
  onMessage(handler: (data: string | Uint8Array) => void): void
  onClose(handler: (error: Error) => void): void
}

declare global {
  interface Window {
    ginyNative?: GinyNative
  }
}

/** Electron IPC carrier. Auth hangs up after SelectedServerData so the client
    can switch the same bridge onto World; that TCP `disconnected` is not the
    gateway dying, and closing here is what blocked the World ticket. */
function nativeTransport(native: GinyNative): GinyTransport {
  let open = true
  const messages = new Set<(data: string | Uint8Array) => void>()
  const closers = new Set<(error: Error) => void>()
  const stopControl = native.onControl((text) => messages.forEach((handler) => handler(text)))
  const stopData = native.onData((bytes) => messages.forEach((handler) => handler(bytes)))
  return {
    send: (data) => {
      if (typeof data === 'string') native.connect(data)
      else native.sendFrame(data)
    },
    close: () => {
      if (!open) return
      open = false
      stopControl()
      stopData()
      native.close()
    },
    isOpen: () => open,
    onMessage: (handler) => messages.add(handler),
    onClose: (handler) => closers.add(handler),
  }
}

function websocketTransport(): Promise<GinyTransport> {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const socket = new WebSocket(`${protocol}://${location.host}/giny`)
  socket.binaryType = 'arraybuffer'
  logEvent('network', 'gateway-connecting', `${protocol}://${location.host}/giny`)
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {
      logEvent('network', 'gateway-open')
      resolve({
      send: (data) => {
        if (typeof data === 'string') socket.send(data)
        else socket.send(new Uint8Array(data).buffer)
      },
      close: () => socket.close(),
      isOpen: () => socket.readyState === WebSocket.OPEN,
      onMessage: (handler) => socket.addEventListener('message', (event) => {
        handler(typeof event.data === 'string'
          ? event.data
          : new Uint8Array(event.data as ArrayBuffer))
      }),
      onClose: (handler) => socket.addEventListener('close', () => {
        logEvent('network', 'gateway-close', 'Connexion à la passerelle Giny interrompue.')
        handler(new Error('Connexion à la passerelle Giny interrompue.'))
      }),
    })
    }, { once: true })
    socket.addEventListener('error', () => {
      logEvent('error', 'gateway-error', 'Passerelle WebSocket Giny indisponible.')
      reject(new Error('Passerelle WebSocket Giny indisponible.'))
    }, { once: true })
  })
}

export async function openGinyTransport(): Promise<GinyTransport> {
  if (window.ginyNative) return nativeTransport(window.ginyNative)
  return websocketTransport()
}

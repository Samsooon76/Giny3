const { contextBridge, ipcRenderer } = require('electron')

/** Renderer-facing surface of the Electron shell. The renderer feature-detects
    `window.ginyNative`; when absent (vite dev, tests, plain browser) it falls
    back to the WebSocket bridge and HTTP ensure-data. */
contextBridge.exposeInMainWorld('ginyNative', {
  ensureData: (kind, value) => ipcRenderer.invoke('ensure-data', { kind, value }),
  connect: (control) => ipcRenderer.send('giny:connect', control),
  sendFrame: (bytes) => ipcRenderer.send('giny:frame', bytes),
  close: () => ipcRenderer.send('giny:close'),
  onControl: (callback) => {
    const listener = (_event, text) => callback(text)
    ipcRenderer.on('giny:control', listener)
    return () => ipcRenderer.removeListener('giny:control', listener)
  },
  onData: (callback) => {
    const listener = (_event, bytes) => callback(bytes)
    ipcRenderer.on('giny:data', listener)
    return () => ipcRenderer.removeListener('giny:data', listener)
  },
})

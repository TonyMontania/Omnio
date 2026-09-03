import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { installIpcShim } from './utils/ipc-shim'

// Fase C — install the Tauri IPC shim BEFORE React mounts so any
// `window.ipcRenderer.*` call from a child component finds a working
// router (under Tauri) or the untouched Electron preload API (under
// Electron; the shim is a no-op there). Boot delay is a single
// dynamic import on Tauri (~10ms) and zero on Electron.
async function boot() {
  await installIpcShim()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

  // Use contextBridge — dev diagnostic. Only Electron's preload emits
  // this; Tauri's shim is a no-op on unknown channels, so the
  // listener stays quiet under Tauri.
  window.ipcRenderer.on('main-process-message', (_event, message) => {
    console.log(message)
  })
}

void boot()

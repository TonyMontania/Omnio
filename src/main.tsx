import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { installIpcShim } from './utils/ipc-shim'
import FolderPickerHost from './components/FolderPickerHost'

// Install the Tauri IPC shim BEFORE React mounts so any
// `window.ipcRenderer.*` call from a child component finds a working
// router (under Tauri) or the untouched Electron preload API (under
// Electron; the shim is a no-op there).
async function boot() {
  await installIpcShim()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <FolderPickerHost>
        <App />
      </FolderPickerHost>
    </React.StrictMode>,
  )

  window.ipcRenderer.on('main-process-message', (_event, message) => {
    console.log(message)
  })
}

void boot()

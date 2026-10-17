// App-drawn title bar with minimize / maximize / close, replacing the OS
// frame on Windows and Linux (decorations are off in their Tauri configs).
// It sits in normal flow at the top of `.app`, so nothing scrolls under
// it; full-screen overlays start below it via --titlebar-h.
// macOS keeps its native traffic lights, and the browser build has no
// window to control, so both render nothing.

import { useEffect, useState } from 'react'
import { usesCustomTitleBar } from '../utils/titleBar'

type TauriWindow = Awaited<ReturnType<typeof loadWindow>>

async function loadWindow() {
  const mod = await import('@tauri-apps/api/window')
  return mod.getCurrentWindow()
}

export default function TitleBar() {
  const [win, setWin] = useState<TauriWindow | null>(null)
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!usesCustomTitleBar()) return
    let unlisten: (() => void) | undefined
    let alive = true
    void (async () => {
      const w = await loadWindow()
      if (!alive) return
      setWin(w)
      setMaximized(await w.isMaximized())
      unlisten = await w.onResized(async () => setMaximized(await w.isMaximized()))
    })()
    return () => { alive = false; unlisten?.() }
  }, [])

  if (!usesCustomTitleBar()) return null

  return (
    <div className="titlebar" data-tauri-drag-region>
      <span className="titlebar-title" data-tauri-drag-region>Omnio</span>
      <div className="titlebar-controls">
        <button type="button" className="titlebar-btn" aria-label="Minimize" title="Minimize" onClick={() => void win?.minimize()}>
          <svg viewBox="0 0 10 10" aria-hidden><path d="M1 5.5h8" /></svg>
        </button>
        <button type="button" className="titlebar-btn" aria-label={maximized ? 'Restore' : 'Maximize'} title={maximized ? 'Restore' : 'Maximize'} onClick={() => void win?.toggleMaximize()}>
          {maximized
            ? <svg viewBox="0 0 10 10" aria-hidden><path d="M3 3V1.5h5.5V7H7" /><rect x="1.5" y="3" width="5.5" height="5.5" rx=".8" /></svg>
            : <svg viewBox="0 0 10 10" aria-hidden><rect x="1.5" y="1.5" width="7" height="7" rx=".9" /></svg>}
        </button>
        <button type="button" className="titlebar-btn close" aria-label="Close" title="Close" onClick={() => void win?.close()}>
          <svg viewBox="0 0 10 10" aria-hidden><path d="M2 2l6 6M8 2l-6 6" /></svg>
        </button>
      </div>
    </div>
  )
}

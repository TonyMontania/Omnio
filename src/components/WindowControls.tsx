// Minimize / maximize / close drawn by the app, living at the right end
// of the top bar (the OS frame is off on Windows and Linux). They stay
// above any open overlay so the window can always be controlled, and
// overlays keep their content below --titlebar-h so nothing sits under
// them. macOS keeps its native buttons; the browser build has no window.

import { useEffect, useState } from 'react'
import { usesCustomTitleBar } from '../utils/titleBar'
import { t } from '../i18n'

type TauriWindow = Awaited<ReturnType<typeof loadWindow>>

async function loadWindow() {
  const mod = await import('@tauri-apps/api/window')
  return mod.getCurrentWindow()
}

export default function WindowControls() {
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
    <div className="window-controls">
      <button type="button" className="window-btn" aria-label={t('Minimize')} title={t('Minimize')} onClick={() => void win?.minimize()}>
        <svg viewBox="0 0 10 10" aria-hidden><path d="M1 5.5h8" /></svg>
      </button>
      <button type="button" className="window-btn" aria-label={maximized ? t('Restore') : t('Maximize')} title={maximized ? t('Restore') : t('Maximize')} onClick={() => void win?.toggleMaximize()}>
        {maximized
          ? <svg viewBox="0 0 10 10" aria-hidden><path d="M3 3V1.5h5.5V7H7" /><rect x="1.5" y="3" width="5.5" height="5.5" rx=".8" /></svg>
          : <svg viewBox="0 0 10 10" aria-hidden><rect x="1.5" y="1.5" width="7" height="7" rx=".9" /></svg>}
      </button>
      <button type="button" className="window-btn close" aria-label={t('Close')} title={t('Close')} onClick={() => void win?.close()}>
        <svg viewBox="0 0 10 10" aria-hidden><path d="M2 2l6 6M8 2l-6 6" /></svg>
      </button>
    </div>
  )
}

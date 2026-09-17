// Renderless-ish host that exposes an imperative `pickFolder(title)`
// API through a React context, backed by the in-app FilePicker in
// folder mode. Lets any component fire off `await pickFolder(...)`
// and receive a folder path (or null on cancel) without threading
// modal state through every editor / settings pane.
//
// The pattern replaces the old
//     const dir = await window.ipcRenderer.invoke('dialog:pick-directory', 'Choose…')
// calls that used to open the OS folder picker. Callers migrate to
//     const dir = await pickFolder('Choose…')
// and instantly get the app-styled picker instead of Windows Explorer.

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import FilePicker from './FilePicker'

interface PendingRequest {
  title: string
  initialPath?: string
  resolve: (path: string | null) => void
}

interface Ctx {
  pickFolder: (title: string, initialPath?: string) => Promise<string | null>
}

const FolderPickerContext = createContext<Ctx | null>(null)

export function useFolderPicker(): Ctx {
  const ctx = useContext(FolderPickerContext)
  if (!ctx) throw new Error('useFolderPicker must be used inside <FolderPickerHost>')
  return ctx
}

export default function FolderPickerHost({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingRequest | null>(null)
  const pendingRef = useRef<PendingRequest | null>(null)

  const pickFolder = useCallback((title: string, initialPath?: string) => {
    return new Promise<string | null>((resolve) => {
      // If a picker is already open, resolve the previous one as null
      // so a re-invocation doesn't leak a hanging promise.
      const prev = pendingRef.current
      if (prev) prev.resolve(null)
      const req: PendingRequest = { title, initialPath, resolve }
      pendingRef.current = req
      setPending(req)
    })
  }, [])

  const finish = useCallback((result: string | null) => {
    const req = pendingRef.current
    if (req) req.resolve(result)
    pendingRef.current = null
    setPending(null)
  }, [])

  return (
    <FolderPickerContext.Provider value={{ pickFolder }}>
      {children}
      <FilePicker
        open={!!pending}
        title={pending?.title ?? ''}
        mode="folder"
        initialPath={pending?.initialPath}
        onCancel={() => finish(null)}
        onPickFolder={(path) => finish(path)}
      />
    </FolderPickerContext.Provider>
  )
}

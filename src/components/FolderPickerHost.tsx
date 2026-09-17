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

interface PendingFolder {
  kind: 'folder'
  title: string
  initialPath?: string
  resolve: (path: string | null) => void
}
interface PendingSave {
  kind: 'save'
  title: string
  initialPath?: string
  suggestedFilename: string
  extension: string
  resolve: (path: string | null) => void
}
interface PendingOpen {
  kind: 'open'
  title: string
  initialPath?: string
  extension?: string
  resolve: (path: string | null) => void
}
type Pending = PendingFolder | PendingSave | PendingOpen

interface Ctx {
  pickFolder: (title: string, initialPath?: string) => Promise<string | null>
  pickSaveFile: (
    title: string,
    suggestedFilename: string,
    extension: string,
    initialPath?: string,
  ) => Promise<string | null>
  pickOpenFile: (
    title: string,
    extension?: string,
    initialPath?: string,
  ) => Promise<string | null>
}

const FolderPickerContext = createContext<Ctx | null>(null)

export function useFolderPicker(): Ctx {
  const ctx = useContext(FolderPickerContext)
  if (!ctx) throw new Error('useFolderPicker must be used inside <FolderPickerHost>')
  return ctx
}

export default function FolderPickerHost({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null)

  const openWith = <T extends Pending>(req: T) => {
    const prev = pendingRef.current
    if (prev) prev.resolve(null)
    pendingRef.current = req
    setPending(req)
  }

  const pickFolder = useCallback((title: string, initialPath?: string) => {
    return new Promise<string | null>((resolve) => {
      openWith({ kind: 'folder', title, initialPath, resolve })
    })
  }, [])

  const pickSaveFile = useCallback((
    title: string,
    suggestedFilename: string,
    extension: string,
    initialPath?: string,
  ) => {
    return new Promise<string | null>((resolve) => {
      openWith({ kind: 'save', title, initialPath, suggestedFilename, extension, resolve })
    })
  }, [])

  const pickOpenFile = useCallback((
    title: string,
    extension?: string,
    initialPath?: string,
  ) => {
    return new Promise<string | null>((resolve) => {
      openWith({ kind: 'open', title, extension, initialPath, resolve })
    })
  }, [])

  const finish = useCallback((result: string | null) => {
    const req = pendingRef.current
    if (req) req.resolve(result)
    pendingRef.current = null
    setPending(null)
  }, [])

  return (
    <FolderPickerContext.Provider value={{ pickFolder, pickSaveFile, pickOpenFile }}>
      {children}
      <FilePicker
        open={!!pending}
        title={pending?.title ?? ''}
        mode={pending?.kind === 'save' ? 'save' : pending?.kind === 'open' ? 'open' : 'folder'}
        initialPath={pending?.initialPath}
        suggestedFilename={pending?.kind === 'save' ? pending.suggestedFilename : undefined}
        extension={
          pending?.kind === 'save' ? pending.extension :
          pending?.kind === 'open' ? pending.extension :
          undefined
        }
        onCancel={() => finish(null)}
        onPickFolder={(path) => finish(path)}
        onPickFile={(path) => finish(path)}
      />
    </FolderPickerContext.Provider>
  )
}

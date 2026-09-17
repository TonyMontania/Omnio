// In-app file browser — replaces the OS "Save as / Open" dialog when
// the user wants a picker that matches the app's visual language.
//
// Layout: sidebar with common locations (Home / Desktop / Downloads
// / drives on Windows) + a main pane showing the current folder's
// entries with a breadcrumb + path input above it. Two modes:
//   - `mode="save"` renders a filename input at the bottom and a
//     Save button that resolves to `<cwd>/<filename>.<ext>`.
//   - `mode="open"` renders no filename input and returns whichever
//     entry the user picks (only files that match the extension are
//     enabled).
//
// Kept intentionally single-file. The OS dialog is still available
// as a fallback for advanced flows — this picker is here to make the
// common case (drop something into a folder the user knows) look
// consistent with the rest of Omnio.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '../utils/ipc'

interface CommonLocation { name: string; path: string }
interface DirEntry { name: string; isDir: boolean; size: number }

interface Props {
  open: boolean
  title: string
  mode: 'save' | 'open'
  initialPath?: string
  suggestedFilename?: string   // save mode only
  extension?: string           // no dot; save mode filters shown files by it too
  onCancel: () => void
  onPickFolder?: (folderPath: string) => void   // save mode: fired with the resolved path
  onPickFile?: (filePath: string) => void       // open mode
}

function joinPath(folder: string, name: string): string {
  const sep = folder.includes('\\') ? '\\' : '/'
  const trimmed = folder.replace(/[\\/]+$/, '')
  return `${trimmed}${sep}${name}`
}

function safeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|\r\n]+/g, '_').replace(/\s+/g, ' ').trim()
}

export default function FilePicker({
  open, title, mode, initialPath, suggestedFilename, extension,
  onCancel, onPickFolder, onPickFile,
}: Props) {
  const [locations, setLocations] = useState<CommonLocation[]>([])
  const [cwd, setCwd] = useState<string>('')
  const [pathInput, setPathInput] = useState<string>('')
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [filename, setFilename] = useState<string>(suggestedFilename ?? '')
  const [error, setError] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [newFolderMode, setNewFolderMode] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const listRef = useRef<HTMLUListElement>(null)

  // Load common locations once when the picker opens.
  useEffect(() => {
    if (!open) return
    void invoke('fs:common-locations').then((rows) => setLocations(rows))
  }, [open])

  // Seed cwd from prop or the first common location on open.
  useEffect(() => {
    if (!open) return
    if (initialPath) setCwd(initialPath)
    else if (locations.length > 0) setCwd(locations[0].path)
  }, [open, initialPath, locations])

  // Reset the filename buffer every time the picker opens.
  useEffect(() => {
    if (!open) return
    setFilename(suggestedFilename ?? '')
    setError(null)
    setNewFolderMode(false)
  }, [open, suggestedFilename])

  // Load the listing whenever cwd changes.
  const loadListing = useCallback(async (path: string) => {
    if (!path) return
    setBusy(true)
    setError(null)
    const r = await invoke('fs:list-dir', path, showHidden)
    if (r.ok) {
      setEntries(r.entries)
      setPathInput(path)
    } else {
      setError(r.error)
      setEntries([])
    }
    setBusy(false)
  }, [showHidden])

  useEffect(() => {
    if (!open || !cwd) return
    void loadListing(cwd)
  }, [open, cwd, loadListing])

  const enter = (entry: DirEntry) => {
    if (entry.isDir) setCwd(joinPath(cwd, entry.name))
    else if (mode === 'save') setFilename(entry.name.replace(new RegExp(`\\.${extension}$`, 'i'), ''))
    else onPickFile?.(joinPath(cwd, entry.name))
  }

  const goUp = () => {
    if (!cwd) return
    void invoke('fs:path-info', cwd).then((info) => {
      if (info.parent) setCwd(info.parent)
    })
  }

  const navigateFromInput = async () => {
    const info = await invoke('fs:path-info', pathInput)
    if (info.exists && info.isDir) {
      setCwd(info.canonical)
    } else if (info.exists && !info.isDir) {
      // Landed on a file — navigate into its parent.
      if (info.parent) setCwd(info.parent)
      if (mode === 'save') setFilename(pathInput.split(/[\\/]/).pop() ?? '')
    } else {
      setError(`Path not found: ${pathInput}`)
    }
  }

  const createNewFolder = async () => {
    const name = safeFilename(newFolderName)
    if (!name) return
    const target = joinPath(cwd, name)
    const r = await invoke('fs:mkdir', target)
    if (r.ok) {
      setNewFolderMode(false)
      setNewFolderName('')
      await loadListing(cwd)
    } else {
      setError(`Could not create folder: ${(r as { ok: false; error: string }).error}`)
    }
  }

  const filteredEntries = useMemo(() => {
    if (mode !== 'open' || !extension) return entries
    return entries.filter((e) => e.isDir || e.name.toLowerCase().endsWith(`.${extension.toLowerCase()}`))
  }, [entries, mode, extension])

  if (!open) return null

  const canSave = mode === 'save' && !!cwd && !!filename.trim() && !busy
  const finalPath = mode === 'save' && cwd && filename.trim()
    ? joinPath(cwd, `${safeFilename(filename)}.${extension ?? 'txt'}`)
    : ''

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal file-picker" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onCancel} title="Close" aria-label="Close">✕</button>
        </header>

        <div className="file-picker-toolbar">
          <button
            type="button"
            className="secondary-btn compact"
            onClick={goUp}
            title="Parent folder"
            aria-label="Go up"
          >↑</button>
          <input
            className="file-picker-path"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void navigateFromInput() }}
            placeholder="Type a path and press Enter"
          />
          <button
            type="button"
            className="secondary-btn compact"
            onClick={() => setNewFolderMode(true)}
            title="Create folder in this directory"
          >+ Folder</button>
          <label className="file-picker-hidden-toggle">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            <span>Hidden</span>
          </label>
        </div>

        <div className="file-picker-body">
          <aside className="file-picker-sidebar">
            <div className="file-picker-side-heading">Quick access</div>
            <ul>
              {locations.map((loc) => (
                <li
                  key={loc.path}
                  className={cwd === loc.path ? 'active' : ''}
                  onClick={() => setCwd(loc.path)}
                  title={loc.path}
                >
                  <span className="file-picker-side-icon" aria-hidden>📁</span>
                  <span className="file-picker-side-name">{loc.name}</span>
                </li>
              ))}
            </ul>
          </aside>

          <div className="file-picker-main">
            {newFolderMode && (
              <div className="file-picker-newfolder">
                <input
                  autoFocus
                  placeholder="New folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void createNewFolder()
                    if (e.key === 'Escape') { setNewFolderMode(false); setNewFolderName('') }
                  }}
                />
                <button type="button" className="primary-btn compact" onClick={createNewFolder}>Create</button>
                <button type="button" className="secondary-btn compact" onClick={() => { setNewFolderMode(false); setNewFolderName('') }}>Cancel</button>
              </div>
            )}
            {error && <div className="file-picker-error">{error}</div>}
            {busy ? (
              <p className="hint" style={{ padding: 12 }}>Loading…</p>
            ) : (
              <ul ref={listRef} className="file-picker-list">
                {filteredEntries.length === 0 && (
                  <li className="empty">Empty folder.</li>
                )}
                {filteredEntries.map((entry) => (
                  <li
                    key={entry.name}
                    className={entry.isDir ? 'dir' : 'file'}
                    onDoubleClick={() => enter(entry)}
                    onClick={() => {
                      if (mode === 'save' && !entry.isDir) {
                        setFilename(entry.name.replace(new RegExp(`\\.${extension}$`, 'i'), ''))
                      }
                    }}
                  >
                    <span className="file-picker-entry-icon" aria-hidden>
                      {entry.isDir ? '📁' : '📄'}
                    </span>
                    <span className="file-picker-entry-name">{entry.name}</span>
                    <span className="file-picker-entry-size">
                      {entry.isDir ? '' : formatSize(entry.size)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {mode === 'save' && (
          <div className="file-picker-savebar">
            <label>Filename</label>
            <div className="file-picker-filename-row">
              <input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSave) onPickFolder?.(finalPath) }}
                placeholder="omnio-export"
              />
              <span className="file-picker-extension">.{extension ?? 'txt'}</span>
            </div>
            {finalPath && (
              <p className="hint" style={{ marginTop: 6 }}>
                Final path: <code>{finalPath}</code>
              </p>
            )}
          </div>
        )}

        <div className="file-picker-actions">
          <button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button>
          <div style={{ flex: 1 }} />
          {mode === 'save' && (
            <button
              type="button"
              className="primary-btn"
              onClick={() => onPickFolder?.(finalPath)}
              disabled={!canSave}
            >Save</button>
          )}
        </div>
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

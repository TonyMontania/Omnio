// In-app export modal — replaces the OS "Save as…" dialog when the
// user has set a default export folder in Settings. Renders the
// filename input, the destination folder as a chip, an extension
// suffix on the input, and Save / Save elsewhere / Cancel buttons.
// If the file already exists at the target path, we surface an
// inline confirm-overwrite step so the user can retry without
// closing the modal.

import { useEffect, useRef, useState } from 'react'
import { invoke } from '../utils/ipc'
import FilePicker from './FilePicker'

interface Props {
  open: boolean
  body: string
  suggestedName: string
  extension: string      // e.g. "csv" — no leading dot
  filterLabel: string    // e.g. "CSV" — used when falling back to OS dialog
  exportFolder: string | undefined
  onClose: () => void
  // Called after a successful write with the absolute final path so
  // the caller can toast + optionally reveal in explorer.
  onSaved: (path: string) => void
}

// Sanitize a candidate filename: strip path separators and characters
// the OS rejects on file creation. Keeps unicode, dots, spaces, dashes.
function safeName(name: string): string {
  return name.replace(/[/\\:*?"<>|\r\n]+/g, '_').replace(/\s+/g, ' ').trim()
}

function joinPath(folder: string, filename: string, ext: string): string {
  const cleanFolder = folder.replace(/[\\/]+$/, '')
  const cleanExt = ext.replace(/^\.+/, '')
  const stem = safeName(filename)
  const withExt = stem.toLowerCase().endsWith(`.${cleanExt.toLowerCase()}`)
    ? stem
    : `${stem}.${cleanExt}`
  // The Rust side is happy with either slash on Windows too. We
  // keep the folder's own separator to look right in the preview.
  const sep = cleanFolder.includes('\\') ? '\\' : '/'
  return `${cleanFolder}${sep}${withExt}`
}

export default function ExportModal({
  open, body, suggestedName, extension, filterLabel, exportFolder,
  onClose, onSaved,
}: Props) {
  const [filename, setFilename] = useState(suggestedName)
  const [busy, setBusy] = useState(false)
  const [existsPrompt, setExistsPrompt] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setFilename(suggestedName)
      setExistsPrompt(null)
      setErrorMsg(null)
      setTimeout(() => inputRef.current?.select(), 30)
    }
  }, [open, suggestedName])

  if (!open) return null

  const targetPath = exportFolder ? joinPath(exportFolder, filename, extension) : ''

  const doSaveTo = async (path: string, overwrite: boolean) => {
    setBusy(true)
    setErrorMsg(null)
    try {
      const r = await invoke('library:save-text-to', path, body, overwrite)
      if (r.ok) {
        onSaved(r.path)
        onClose()
        return
      }
      if (r.error === 'exists') {
        setExistsPrompt(path)
        return
      }
      setErrorMsg(r.error ?? 'unknown error')
    } finally {
      setBusy(false)
    }
  }

  const onSave = async () => {
    if (!exportFolder) return   // Save button is disabled in that state
    await doSaveTo(targetPath, false)
  }

  const onSaveElsewhere = () => setPickerOpen(true)

  const onPickerPickFolder = async (finalPath: string) => {
    setPickerOpen(false)
    await doSaveTo(finalPath, false)
  }

  const onSaveViaNativeDialog = async () => {
    setBusy(true)
    setErrorMsg(null)
    try {
      const r = await invoke('library:export-text', body, safeName(filename), filterLabel, extension)
      if (r.ok) {
        onSaved(r.path)
        onClose()
      } else if (!r.canceled) {
        setErrorMsg(r.error ?? 'unknown error')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal export-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Export</h2>
          <button className="modal-close" onClick={onClose} disabled={busy} title="Close" aria-label="Close">✕</button>
        </header>

        <div className="export-modal-body">
          <div className="field-group">
            <label>Filename</label>
            <div className="export-filename-row">
              <input
                ref={inputRef}
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !busy && exportFolder) onSave()
                }}
              />
              <span className="export-extension">.{extension}</span>
            </div>
          </div>

          <div className="field-group">
            <label>Save to</label>
            {exportFolder ? (
              <div className="export-folder-chip" title={exportFolder}>
                <span className="export-folder-icon" aria-hidden>📁</span>
                <span className="export-folder-path">{exportFolder}</span>
              </div>
            ) : (
              <p className="hint">
                No default export folder set yet. Pick one in <b>Settings → Backup, import &amp; export → Default export folder</b>, or use <b>Save elsewhere…</b> to pick per-file.
              </p>
            )}
            {exportFolder && (
              <p className="hint" style={{ marginTop: 6 }}>
                Final path: <code>{targetPath}</code>
              </p>
            )}
          </div>

          {existsPrompt && (
            <div className="export-overwrite">
              <p>A file with that name already exists here.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="secondary-btn" onClick={() => setExistsPrompt(null)} disabled={busy}>Rename</button>
                <button className="danger-btn" onClick={() => doSaveTo(existsPrompt, true)} disabled={busy}>Overwrite</button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="export-error">
              <p>Could not save: <code>{errorMsg}</code></p>
            </div>
          )}
        </div>

        <div className="export-modal-actions">
          <button className="secondary-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button className="secondary-btn" onClick={onSaveElsewhere} disabled={busy} title="Browse folders in an in-app picker">Save elsewhere…</button>
          <button className="secondary-btn" onClick={onSaveViaNativeDialog} disabled={busy} title="Use the OS Save dialog">Native dialog…</button>
          <button className="primary-btn" onClick={onSave} disabled={busy || !exportFolder || !filename.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <FilePicker
        open={pickerOpen}
        title="Save export"
        mode="save"
        initialPath={exportFolder}
        suggestedFilename={safeName(filename)}
        extension={extension}
        onCancel={() => setPickerOpen(false)}
        onPickFolder={onPickerPickFolder}
      />
    </div>
  )
}

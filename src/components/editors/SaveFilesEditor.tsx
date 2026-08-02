// Save file backup for a Game. Users upload arbitrary files (.sav, .dat,
// .zip, whatever) that get stored under assets/games/saves/<title>/.
// Uploads accumulate over time — the note per entry ("post-final boss",
// "NG+") is what makes many saves for the same game readable.

import { useRef, useState } from 'react'
import type { SaveFile } from '../../types'

type Props = {
  gameTitle: string
  categoryId: string
  saveFiles: SaveFile[]
  onChange: (next: SaveFile[]) => void
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function SaveFilesEditor({ gameTitle, categoryId, saveFiles, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const uploadFiles = async (files: FileList | File[]) => {
    if (!gameTitle.trim()) {
      setError('Give the game a title before adding save files.')
      return
    }
    setError(null)
    setBusy(true)
    const added: SaveFile[] = []
    try {
      for (const file of Array.from(files)) {
        const buf = await file.arrayBuffer()
        const res = await window.ipcRenderer.invoke(
          'save-file:save',
          categoryId,
          gameTitle.trim(),
          file.name,
          new Uint8Array(buf),
        ) as { ok: boolean; entry?: SaveFile; error?: string }
        if (res.ok && res.entry) {
          added.push(res.entry)
        } else {
          setError(res.error ?? `Failed to save ${file.name}`)
        }
      }
      if (added.length > 0) {
        // Newest first — matches the sort order used everywhere the list is shown.
        onChange([...added, ...saveFiles])
      }
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (entry: SaveFile) => {
    const ok = await window.ipcRenderer.invoke('save-file:delete', entry.path) as boolean
    if (ok) onChange(saveFiles.filter((s) => s.id !== entry.id))
  }

  const handleOpen = async (entry: SaveFile) => {
    const res = await window.ipcRenderer.invoke('save-file:open', entry.path) as { ok: boolean; error?: string }
    if (!res.ok) setError(res.error ?? 'Could not open file')
  }

  const handleReveal = async (entry: SaveFile) => {
    await window.ipcRenderer.invoke('save-file:reveal', entry.path)
  }

  const handleNoteChange = (id: string, note: string) => {
    onChange(saveFiles.map((s) => (s.id === id ? { ...s, note: note || undefined } : s)))
  }

  return (
    <div className="field-group">
      <label>Save files</label>
      <div
        className={dragOver ? 'save-files-dropzone dragover' : 'save-files-dropzone'}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false)
          if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) uploadFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <button type="button" className="save-files-add" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? 'Uploading…' : '+ Add save file(s)'}
        </button>
        <span className="save-files-hint">Any extension · drag files here · multiple accepted</span>
      </div>
      {error && <p className="save-files-error">{error}</p>}
      {saveFiles.length > 0 && (
        <ul className="save-files-list">
          {saveFiles.map((entry) => (
            <li key={entry.id} className="save-files-row">
              <div className="save-files-meta">
                <span className="save-files-name" title={entry.filename}>{entry.filename}</span>
                <span className="save-files-sub">
                  {formatBytes(entry.size)} · {formatDate(entry.addedAt)}
                </span>
              </div>
              <input
                className="save-files-note"
                placeholder="Note (post-final boss, NG+, all collectibles…)"
                value={entry.note ?? ''}
                onChange={(e) => handleNoteChange(entry.id, e.target.value)}
              />
              <div className="save-files-actions">
                <button type="button" onClick={() => handleOpen(entry)} title="Open with default app">Open</button>
                <button type="button" onClick={() => handleReveal(entry)} title="Show in file manager">Reveal</button>
                <button type="button" className="save-files-delete" onClick={() => handleDelete(entry)} title="Delete">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

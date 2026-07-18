// Lists the rotated data.json snapshots the main process writes on every
// save. The user can click one to restore it. See electron/main.ts:
// data:list-backups / data:restore-backup handlers.

import { useEffect, useState } from 'react'

interface Snapshot {
  file: string
  mtime: number
  size: number
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatWhen(ms: number): string {
  const diff = Date.now() - ms
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

export default function BackupList({ onRestore }: { onRestore: (file: string) => void }) {
  const [snaps, setSnaps] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    setLoading(true)
    window.ipcRenderer.invoke('data:list-backups').then((s: Snapshot[]) => {
      setSnaps(s ?? [])
      setLoading(false)
    })
  }

  useEffect(refresh, [])

  return (
    <div className="backup-list">
      <p className="hint" style={{ marginTop: 0 }}>
        Omnio rotates the last 5 saves next to your <code>data.json</code>. Restore any of them
        if something goes wrong — your current library gets moved to <code>data.pre-restore.json</code> first,
        so nothing is ever destroyed.
      </p>
      {loading && <p className="hint">Reading…</p>}
      {!loading && snaps.length === 0 && (
        <p className="hint">No snapshots yet — they appear after the next save.</p>
      )}
      {!loading && snaps.length > 0 && (
        <ul className="backup-list-items">
          {snaps.map((s) => (
            <li key={s.file}>
              <span className="backup-file">{s.file}</span>
              <span className="backup-when">{formatWhen(s.mtime)}</span>
              <span className="backup-size">{formatSize(s.size)}</span>
              <button type="button" className="secondary-btn small" onClick={() => onRestore(s.file)}>Restore</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="link-btn" onClick={refresh}>↻ Refresh</button>
    </div>
  )
}

// Lists the rotated data snapshots the main process keeps under
// data/backups/. Each snapshot is a full directory copy of the library
// files at that save point; restoring one puts the whole set back in
// place and shifts the current state to data.pre-restore/ first.
// See electron/main.ts: data:list-backups / data:restore-backup.

import { useEffect, useState } from 'react'

interface Snapshot {
  file: string      // 'snapshot-1' … 'snapshot-5'
  mtime: number     // ms epoch of the newest file inside the snapshot
  size: number      // total bytes across every .json in the snapshot
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// snapshot-1 → "Snapshot 1 (most recent)" · snapshot-5 → "Snapshot 5 (oldest kept)"
function labelFor(file: string): string {
  const m = /snapshot-(\d)/.exec(file)
  if (!m) return file
  const n = parseInt(m[1], 10)
  return `Snapshot ${n}`
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
        Omnio keeps the last 5 saves in <code>data/backups/</code>, one directory per snapshot.
        Restore any of them if something goes wrong — your current library gets moved to
        <code> data.pre-restore/ </code> first, so nothing is ever destroyed.
      </p>
      {loading && <p className="hint">Reading…</p>}
      {!loading && snaps.length === 0 && (
        <p className="hint">No snapshots yet — they appear after the next save.</p>
      )}
      {!loading && snaps.length > 0 && (
        <ul className="backup-list-items">
          {snaps.map((s) => (
            <li key={s.file}>
              <span className="backup-file">{labelFor(s.file)}</span>
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

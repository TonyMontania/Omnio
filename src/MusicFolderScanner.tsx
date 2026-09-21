// Local music-folder scanner. Points at a directory tree, walks it in
// Rust, and returns one row per album folder (with track count, year
// when detectable from `Album (2015)` naming, and a cover-art file
// hint). The user picks which rows to import as Music items — nothing
// hits the library until they click Import.
//
// Supported layouts (mixed within a root is OK):
//   Root/Artist/Album/track.mp3
//   Root/Artist - Album/track.mp3
//   Root/Artist - Album (Year)/track.mp3
//
// Audio detection is extension-based (mp3, flac, m4a, mp4, aac, ogg,
// opus, wav, wma). Files without a supported extension are ignored.

import { useMemo, useState } from 'react'
import type { Item } from './types'

interface Props {
  existingItems: Item[]
  onImport: (items: Item[]) => void
  onClose: () => void
}

interface ScannedAlbum {
  artist: string
  album: string
  year: string | null
  track_count: number
  folder_path: string
  cover_path: string | null
}

interface Row extends ScannedAlbum {
  key: string
  action: 'create' | 'skip'
  existingId?: string
}

function normalizeKey(artist: string, album: string): string {
  return `${artist.toLowerCase().trim()}::${album.toLowerCase().trim()}`
}

export default function MusicFolderScanner({ existingItems, onImport, onClose }: Props) {
  const [rootPath, setRootPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])

  const existingByKey = useMemo(() => {
    const m = new Map<string, Item>()
    for (const it of existingItems) {
      if (it.categoryId !== 'musica') continue
      m.set(normalizeKey(it.artist ?? '', it.title), it)
    }
    return m
  }, [existingItems])

  const pickFolder = async () => {
    // dialog:pick-directory returns the picked path as a plain string,
    // or null when the user cancels — same shape the other importers
    // consume it as.
    const picked = await window.ipcRenderer.invoke('dialog:pick-directory', 'Pick your music root folder') as string | null
    if (picked) setRootPath(picked)
  }

  const scan = async () => {
    if (!rootPath.trim()) { setError('Pick a folder first.'); return }
    setBusy(true); setError(null); setRows([])
    try {
      const r = await window.ipcRenderer.invoke('music:scan_folder', rootPath.trim()) as
        | { ok: true; albums: ScannedAlbum[] }
        | { ok: false; error: string }
      if (!r?.ok) { setError(r?.error ?? 'Scan failed'); return }
      const parsed: Row[] = r.albums.map((a) => {
        const existing = existingByKey.get(normalizeKey(a.artist, a.album))
        return {
          ...a,
          key: crypto.randomUUID(),
          existingId: existing?.id,
          action: existing ? 'skip' : 'create',
        }
      })
      setRows(parsed)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const toggle = (k: string) => setRows((rs) => rs.map((r) => r.key === k
    ? { ...r, action: r.action === 'create' ? 'skip' : 'create' }
    : r))
  const setAll = (a: 'create' | 'skip') => setRows((rs) => rs.map((r) => ({
    ...r,
    action: r.existingId ? 'skip' : a,   // never override an existing item
  })))

  const toImportCount = rows.filter((r) => r.action === 'create').length
  const dupCount = rows.filter((r) => r.existingId).length

  const handleImport = () => {
    const now = Date.now()
    const created: Item[] = []
    for (const r of rows) {
      if (r.action !== 'create') continue
      // Prefix cover path with omnio-asset scheme so the app resolves
      // it via the file:// protocol handler at render time.
      const cover = r.cover_path ? `file://${r.cover_path.replace(/\\/g, '/')}` : ''
      created.push({
        id: crypto.randomUUID(),
        categoryId: 'musica',
        title: r.album,
        artist: r.artist || undefined,
        cover,
        tags: [],
        createdAt: now,
        releaseYear: r.year ?? undefined,
      } as Item)
    }
    if (created.length > 0) onImport(created)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: '94vw', maxHeight: '86vh' }}>
        <div className="modal-header">
          <h2>Scan local music folder</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Point at a folder that holds your ripped / downloaded music. Recognized layouts:
            <br /><code>Root/Artist/Album/track.mp3</code> or <code>Root/Artist - Album (Year)/track.mp3</code>.
            Scans read filenames and folder structure — no ID3 tag parsing yet. Each detected album shows track count
            and an optional cover file (any <code>cover.jpg</code> / <code>folder.png</code> / etc. sitting next to the tracks).
          </p>

          <div className="importer-summary" style={{ marginTop: 4 }}>
            <input
              type="text"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="e.g. F:\Music\Rock"
              style={{ flex: 1, minWidth: 260 }}
            />
            <button type="button" className="secondary-btn" onClick={pickFolder}>Browse…</button>
            <button type="button" className="secondary-btn" onClick={scan} disabled={busy || !rootPath.trim()}>
              {busy ? 'Scanning…' : 'Scan'}
            </button>
          </div>

          {error && <p className="save-files-error">{error}</p>}

          {rows.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{rows.length} albums</span>
                <span className="importer-new">{toImportCount} to import</span>
                <span className="importer-dupe">{dupCount} already in library</span>
                <div className="importer-select-actions">
                  <button type="button" onClick={() => setAll('create')}>Select all new</button>
                  <button type="button" onClick={() => setAll('skip')}>Select none</button>
                </div>
              </div>
              <div className="importer-table-wrap">
                <table className="importer-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}></th>
                      <th>Album</th>
                      <th>Artist</th>
                      <th style={{ width: 60 }}>Year</th>
                      <th style={{ width: 60 }}>Tracks</th>
                      <th style={{ width: 80 }}>Cover</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key} className={r.existingId ? 'dupe' : ''}>
                        <td>
                          <input
                            type="checkbox"
                            checked={r.action === 'create'}
                            disabled={!!r.existingId}
                            onChange={() => toggle(r.key)}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{r.album || <em style={{ color: 'var(--text-faint)' }}>(no name)</em>}</div>
                          {r.existingId && <div style={{ fontSize: 10.5, color: 'var(--accent)' }}>already in library</div>}
                        </td>
                        <td>{r.artist || <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                        <td>{r.year ?? '—'}</td>
                        <td><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{r.track_count}</span></td>
                        <td>{r.cover_path ? '✓' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        {rows.length > 0 && (
          <div className="modal-footer">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="primary-btn" disabled={toImportCount === 0} onClick={handleImport}>
              Import {toImportCount} album{toImportCount === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

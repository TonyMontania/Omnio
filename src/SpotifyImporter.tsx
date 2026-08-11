// Spotify library importer → Music library.
//
// Spotify's "Download your data" export (Account → Privacy Settings)
// ships a ZIP; the important file is `YourLibrary.json` which contains
// `albums`, `artists`, `tracks`. We accept the file directly (drop into
// any archiver first).
//
// Each `albums[]` entry becomes a Music item (album). Tracks and
// standalone artists are surfaced but not imported by default because
// Omnio's Music model is album-first — a user usually wants "every
// album in my Spotify library" as their baseline; individual tracks
// live inside albums after MusicBrainz fetches the full tracklist.

import { useMemo, useState } from 'react'
import type { Item } from './types'

interface Props {
  existingItems: Item[]
  onImport: (items: Item[]) => void
  onClose: () => void
}

interface SpotifyAlbum {
  artist: string
  album: string
  uri?: string
}

interface Row {
  key: string
  title: string
  artist: string
  uri?: string
}

function keyOf(t: string, artist: string): string {
  return `${t.trim().toLowerCase()}::${artist.trim().toLowerCase()}`
}

function findExisting(existing: Item[], title: string, artist: string): Item | undefined {
  const tLc = title.trim().toLowerCase()
  const aLc = artist.trim().toLowerCase()
  return existing.find((it) => it.categoryId === 'musica'
    && it.title.trim().toLowerCase() === tLc
    && (it.artist ?? '').trim().toLowerCase() === aLc)
}

export default function SpotifyImporter({ existingItems, onImport, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setError(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as { albums?: SpotifyAlbum[] }
      const albums = parsed.albums
      if (!Array.isArray(albums)) { setError('File does not look like YourLibrary.json (missing `albums` array).'); return }
      const seen = new Set<string>()
      const rows: Row[] = []
      for (const a of albums) {
        const title = String(a.album ?? '').trim()
        const artist = String(a.artist ?? '').trim()
        if (!title || !artist) continue
        const key = keyOf(title, artist)
        if (seen.has(key)) continue
        seen.add(key)
        rows.push({ key, title, artist, uri: a.uri })
      }
      rows.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title))
      setRows(rows)
      setFileName(file.name)
      const pre = new Set<string>()
      for (const r of rows) if (!findExisting(existingItems, r.title, r.artist)) pre.add(r.key)
      setSelected(pre)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const matches = useMemo(() => {
    const m = new Map<string, Item | undefined>()
    for (const r of rows) m.set(r.key, findExisting(existingItems, r.title, r.artist))
    return m
  }, [rows, existingItems])
  const dupeCount = useMemo(() => rows.reduce((n, r) => matches.get(r.key) ? n + 1 : n, 0), [rows, matches])

  const handleImport = () => {
    const now = Date.now()
    const out: Item[] = []
    for (const r of rows) {
      if (!selected.has(r.key)) continue
      out.push({
        id: crypto.randomUUID(),
        categoryId: 'musica',
        title: r.title,
        createdAt: now,
        artist: r.artist,
        musicType: 'album',
        consumed: true,
      })
    }
    if (out.length > 0) onImport(out)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel letterboxd-importer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780, width: '94vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Import from Spotify</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Request your Spotify data at <code>spotify.com/account/privacy</code> (arrives in ~5 days).
            Extract the ZIP and drop <code>YourLibrary.json</code> here. Only saved albums are imported;
            standalone tracks / followed artists are ignored (Omnio's Music library is album-first).
          </p>
          <div className="importer-dropzone">
            <input type="file" accept=".json" style={{ display: 'none' }} id="spotify-file"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }} />
            <label htmlFor="spotify-file" className="importer-file-btn">
              {rows.length > 0 ? 'Pick different file' : '+ Pick YourLibrary.json'}
            </label>
            {fileName && <span className="importer-file-list">{fileName}</span>}
          </div>
          {error && <p className="save-files-error">{error}</p>}
          {rows.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{rows.length} albums found</span>
                <span className="importer-new">{rows.length - dupeCount} new</span>
                <span className="importer-dupe">{dupeCount} already in library</span>
                <div className="importer-select-actions">
                  <button type="button" onClick={() => setSelected(new Set(rows.filter((r) => !matches.get(r.key)).map((r) => r.key)))}>Select new only</button>
                  <button type="button" onClick={() => setSelected(new Set(rows.map((r) => r.key)))}>Select all</button>
                  <button type="button" onClick={() => setSelected(new Set())}>Select none</button>
                </div>
              </div>
              <div className="importer-table-wrap">
                <table className="importer-table">
                  <thead><tr><th style={{ width: 32 }}></th><th>Album</th><th>Artist</th><th style={{ width: 90 }}>In lib</th></tr></thead>
                  <tbody>
                    {rows.map((r) => {
                      const dupe = matches.get(r.key)
                      return (
                        <tr key={r.key} className={dupe ? 'dupe' : ''}>
                          <td><input type="checkbox" checked={selected.has(r.key)} onChange={() => toggle(r.key)} /></td>
                          <td>{r.title}</td>
                          <td>{r.artist}</td>
                          <td>{dupe ? <span className="importer-badge dupe">In lib</span> : <span className="importer-badge new">New</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        {rows.length > 0 && (
          <div className="modal-footer">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="primary-btn" disabled={selected.size === 0} onClick={handleImport}>
              Import {selected.size} album{selected.size === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

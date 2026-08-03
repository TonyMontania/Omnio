// Last.fm scrobble CSV importer → Music library.
//
// Accepts CSV files exported from third-party tools that dump a user's
// scrobbles: lastfm-to-csv, benjaminbenben's exporter, etc. The tools
// differ slightly in column order and whether they include a header, so
// we auto-detect by header name (or fall back to the most common order
// when no header is present: artist,album,track,date).
//
// Scrobbles arrive at track granularity but Omnio tracks Music at album
// granularity — so we aggregate by (artist, album), counting plays and
// picking the most recent scrobble date as the last-listened timestamp.
//
// Import flow (per aggregated album):
//   1. If the library already has a matching Music item → mark it
//      consumed=true and stamp finishedAt with the last-scrobble date
//      (only if not already set — never overwrites your own dates).
//   2. Otherwise show it as "New" so the user can choose to add it as a
//      Music item (defaults to skip: your Music library shouldn't grow
//      by accident from a scrobble history dump).
//
// Tracks without an album (Last.fm scrobbles have an empty Album field
// for singles / non-album stuff) are grouped separately at the bottom
// and always default to Skip — they'd flood the library with noise.

import { useMemo, useState } from 'react'
import type { Item } from './types'

interface Props {
  existingItems: Item[]
  onImport: (updates: { updates: Map<string, { consumed: true; finishedAt?: string }>; creates: Item[] }) => void
  onClose: () => void
}

type ScrobbleRow = {
  artist: string
  album: string
  track?: string
  date?: string       // ISO date or Unix epoch string
}

type AggAlbum = {
  key: string         // `${artistLc}::${albumLc}`
  artist: string
  album: string
  plays: number
  lastPlayed?: string // ISO date
}

// Same minimal CSV parser as LetterboxdImporter. Kept local to avoid a
// premature utils/csv.ts extraction — three sites is when I'll move it.
function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  const stripped = input.charCodeAt(0) === 0xFEFF ? input.slice(1) : input
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i]
    if (inQuotes) {
      if (ch === '"') {
        if (stripped[i + 1] === '"') { field += '"'; i++ }
        else { inQuotes = false }
      } else { field += ch }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { cur.push(field); field = '' }
      else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
      else if (ch === '\r') { /* skip */ }
      else field += ch
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur) }
  return rows.filter((r) => r.some((f) => f.length > 0))
}

// Column-index by name (case-insensitive). Returns -1 if the column isn't
// present so callers can pick a fallback strategy.
function colIndex(headers: string[], ...names: string[]): number {
  for (const n of names) {
    const idx = headers.findIndex((h) => h.trim().toLowerCase() === n.toLowerCase())
    if (idx >= 0) return idx
  }
  return -1
}

// Parses a header row and returns which column each field lives in — or
// null when the first row doesn't look like headers (all cells are just
// plain data), which we handle by assuming the classic artist/album/track/
// date order.
function detectColumns(firstRow: string[]): { iArtist: number; iAlbum: number; iTrack: number; iDate: number } | null {
  const lower = firstRow.map((c) => c.trim().toLowerCase())
  const looksLikeHeader = lower.some((c) => c === 'artist' || c === 'album' || c === 'track' || c === 'date' || c === 'timestamp' || c === 'uts')
  if (!looksLikeHeader) return null
  return {
    iArtist: colIndex(firstRow, 'artist'),
    iAlbum: colIndex(firstRow, 'album'),
    iTrack: colIndex(firstRow, 'track', 'title', 'name'),
    iDate: colIndex(firstRow, 'date', 'timestamp', 'uts', 'time'),
  }
}

// Normalize a date cell: Unix epoch (seconds) or already-ISO. Return ISO
// date (YYYY-MM-DD) when we can, undefined otherwise.
function toIsoDate(raw?: string): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  // Pure digits = Unix epoch. Seconds if <= 1e11, else milliseconds.
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10)
    const ms = n > 1e11 ? n : n * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
  }
  // Try native parse for ISO / RFC formats — Last.fm exports use these too.
  const d = new Date(trimmed)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  // Match "DD MMM YYYY HH:MM" that Last.fm uses on their web UI export.
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/.exec(trimmed)
  if (m) {
    const monthIdx = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase())
    if (monthIdx >= 0) {
      const iso = `${m[3]}-${String(monthIdx + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
      return iso
    }
  }
  return undefined
}

function parseScrobbles(text: string): ScrobbleRow[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []
  const detected = detectColumns(rows[0])
  const startAt = detected ? 1 : 0
  // Fallback order when there's no header row: artist, album, track, date.
  const cols = detected ?? { iArtist: 0, iAlbum: 1, iTrack: 2, iDate: 3 }
  const out: ScrobbleRow[] = []
  for (const row of rows.slice(startAt)) {
    const artist = (cols.iArtist >= 0 ? row[cols.iArtist] : '')?.trim() ?? ''
    const album = (cols.iAlbum >= 0 ? row[cols.iAlbum] : '')?.trim() ?? ''
    if (!artist) continue
    out.push({
      artist,
      album,
      track: cols.iTrack >= 0 ? row[cols.iTrack]?.trim() : undefined,
      date: cols.iDate >= 0 ? row[cols.iDate]?.trim() : undefined,
    })
  }
  return out
}

function aggregate(rows: ScrobbleRow[]): { albums: AggAlbum[]; orphans: AggAlbum[] } {
  const byKey = new Map<string, AggAlbum>()
  for (const r of rows) {
    const key = `${r.artist.toLowerCase()}::${r.album.toLowerCase()}`
    const iso = toIsoDate(r.date)
    const cur = byKey.get(key)
    if (cur) {
      cur.plays++
      if (iso && (!cur.lastPlayed || iso > cur.lastPlayed)) cur.lastPlayed = iso
    } else {
      byKey.set(key, { key, artist: r.artist, album: r.album, plays: 1, lastPlayed: iso })
    }
  }
  const all = Array.from(byKey.values())
  // Album-less rows (scrobbles without an Album field) are tracks played
  // without album metadata — keep them separated so they can be reviewed
  // but not accidentally imported en masse.
  const albums = all.filter((a) => a.album).sort((a, b) => b.plays - a.plays || a.artist.localeCompare(b.artist))
  const orphans = all.filter((a) => !a.album)
  return { albums, orphans }
}

// Match against the Music library — case-fold artist + album equality.
// Music items store the album title in .title and the artist in .artist.
function findExisting(existing: Item[], artist: string, album: string): Item | undefined {
  const aLc = artist.toLowerCase()
  const alLc = album.toLowerCase()
  for (const it of existing) {
    if (it.categoryId !== 'musica') continue
    if (it.title.toLowerCase() !== alLc) continue
    if ((it.artist ?? '').toLowerCase() === aLc) return it
  }
  return undefined
}

type Action = 'mark' | 'create' | 'skip'

export default function LastfmImporter({ existingItems, onImport, onClose }: Props) {
  const [albums, setAlbums] = useState<AggAlbum[]>([])
  const [actions, setActions] = useState<Record<string, Action>>({})
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [totalScrobbles, setTotalScrobbles] = useState(0)
  const [orphanCount, setOrphanCount] = useState(0)

  const matches = useMemo(() => {
    const map = new Map<string, Item | undefined>()
    for (const a of albums) map.set(a.key, findExisting(existingItems, a.artist, a.album))
    return map
  }, [albums, existingItems])

  const handleFile = async (file: File) => {
    setError(null)
    setBusy(true)
    try {
      const text = await file.text()
      const rows = parseScrobbles(text)
      if (rows.length === 0) {
        setError('No scrobbles found. Expected artist, album, track, date columns.')
        setBusy(false)
        return
      }
      const { albums: agg, orphans } = aggregate(rows)
      setAlbums(agg)
      setOrphanCount(orphans.length)
      setTotalScrobbles(rows.length)
      setFileName(file.name)
      // Default: mark listened for matched, skip for new (never grow the
      // library silently — scrobble histories can be tens of thousands
      // of albums the user never intended to track in Omnio).
      const init: Record<string, Action> = {}
      for (const a of agg) init[a.key] = findExisting(existingItems, a.artist, a.album) ? 'mark' : 'skip'
      setActions(init)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const setAction = (key: string, a: Action) => setActions((s) => ({ ...s, [key]: a }))

  const bulkSetNew = (a: Action) => {
    setActions((s) => {
      const next = { ...s }
      for (const al of albums) if (!matches.get(al.key)) next[al.key] = a
      return next
    })
  }

  const summary = useMemo(() => {
    let toMark = 0
    let toCreate = 0
    for (const a of albums) {
      const act = actions[a.key]
      if (act === 'mark') toMark++
      else if (act === 'create') toCreate++
    }
    return { toMark, toCreate }
  }, [albums, actions])

  const handleImport = () => {
    const updates = new Map<string, { consumed: true; finishedAt?: string }>()
    const creates: Item[] = []
    const now = Date.now()
    for (const a of albums) {
      const act = actions[a.key]
      if (act === 'skip') continue
      if (act === 'mark') {
        const match = matches.get(a.key)
        if (!match) continue
        updates.set(match.id, { consumed: true, finishedAt: a.lastPlayed })
      } else if (act === 'create') {
        creates.push({
          id: crypto.randomUUID(),
          categoryId: 'musica',
          title: a.album,
          artist: a.artist,
          createdAt: now,
          consumed: true,
          finishedAt: a.lastPlayed,
        })
      }
    }
    onImport({ updates, creates })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel lastfm-importer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820, width: '94vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Import Last.fm scrobbles</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Drop a scrobble history CSV — the format most exporters produce
            (lastfm-to-csv, benjaminbenben's tool, benjcunningham/lastexport,
            etc.). Columns can be in any order as long as they're named
            <code>artist</code>, <code>album</code>, <code>track</code>, <code>date</code> /
            <code>timestamp</code>. Scrobbles are aggregated to unique albums
            so nothing floods the preview.
          </p>

          <div className="importer-dropzone">
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              style={{ display: 'none' }}
              id="lastfm-file-input"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />
            <label htmlFor="lastfm-file-input" className="importer-file-btn">
              {busy ? 'Reading…' : albums.length > 0 ? 'Pick different file' : '+ Pick scrobble CSV'}
            </label>
            {fileName && <span className="importer-file-list">{fileName}</span>}
          </div>

          {error && <p className="save-files-error">{error}</p>}

          {albums.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{totalScrobbles.toLocaleString()} scrobbles · {albums.length} unique albums {orphanCount > 0 && <>· {orphanCount} track-only scrobbles ignored</>}</span>
                <span className="importer-new">{summary.toCreate} to create</span>
                <span className="importer-dupe">{summary.toMark} to mark listened</span>
                <div className="importer-select-actions">
                  <button type="button" onClick={() => bulkSetNew('create')}>Create all new</button>
                  <button type="button" onClick={() => bulkSetNew('skip')}>Skip all new</button>
                </div>
              </div>

              <div className="importer-table-wrap">
                <table className="importer-table">
                  <thead>
                    <tr>
                      <th>Album</th>
                      <th>Artist</th>
                      <th style={{ width: 70 }}>Plays</th>
                      <th style={{ width: 110 }}>Last played</th>
                      <th style={{ width: 170 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {albums.map((a) => {
                      const match = matches.get(a.key)
                      const action = actions[a.key] ?? 'skip'
                      return (
                        <tr key={a.key} className={!match ? 'dupe' : ''}>
                          <td>{a.album}</td>
                          <td>{a.artist}</td>
                          <td>{a.plays}</td>
                          <td>{a.lastPlayed ?? '—'}</td>
                          <td>
                            <select value={action} onChange={(e) => setAction(a.key, e.target.value as Action)}>
                              {match && <option value="mark">Mark listened</option>}
                              <option value="create">Create in Music</option>
                              <option value="skip">Skip</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        {albums.length > 0 && (
          <div className="modal-footer">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="primary-btn"
              disabled={summary.toMark + summary.toCreate === 0}
              onClick={handleImport}
            >
              Apply to {summary.toMark + summary.toCreate} album{summary.toMark + summary.toCreate === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

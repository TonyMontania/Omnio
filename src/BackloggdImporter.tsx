// Backloggd CSV importer → Games library.
//
// Backloggd's account export (Profile → Settings → Import/Export → Export)
// ships as a single CSV with columns roughly:
//
//   Title, Release Date, Platforms, Rating, Status, Review, Playing Hours,
//   Started Playing, Finished Playing, Backloggd Link
//
// Rating comes in on a 10-point scale (half-point precision) — we halve
// to Omnio's 5-point half-star rating. Backloggd Status strings map to
// Omnio GameStatus. Rows dedupe against the library on title + year.

import { useMemo, useState } from 'react'
import type { Item, GameStatus } from './types'
import { parseCsv, colIndex } from './utils/csv'

interface Props {
  existingItems: Item[]
  onImport: (items: Item[]) => void
  onClose: () => void
}

// Backloggd's status labels → Omnio GameStatus. Anything unknown falls
// through to 'backlog' so we never silently drop rows.
const STATUS_MAP: Record<string, GameStatus> = {
  'completed': 'completed',
  'played':    'played',
  'playing':   'playing',
  'shelved':   'dropped',
  'abandoned': 'dropped',
  'backlog':   'backlog',
  'wishlist':  'backlog',
}

interface Row {
  key: string        // `${title}::${year}`
  title: string
  year?: string
  rating?: number    // 0-5 half-star
  status?: GameStatus
  platforms?: string[]
  playTime?: string  // hours as decimal
  finishedAt?: string
  link?: string
}

function keyOf(t: string, y?: string): string { return `${t.trim().toLowerCase()}::${(y ?? '').trim()}` }

function parseRow(headers: string[], row: string[]): Row | null {
  const iTitle = colIndex(headers, 'Title', 'Game')
  const iDate = colIndex(headers, 'Release Date', 'Year')
  const iPlatforms = colIndex(headers, 'Platforms', 'Platform')
  const iRating = colIndex(headers, 'Rating')
  const iStatus = colIndex(headers, 'Status')
  const iHours = colIndex(headers, 'Playing Hours', 'Playtime', 'Hours')
  const iFinished = colIndex(headers, 'Finished Playing', 'Finished')
  const iLink = colIndex(headers, 'Backloggd Link', 'URL')
  if (iTitle < 0) return null
  const title = row[iTitle]?.trim()
  if (!title) return null
  const releaseRaw = iDate >= 0 ? row[iDate]?.trim() : ''
  const yr = releaseRaw ? /^(\d{4})/.exec(releaseRaw)?.[1] : undefined
  const ratingRaw = iRating >= 0 ? row[iRating]?.trim() : ''
  const rating10 = ratingRaw ? parseFloat(ratingRaw) : NaN
  const rating = Number.isFinite(rating10) && rating10 > 0 ? Math.round((rating10 / 2) * 2) / 2 : undefined
  const statusRaw = iStatus >= 0 ? row[iStatus]?.trim().toLowerCase() : ''
  const status = STATUS_MAP[statusRaw]
  const platforms = iPlatforms >= 0 ? row[iPlatforms]?.split(/[,;|]/).map((s) => s.trim()).filter(Boolean) : undefined
  const hoursRaw = iHours >= 0 ? row[iHours]?.trim() : ''
  const playTime = hoursRaw && /^\d+(?:\.\d+)?$/.test(hoursRaw) ? hoursRaw : undefined
  const finishedAt = iFinished >= 0 ? row[iFinished]?.trim() || undefined : undefined
  return {
    key: keyOf(title, yr),
    title,
    year: yr,
    rating,
    status,
    platforms: platforms && platforms.length > 0 ? platforms : undefined,
    playTime,
    finishedAt,
    link: iLink >= 0 ? row[iLink]?.trim() || undefined : undefined,
  }
}

function findExisting(existing: Item[], title: string, year?: string): Item | undefined {
  const nLc = title.trim().toLowerCase()
  const yr = (year ?? '').trim()
  return existing.find((it) => it.categoryId === 'videojuegos'
    && it.title.trim().toLowerCase() === nLc
    && (!yr || !it.releaseYear || yr === it.releaseYear.trim()))
}

export default function BackloggdImporter({ existingItems, onImport, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setError(null)
    try {
      const text = await file.text()
      const table = parseCsv(text)
      if (table.length < 2) { setError('CSV is empty or missing headers.'); return }
      const headers = table[0]
      const parsed: Row[] = []
      for (const r of table.slice(1)) {
        const row = parseRow(headers, r)
        if (row) parsed.push(row)
      }
      parsed.sort((a, b) => a.title.localeCompare(b.title))
      setRows(parsed)
      setFileName(file.name)
      const pre = new Set<string>()
      for (const r of parsed) if (!findExisting(existingItems, r.title, r.year)) pre.add(r.key)
      setSelected(pre)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const matches = useMemo(() => {
    const m = new Map<string, Item | undefined>()
    for (const r of rows) m.set(r.key, findExisting(existingItems, r.title, r.year))
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
        categoryId: 'videojuegos',
        title: r.title,
        createdAt: now,
        releaseYear: r.year,
        rating: r.rating,
        gameStatus: r.status,
        platforms: r.platforms,
        playTime: r.playTime,
        finishedAt: r.finishedAt,
      })
    }
    if (out.length > 0) onImport(out)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel letterboxd-importer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780, width: '94vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Import from Backloggd</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Export from Backloggd via Profile → Settings → Import/Export. Drop the CSV
            here. Ratings on the 10-point scale get halved to Omnio's 5-point.
          </p>
          <div className="importer-dropzone">
            <input type="file" accept=".csv" style={{ display: 'none' }} id="backloggd-file"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }} />
            <label htmlFor="backloggd-file" className="importer-file-btn">
              {rows.length > 0 ? 'Pick different file' : '+ Pick CSV'}
            </label>
            {fileName && <span className="importer-file-list">{fileName}</span>}
          </div>
          {error && <p className="save-files-error">{error}</p>}
          {rows.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{rows.length} games found</span>
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
                  <thead><tr><th style={{ width: 32 }}></th><th>Title</th><th style={{ width: 60 }}>Year</th><th style={{ width: 70 }}>Rating</th><th style={{ width: 90 }}>Status</th><th style={{ width: 60 }}>Hours</th><th style={{ width: 90 }}>In lib</th></tr></thead>
                  <tbody>
                    {rows.map((r) => {
                      const dupe = matches.get(r.key)
                      return (
                        <tr key={r.key} className={dupe ? 'dupe' : ''}>
                          <td><input type="checkbox" checked={selected.has(r.key)} onChange={() => toggle(r.key)} /></td>
                          <td>{r.title}</td>
                          <td>{r.year ?? '—'}</td>
                          <td>{r.rating ? r.rating.toFixed(1) : '—'}</td>
                          <td>{r.status ?? '—'}</td>
                          <td>{r.playTime ?? '—'}</td>
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
              Import {selected.size} game{selected.size === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

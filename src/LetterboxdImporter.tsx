// Letterboxd CSV importer → Movies library.
//
// Letterboxd's account export is a ZIP containing several CSVs; we accept
// individual CSVs directly (drop the ZIP into any archiver first). Any
// combination of these three files works, uploaded together:
//
//   watched.csv   — Date, Name, Year, Letterboxd URI
//   ratings.csv   — Date, Name, Year, Letterboxd URI, Rating (0.5–5.0 half stars)
//   diary.csv     — Date, Name, Year, Letterboxd URI, Rating, Rewatch, Tags, Watched Date
//
// Rows are unioned by (name, year). Ratings.csv contributes .rating.
// Diary.csv adds the Watched Date as .finishedAt when present. Anything
// that appears in any file is treated as consumed=true.
//
// Dedupe against the existing library: title + year fuzzy match. The
// preview lets the user uncheck rows they don't want to import.

import { useMemo, useState } from 'react'
import type { Item, MovieSource } from './types'
import { parseCsv, colIndex } from './utils/csv'

interface Props {
  existingItems: Item[]
  onImport: (items: Item[]) => void
  onClose: () => void
}

type Row = {
  key: string          // `${name}::${year}`
  name: string
  year?: string
  rating?: number      // 0-5, half-star precision
  finishedAt?: string  // ISO date (YYYY-MM-DD)
  letterboxdUri?: string
  fromFiles: Set<string>
}

// Half-star ratings on Letterboxd's 0.5–5 scale map directly onto Omnio's
// 0-5 rating (RatingPicker supports 0.5 increments).
function parseRating(raw: string): number | undefined {
  if (!raw) return undefined
  const n = parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function keyOf(name: string, year?: string): string {
  return `${name.trim().toLowerCase()}::${(year ?? '').trim()}`
}

// Fuzzy dedupe against the library — Letterboxd year is release year, Omnio's
// releaseYear too. If year matches exactly and title casefolds equal → same
// movie. If year is missing on either side, fall back to title-only match.
function findExisting(existing: Item[], name: string, year?: string): Item | undefined {
  const nLc = name.trim().toLowerCase()
  const yr = (year ?? '').trim()
  for (const it of existing) {
    if (it.categoryId !== 'peliculas') continue
    if (it.title.trim().toLowerCase() !== nLc) continue
    const itYr = (it.releaseYear ?? '').trim()
    if (!yr || !itYr || yr === itYr) return it
  }
  return undefined
}

async function parseLetterboxdFile(file: File): Promise<{ rows: Row[]; kind: 'watched' | 'ratings' | 'diary' | 'unknown' }> {
  const text = await file.text()
  const table = parseCsv(text)
  if (table.length === 0) return { rows: [], kind: 'unknown' }
  const headers = table[0]
  const iName = colIndex(headers, 'Name')
  const iYear = colIndex(headers, 'Year')
  const iRating = colIndex(headers, 'Rating')
  const iDate = colIndex(headers, 'Date')
  const iWatched = colIndex(headers, 'Watched Date')
  const iUri = colIndex(headers, 'Letterboxd URI')
  if (iName < 0) return { rows: [], kind: 'unknown' }
  const kind: Row['fromFiles'] extends Set<infer T> ? T : never =
    iWatched >= 0 ? 'diary'
    : iRating >= 0 ? 'ratings'
    : 'watched'
  const rows: Row[] = []
  for (const raw of table.slice(1)) {
    const name = raw[iName]?.trim()
    if (!name) continue
    const year = iYear >= 0 ? raw[iYear]?.trim() || undefined : undefined
    const rating = iRating >= 0 ? parseRating(raw[iRating]) : undefined
    // Diary has "Watched Date" separate from the row's Date (the row Date
    // is when the diary entry was made, Watched Date is when the movie
    // was actually seen). Prefer Watched Date, fall back to Date.
    const finishedAt = iWatched >= 0 ? raw[iWatched]?.trim() : (iDate >= 0 ? raw[iDate]?.trim() : undefined)
    rows.push({
      key: keyOf(name, year),
      name,
      year,
      rating,
      finishedAt: finishedAt || undefined,
      letterboxdUri: iUri >= 0 ? raw[iUri]?.trim() || undefined : undefined,
      fromFiles: new Set([kind]),
    })
  }
  return { rows, kind: kind as 'watched' | 'ratings' | 'diary' }
}

// Merge two rows for the same movie (same key) picking best-of each field.
function mergeRows(a: Row, b: Row): Row {
  const merged: Row = {
    key: a.key,
    name: a.name,
    year: a.year ?? b.year,
    rating: a.rating ?? b.rating,
    finishedAt: a.finishedAt ?? b.finishedAt,
    letterboxdUri: a.letterboxdUri ?? b.letterboxdUri,
    fromFiles: new Set([...a.fromFiles, ...b.fromFiles]),
  }
  return merged
}

export default function LetterboxdImporter({ existingItems, onImport, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [fileNames, setFileNames] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleFiles = async (files: FileList | File[]) => {
    setError(null)
    setBusy(true)
    try {
      const parsed: Row[] = []
      const names: string[] = []
      for (const f of Array.from(files)) {
        if (!f.name.toLowerCase().endsWith('.csv')) continue
        names.push(f.name)
        const { rows: got } = await parseLetterboxdFile(f)
        parsed.push(...got)
      }
      if (parsed.length === 0) {
        setError('No rows found. Letterboxd expects watched.csv / ratings.csv / diary.csv.')
        setBusy(false)
        return
      }
      // Merge rows sharing the same key so ratings.csv can enrich watched.csv, etc.
      const map = new Map<string, Row>()
      for (const r of parsed) {
        const prev = map.get(r.key)
        map.set(r.key, prev ? mergeRows(prev, r) : r)
      }
      const merged = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
      setRows(merged)
      setFileNames(names)
      // Default: select rows that are NEW to the library (skip dupes).
      const preselected = new Set<string>()
      for (const r of merged) if (!findExisting(existingItems, r.name, r.year)) preselected.add(r.key)
      setSelected(preselected)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const toggle = (key: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }
  const selectAll = () => setSelected(new Set(rows.map((r) => r.key)))
  const selectNone = () => setSelected(new Set())
  const selectNewOnly = () => {
    const next = new Set<string>()
    for (const r of rows) if (!findExisting(existingItems, r.name, r.year)) next.add(r.key)
    setSelected(next)
  }

  // Precompute matches once so per-row lookup + dupe count don't rescan
  // existingItems on every render. Matches the pattern used by the other
  // importers (Discogs / Lastfm / Highlights / Trakt).
  const matches = useMemo(() => {
    const map = new Map<string, Item | undefined>()
    for (const r of rows) map.set(r.key, findExisting(existingItems, r.name, r.year))
    return map
  }, [rows, existingItems])
  const dupeCount = useMemo(
    () => rows.reduce((n, r) => (matches.get(r.key) ? n + 1 : n), 0),
    [rows, matches],
  )
  const newCount = rows.length - dupeCount

  const handleImport = () => {
    if (selected.size === 0) return
    const now = Date.now()
    const newItems: Item[] = []
    for (const r of rows) {
      if (!selected.has(r.key)) continue
      const item: Item = {
        id: crypto.randomUUID(),
        categoryId: 'peliculas',
        title: r.name,
        createdAt: now,
        consumed: true,
        rating: r.rating,
        releaseYear: r.year,
        finishedAt: r.finishedAt,
        movieSource: 'original' as MovieSource,
      }
      newItems.push(item)
    }
    if (newItems.length > 0) onImport(newItems)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel letterboxd-importer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780, width: '94vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Import from Letterboxd</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Drop one or more of <code>watched.csv</code>, <code>ratings.csv</code>, <code>diary.csv</code> from
            your Letterboxd account export (Settings → Data → Export). If you have all three, upload them
            together — rows merge automatically so ratings and watch dates line up per movie.
          </p>

          <div className="importer-dropzone">
            <input
              type="file"
              multiple
              accept=".csv"
              style={{ display: 'none' }}
              id="letterboxd-file-input"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <label htmlFor="letterboxd-file-input" className="importer-file-btn">
              {busy ? 'Reading…' : rows.length > 0 ? 'Pick different files' : '+ Pick CSV files'}
            </label>
            {fileNames.length > 0 && (
              <span className="importer-file-list">{fileNames.join(' · ')}</span>
            )}
          </div>

          {error && <p className="save-files-error">{error}</p>}

          {rows.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{rows.length} movies found</span>
                <span className="importer-new">{newCount} new</span>
                <span className="importer-dupe">{dupeCount} already in library</span>
                <div className="importer-select-actions">
                  <button type="button" onClick={selectNewOnly}>Select new only</button>
                  <button type="button" onClick={selectAll}>Select all</button>
                  <button type="button" onClick={selectNone}>Select none</button>
                </div>
              </div>

              <div className="importer-table-wrap">
                <table className="importer-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}></th>
                      <th>Title</th>
                      <th style={{ width: 60 }}>Year</th>
                      <th style={{ width: 70 }}>Rating</th>
                      <th style={{ width: 110 }}>Watched</th>
                      <th style={{ width: 90 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const existing = matches.get(r.key)
                      return (
                        <tr key={r.key} className={existing ? 'dupe' : ''}>
                          <td>
                            <input type="checkbox" checked={selected.has(r.key)} onChange={() => toggle(r.key)} />
                          </td>
                          <td>{r.name}</td>
                          <td>{r.year ?? '—'}</td>
                          <td>{r.rating ? r.rating.toFixed(1) : '—'}</td>
                          <td>{r.finishedAt ?? '—'}</td>
                          <td>{existing ? <span className="importer-badge dupe">In library</span> : <span className="importer-badge new">New</span>}</td>
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
              Import {selected.size} movie{selected.size === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

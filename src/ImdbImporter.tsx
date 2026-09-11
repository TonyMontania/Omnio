// IMDb list / watchlist CSV importer → Movies or Series library.
//
// From any IMDb list page (including your watchlist) → "Export".
// The CSV columns we care about:
//   Const (tt id), Title, Original Title, URL, Title Type (movie |
//   tvSeries | tvMiniSeries | tvSpecial | short | video | videoGame),
//   Year, Runtime (mins), Genres, Your Rating (1-10 or empty),
//   Directors, Release Date, Date Rated
//
// Movies + tvSpecial + short + video → peliculas
// tvSeries + tvMiniSeries → series
// videoGame → videojuegos (best-effort — usually the user wants these
//   in Games too)
//
// Your Rating (1-10) divided by 2 → Omnio 0-5.

import { useMemo, useState } from 'react'
import type { Item } from './types'
import { parseCsv, colIndex } from './utils/csv'

interface Props {
  existingItems: Item[]
  onImport: (items: Item[]) => void
  onClose: () => void
}

type CategoryTarget = 'peliculas' | 'series' | 'videojuegos'

type Row = {
  key: string
  imdbId: string
  title: string
  originalTitle?: string
  target: CategoryTarget
  year?: string
  runtime?: string
  genres: string[]
  rating?: number
  directors: string[]
  releaseDate?: string
  finishedAt?: string
}

function snapHalf(v: number): number { return Math.round(v * 2) / 2 }

function mapTitleType(t: string): CategoryTarget {
  const s = t.toLowerCase()
  if (s === 'tvseries' || s === 'tvminiseries') return 'series'
  if (s === 'videogame') return 'videojuegos'
  return 'peliculas'
}
function findExisting(existing: Item[], id: string, title: string, year?: string, target?: CategoryTarget): Item | undefined {
  const nLc = title.trim().toLowerCase()
  for (const it of existing) {
    if (target && it.categoryId !== target) continue
    if ((it as { imdbId?: string }).imdbId === id) return it
    if (it.title.trim().toLowerCase() === nLc && (!year || !it.releaseYear || it.releaseYear === year)) return it
  }
  return undefined
}
async function parseFile(file: File): Promise<Row[]> {
  const text = await file.text()
  const table = parseCsv(text)
  if (table.length === 0) return []
  const headers = table[0]
  const iConst = colIndex(headers, 'Const')
  const iTitle = colIndex(headers, 'Title')
  const iOrig = colIndex(headers, 'Original Title')
  const iType = colIndex(headers, 'Title Type')
  const iYear = colIndex(headers, 'Year')
  const iRun = colIndex(headers, 'Runtime (mins)')
  const iGenres = colIndex(headers, 'Genres')
  const iRating = colIndex(headers, 'Your Rating')
  const iDir = colIndex(headers, 'Directors')
  const iRelease = colIndex(headers, 'Release Date')
  const iDateRated = colIndex(headers, 'Date Rated')
  if (iTitle < 0) return []
  const rows: Row[] = []
  for (const raw of table.slice(1)) {
    const title = raw[iTitle]?.trim(); if (!title) continue
    const id = iConst >= 0 ? raw[iConst]?.trim() ?? '' : ''
    const type = iType >= 0 ? raw[iType]?.trim() ?? '' : 'movie'
    const target = mapTitleType(type)
    const year = iYear >= 0 ? raw[iYear]?.trim() || undefined : undefined
    const runtime = iRun >= 0 ? raw[iRun]?.trim() || undefined : undefined
    const genres = iGenres >= 0 ? raw[iGenres].split(',').map((g) => g.trim()).filter(Boolean) : []
    const ratingRaw = iRating >= 0 ? parseFloat(raw[iRating]) : NaN
    const rating = Number.isFinite(ratingRaw) && ratingRaw > 0 ? snapHalf(ratingRaw / 2) : undefined
    const directors = iDir >= 0 ? raw[iDir].split(',').map((d) => d.trim()).filter(Boolean) : []
    const releaseDate = iRelease >= 0 ? raw[iRelease]?.trim() || undefined : undefined
    const finishedAt = iDateRated >= 0 ? raw[iDateRated]?.trim() || undefined : undefined
    rows.push({
      key: id || `${title}::${year ?? ''}`,
      imdbId: id, title,
      originalTitle: iOrig >= 0 ? raw[iOrig]?.trim() || undefined : undefined,
      target, year, runtime, genres, rating, directors, releaseDate, finishedAt,
    })
  }
  return rows
}

export default function ImdbImporter({ existingItems, onImport, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [fileName, setFileName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleFiles = async (files: FileList | File[]) => {
    setError(null); setBusy(true)
    try {
      const parsed: Row[] = []
      const names: string[] = []
      for (const f of Array.from(files)) {
        if (!f.name.toLowerCase().endsWith('.csv')) continue
        names.push(f.name); parsed.push(...(await parseFile(f)))
      }
      if (parsed.length === 0) { setError('No rows found. Expected an IMDb list export.'); setBusy(false); return }
      const map = new Map<string, Row>()
      for (const r of parsed) if (!map.has(r.key)) map.set(r.key, r)
      const merged = Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title))
      setRows(merged); setFileName(names.join(' · '))
      const pre = new Set<string>()
      for (const r of merged) if (!findExisting(existingItems, r.imdbId, r.title, r.year, r.target)) pre.add(r.key)
      setSelected(pre)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const matches = useMemo(() => {
    const m = new Map<string, Item | undefined>()
    for (const r of rows) m.set(r.key, findExisting(existingItems, r.imdbId, r.title, r.year, r.target))
    return m
  }, [rows, existingItems])
  const dupe = useMemo(() => rows.reduce((n, r) => (matches.get(r.key) ? n + 1 : n), 0), [rows, matches])

  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  const handleImport = () => {
    if (selected.size === 0) return
    const now = Date.now()
    const items: Item[] = []
    for (const r of rows) {
      if (!selected.has(r.key)) continue
      const base: Partial<Item> = {
        id: crypto.randomUUID(),
        categoryId: r.target,
        title: r.title,
        createdAt: now,
        rating: r.rating,
        releaseYear: r.year,
        releaseDate: r.releaseDate,
        genres: r.genres.length > 0 ? r.genres : undefined,
        alternativeTitles: r.originalTitle && r.originalTitle !== r.title ? [r.originalTitle] : undefined,
        finishedAt: r.finishedAt,
      }
      if (r.target === 'peliculas') {
        (base as { directors?: string[] }).directors = r.directors.length > 0 ? r.directors : undefined;
        (base as { duration?: string }).duration = r.runtime;
        (base as { consumed?: boolean }).consumed = r.rating !== undefined
        ;(base as { movieSource?: string }).movieSource = 'original'
      } else if (r.target === 'series') {
        (base as { seriesStatus?: string }).seriesStatus = r.rating !== undefined ? 'completed' : 'plan_to_watch'
      }
      (base as { imdbId?: string }).imdbId = r.imdbId || undefined
      items.push(base as Item)
    }
    if (items.length > 0) onImport(items)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820, width: '94vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Import from IMDb</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Grab the CSV from any IMDb list (watchlist or user list) via the “Export” button.
            Movies/specials → Movies library, TV series → Series library, games → Games. Your ratings scale 1-10 down to Omnio's 0-5.
          </p>
          <div className="importer-dropzone">
            <input type="file" accept=".csv" style={{ display: 'none' }} id="imdb-file-input"
              onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }} />
            <label htmlFor="imdb-file-input" className="importer-file-btn">{busy ? 'Reading…' : rows.length > 0 ? 'Pick different file' : '+ Pick CSV'}</label>
            {fileName && <span className="importer-file-list">{fileName}</span>}
          </div>
          {error && <p className="save-files-error">{error}</p>}
          {rows.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{rows.length} entries</span>
                <span className="importer-new">{rows.length - dupe} new</span>
                <span className="importer-dupe">{dupe} already in library</span>
                <div className="importer-select-actions">
                  <button type="button" onClick={() => setSelected(new Set(rows.filter((r) => !matches.get(r.key)).map((r) => r.key)))}>Select new only</button>
                  <button type="button" onClick={() => setSelected(new Set(rows.map((r) => r.key)))}>Select all</button>
                  <button type="button" onClick={() => setSelected(new Set())}>Select none</button>
                </div>
              </div>
              <div className="importer-table-wrap">
                <table className="importer-table">
                  <thead><tr><th style={{ width: 32 }}></th><th>Title</th><th style={{ width: 60 }}>Year</th><th style={{ width: 80 }}>Kind</th><th style={{ width: 60 }}>Rating</th><th style={{ width: 90 }}>Match</th></tr></thead>
                  <tbody>
                    {rows.map((r) => {
                      const ex = matches.get(r.key)
                      return (
                        <tr key={r.key} className={ex ? 'dupe' : ''}>
                          <td><input type="checkbox" checked={selected.has(r.key)} onChange={() => toggle(r.key)} /></td>
                          <td>{r.title}</td>
                          <td>{r.year ?? '—'}</td>
                          <td>{r.target === 'peliculas' ? 'Movie' : r.target === 'series' ? 'Series' : 'Game'}</td>
                          <td>{r.rating ? r.rating.toFixed(1) : '—'}</td>
                          <td>{ex ? <span className="importer-badge dupe">In library</span> : <span className="importer-badge new">New</span>}</td>
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
              Import {selected.size} entr{selected.size === 1 ? 'y' : 'ies'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

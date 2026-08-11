// Serializd export importer → Series library.
//
// Serializd exports come in two flavors:
//   * JSON export from serializd.com → shows[] with { title, year, status, rating }
//   * CSV export → Title, Year, Status, Rating, Watched Date
//
// This importer accepts either — parses by first-char sniff.

import { useMemo, useState } from 'react'
import type { Item, SeriesStatus } from './types'
import { parseCsv, colIndex } from './utils/csv'

interface Props {
  existingItems: Item[]
  onImport: (items: Item[]) => void
  onClose: () => void
}

const STATUS_MAP: Record<string, SeriesStatus> = {
  'watching':      'watching',
  'watched':       'completed',
  'completed':     'completed',
  'plan_to_watch': 'plan_to_watch',
  'planning':      'plan_to_watch',
  'plan to watch': 'plan_to_watch',
  'paused':        'paused',
  'on hold':       'paused',
  'dropped':       'dropped',
}

interface Row {
  key: string
  title: string
  year?: string
  status?: SeriesStatus
  rating?: number
  finishedAt?: string
}

function keyOf(t: string, y?: string): string { return `${t.trim().toLowerCase()}::${(y ?? '').trim()}` }

// Serializd JSON exports historically nest shows under { shows: […] }
// or return a bare array. Accept both.
function fromJson(text: string): Row[] {
  const parsed = JSON.parse(text) as unknown
  const arr = Array.isArray(parsed) ? parsed : ((parsed as { shows?: unknown[]; data?: unknown[] })?.shows ?? (parsed as { data?: unknown[] })?.data)
  if (!Array.isArray(arr)) return []
  const rows: Row[] = []
  for (const raw of arr as Record<string, unknown>[]) {
    const title = String(raw.title ?? raw.name ?? '').trim()
    if (!title) continue
    const yearRaw = String(raw.year ?? raw.releaseYear ?? '').trim()
    const yr = /^\d{4}$/.test(yearRaw) ? yearRaw : undefined
    const status = STATUS_MAP[String(raw.status ?? '').toLowerCase()]
    const ratingRaw = Number(raw.rating ?? 0)
    // Serializd rates on a 10-point scale like Backloggd — halve to fit
    // Omnio's 5-star. Guard against out-of-range garbage.
    const rating = ratingRaw > 0 && ratingRaw <= 10 ? Math.round((ratingRaw / 2) * 2) / 2 : undefined
    rows.push({
      key: keyOf(title, yr),
      title,
      year: yr,
      status,
      rating,
      finishedAt: String(raw.watchedDate ?? raw.finishedAt ?? '').trim() || undefined,
    })
  }
  return rows
}

function fromCsv(text: string): Row[] {
  const table = parseCsv(text)
  if (table.length < 2) return []
  const headers = table[0]
  const iTitle = colIndex(headers, 'Title', 'Show', 'Name')
  const iYear = colIndex(headers, 'Year', 'Release Year')
  const iStatus = colIndex(headers, 'Status')
  const iRating = colIndex(headers, 'Rating')
  const iWatched = colIndex(headers, 'Watched Date', 'Finished')
  if (iTitle < 0) return []
  const rows: Row[] = []
  for (const r of table.slice(1)) {
    const title = r[iTitle]?.trim()
    if (!title) continue
    const yearRaw = iYear >= 0 ? r[iYear]?.trim() : ''
    const yr = /^\d{4}$/.test(yearRaw) ? yearRaw : undefined
    const rt = iRating >= 0 ? parseFloat(r[iRating] || '') : NaN
    const rating = Number.isFinite(rt) && rt > 0 ? Math.round((rt / 2) * 2) / 2 : undefined
    rows.push({
      key: keyOf(title, yr),
      title,
      year: yr,
      status: iStatus >= 0 ? STATUS_MAP[r[iStatus]?.trim().toLowerCase() ?? ''] : undefined,
      rating,
      finishedAt: iWatched >= 0 ? r[iWatched]?.trim() || undefined : undefined,
    })
  }
  return rows
}

function findExisting(existing: Item[], title: string, year?: string): Item | undefined {
  const nLc = title.trim().toLowerCase()
  const yr = (year ?? '').trim()
  return existing.find((it) => it.categoryId === 'series'
    && it.title.trim().toLowerCase() === nLc
    && (!yr || !it.releaseYear || yr === it.releaseYear.trim()))
}

export default function SerializdImporter({ existingItems, onImport, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setError(null)
    try {
      const text = await file.text()
      // First non-whitespace char decides JSON vs CSV — cheap and reliable.
      const firstChar = text.trimStart()[0]
      const parsed = firstChar === '{' || firstChar === '[' ? fromJson(text) : fromCsv(text)
      if (parsed.length === 0) { setError('No rows found. Expected Serializd JSON or CSV export.'); return }
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
        categoryId: 'series',
        title: r.title,
        createdAt: now,
        releaseYear: r.year,
        rating: r.rating,
        seriesStatus: r.status,
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
          <h2>Import from Serializd</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Drop your Serializd JSON or CSV export. Ratings on the 10-point
            scale get halved to Omnio's 5-star.
          </p>
          <div className="importer-dropzone">
            <input type="file" accept=".json,.csv" style={{ display: 'none' }} id="serializd-file"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }} />
            <label htmlFor="serializd-file" className="importer-file-btn">
              {rows.length > 0 ? 'Pick different file' : '+ Pick JSON / CSV'}
            </label>
            {fileName && <span className="importer-file-list">{fileName}</span>}
          </div>
          {error && <p className="save-files-error">{error}</p>}
          {rows.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{rows.length} shows found</span>
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
                  <thead><tr><th style={{ width: 32 }}></th><th>Title</th><th style={{ width: 60 }}>Year</th><th style={{ width: 70 }}>Rating</th><th style={{ width: 110 }}>Status</th><th style={{ width: 90 }}>In lib</th></tr></thead>
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
              Import {selected.size} show{selected.size === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

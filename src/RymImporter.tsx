// RateYourMusic (RYM) CSV importer → Music library.
//
// RYM's account export ("Data export" tool) hands out a CSV per shelf
// (ratings, listened, etc.). The columns we look at:
//   Title, First Name, Last Name, First Name localized, Last Name localized,
//   Rating (0-10 or half increments; RYM uses 0.5 steps), Release_Date,
//   Ownership, Purchase Date, Media Type, Review
//
// Rating comes on the 0-10 scale (Omnio uses 0-5) so we divide by 2
// and snap to half stars. Ownership → the closest ownership enum
// value we have.

import { useMemo, useState } from 'react'
import type { Item, Ownership } from './types'
import { parseCsv, colIndex } from './utils/csv'

interface Props {
  existingItems: Item[]
  onImport: (items: Item[]) => void
  onClose: () => void
}

type Row = {
  key: string
  title: string
  artist: string
  releaseYear?: string
  rating?: number
  ownership?: Ownership
  review?: string
}

function snapHalf(v: number): number { return Math.round(v * 2) / 2 }

function mapOwnership(raw: string): Ownership | undefined {
  const s = (raw || '').trim().toLowerCase()
  if (!s || s === 'not owned' || s === 'unowned') return 'unlicensed'
  if (s.includes('subscription') || s.includes('stream')) return 'subscription'
  if (s.includes('shared') || s.includes('borrow')) return 'shared'
  return 'owned'
}
function keyOf(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}::${artist.trim().toLowerCase()}`
}
function findExisting(existing: Item[], title: string, artist: string): Item | undefined {
  const nLc = title.trim().toLowerCase()
  const aLc = artist.trim().toLowerCase()
  for (const it of existing) {
    if (it.categoryId !== 'musica') continue
    if (it.title.trim().toLowerCase() !== nLc) continue
    if (!it.artist || it.artist.trim().toLowerCase() === aLc) return it
  }
  return undefined
}
async function parseFile(file: File): Promise<Row[]> {
  const text = await file.text()
  const table = parseCsv(text)
  if (table.length === 0) return []
  const headers = table[0]
  const iTitle = colIndex(headers, 'Title')
  const iFirst = colIndex(headers, 'First Name')
  const iLast = colIndex(headers, 'Last Name')
  const iFirstLoc = colIndex(headers, 'First Name localized')
  const iLastLoc = colIndex(headers, 'Last Name localized')
  const iRating = colIndex(headers, 'Rating')
  const iDate = colIndex(headers, 'Release_Date')
  const iOwn = colIndex(headers, 'Ownership')
  const iReview = colIndex(headers, 'Review')
  if (iTitle < 0) return []
  const rows: Row[] = []
  for (const raw of table.slice(1)) {
    const title = raw[iTitle]?.trim(); if (!title) continue
    const fn = iFirst >= 0 ? raw[iFirst]?.trim() ?? '' : ''
    const ln = iLast >= 0 ? raw[iLast]?.trim() ?? '' : ''
    const fnLoc = iFirstLoc >= 0 ? raw[iFirstLoc]?.trim() ?? '' : ''
    const lnLoc = iLastLoc >= 0 ? raw[iLastLoc]?.trim() ?? '' : ''
    const artist = [fn, ln].filter(Boolean).join(' ').trim()
      || [fnLoc, lnLoc].filter(Boolean).join(' ').trim()
    const ratingRaw = iRating >= 0 ? parseFloat(raw[iRating]) : NaN
    const rating = Number.isFinite(ratingRaw) && ratingRaw > 0 ? snapHalf(ratingRaw / 2) : undefined
    const dateRaw = iDate >= 0 ? raw[iDate]?.trim() : ''
    const yearMatch = dateRaw?.match(/^(\d{4})/)
    const releaseYear = yearMatch ? yearMatch[1] : undefined
    rows.push({
      key: keyOf(title, artist), title, artist,
      releaseYear, rating,
      ownership: iOwn >= 0 ? mapOwnership(raw[iOwn]) : undefined,
      review: iReview >= 0 ? raw[iReview]?.trim() || undefined : undefined,
    })
  }
  return rows
}

export default function RymImporter({ existingItems, onImport, onClose }: Props) {
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
      if (parsed.length === 0) { setError('No rows found. Expected the RYM data export CSV.'); setBusy(false); return }
      const map = new Map<string, Row>()
      for (const r of parsed) if (!map.has(r.key)) map.set(r.key, r)
      const merged = Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title))
      setRows(merged); setFileName(names.join(' · '))
      const pre = new Set<string>()
      for (const r of merged) if (!findExisting(existingItems, r.title, r.artist)) pre.add(r.key)
      setSelected(pre)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const matches = useMemo(() => {
    const m = new Map<string, Item | undefined>()
    for (const r of rows) m.set(r.key, findExisting(existingItems, r.title, r.artist))
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
      items.push({
        id: crypto.randomUUID(),
        categoryId: 'musica',
        title: r.title,
        createdAt: now,
        artist: r.artist || undefined,
        rating: r.rating,
        releaseYear: r.releaseYear,
        ownership: r.ownership,
        musicReview: r.review,
        consumed: r.rating !== undefined,
      } as Item)
    }
    if (items.length > 0) onImport(items)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780, width: '94vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Import from RateYourMusic</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Grab a CSV from RYM's Data Export tool (Profile → Data export). Ratings scale 0-10 down to
            Omnio's 0-5. Ownership tags map to physical/digital when recognizable.
          </p>
          <div className="importer-dropzone">
            <input type="file" accept=".csv" style={{ display: 'none' }} id="rym-file-input"
              onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }} />
            <label htmlFor="rym-file-input" className="importer-file-btn">{busy ? 'Reading…' : rows.length > 0 ? 'Pick different file' : '+ Pick CSV'}</label>
            {fileName && <span className="importer-file-list">{fileName}</span>}
          </div>
          {error && <p className="save-files-error">{error}</p>}
          {rows.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{rows.length} albums</span>
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
                  <thead><tr><th style={{ width: 32 }}></th><th>Title</th><th>Artist</th><th style={{ width: 60 }}>Year</th><th style={{ width: 60 }}>Rating</th><th style={{ width: 90 }}>Match</th></tr></thead>
                  <tbody>
                    {rows.map((r) => {
                      const ex = matches.get(r.key)
                      return (
                        <tr key={r.key} className={ex ? 'dupe' : ''}>
                          <td><input type="checkbox" checked={selected.has(r.key)} onChange={() => toggle(r.key)} /></td>
                          <td>{r.title}</td>
                          <td>{r.artist || '—'}</td>
                          <td>{r.releaseYear ?? '—'}</td>
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
              Import {selected.size} album{selected.size === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

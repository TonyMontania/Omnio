// StoryGraph CSV importer → Books library.
//
// StoryGraph's account export (Profile → Manage account → Manage your
// data → Export data) drops a single CSV with every book you have on
// your shelf. Key columns:
//   Title, Authors, Read Status ("read" | "currently-reading" | "to-read"
//   | "did-not-finish"), Star Rating (0-5, half-star), Last Date Read
//   (YYYY/MM/DD), Read Count, ISBN/UID.
//
// Star Ratings in StoryGraph come in 0.25 increments (their UI); we
// snap to the nearest 0.5 to match Omnio's rating precision.
//
// Read Status maps to Omnio's bookStatus:
//   read              → completed
//   currently-reading → reading
//   to-read           → plan_to_read
//   did-not-finish    → dropped

import { useMemo, useState } from 'react'
import type { Item, BookStatus } from './types'
import { parseCsv, colIndex } from './utils/csv'

interface Props {
  existingItems: Item[]
  onImport: (items: Item[]) => void
  onClose: () => void
}

type Row = {
  key: string
  title: string
  authors: string[]
  status: BookStatus
  rating?: number
  finishedAt?: string
  isbn?: string
  readCount?: number
}

const STATUS_MAP: Record<string, BookStatus> = {
  read: 'completed',
  'currently-reading': 'reading',
  'to-read': 'plan_to_read',
  'did-not-finish': 'dropped',
}

function snapHalf(v: number): number {
  return Math.round(v * 2) / 2
}
function keyOf(title: string, authors: string[]): string {
  return `${title.trim().toLowerCase()}::${authors.join(',').toLowerCase()}`
}
function findExisting(existing: Item[], title: string, authors: string[]): Item | undefined {
  const nLc = title.trim().toLowerCase()
  const aLc = authors.map((a) => a.toLowerCase())
  for (const it of existing) {
    if (it.categoryId !== 'libros') continue
    if (it.title.trim().toLowerCase() !== nLc) continue
    const itAuthors = (it as { authors?: string[] }).authors
    if (aLc.length === 0 || !itAuthors || itAuthors.length === 0) return it
    const overlap = itAuthors.some((a: string) => aLc.includes(a.toLowerCase()))
    if (overlap) return it
  }
  return undefined
}
function toIsoDate(raw?: string): string | undefined {
  if (!raw) return undefined
  const m = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (!m) return undefined
  const [, y, mo, d] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

async function parseFile(file: File): Promise<Row[]> {
  const text = await file.text()
  const table = parseCsv(text)
  if (table.length === 0) return []
  const headers = table[0]
  const iTitle = colIndex(headers, 'Title')
  const iAuthors = colIndex(headers, 'Authors')
  const iStatus = colIndex(headers, 'Read Status')
  const iRating = colIndex(headers, 'Star Rating')
  const iRead = colIndex(headers, 'Last Date Read')
  const iCount = colIndex(headers, 'Read Count')
  const iIsbn = colIndex(headers, 'ISBN/UID')
  if (iTitle < 0) return []
  const rows: Row[] = []
  for (const raw of table.slice(1)) {
    const title = raw[iTitle]?.trim()
    if (!title) continue
    const authorsRaw = iAuthors >= 0 ? raw[iAuthors]?.trim() : ''
    const authors = authorsRaw ? authorsRaw.split(/,\s*/).filter(Boolean) : []
    const statusRaw = iStatus >= 0 ? raw[iStatus]?.trim().toLowerCase() : 'read'
    const status = STATUS_MAP[statusRaw] ?? 'plan_to_read'
    const ratingRaw = iRating >= 0 ? parseFloat(raw[iRating]) : NaN
    const rating = Number.isFinite(ratingRaw) && ratingRaw > 0 ? snapHalf(ratingRaw) : undefined
    const finishedAt = iRead >= 0 ? toIsoDate(raw[iRead]) : undefined
    const readCountRaw = iCount >= 0 ? parseInt(raw[iCount], 10) : NaN
    const readCount = Number.isFinite(readCountRaw) && readCountRaw > 0 ? readCountRaw : undefined
    const isbn = iIsbn >= 0 ? raw[iIsbn]?.trim() || undefined : undefined
    rows.push({ key: keyOf(title, authors), title, authors, status, rating, finishedAt, readCount, isbn })
  }
  return rows
}

export default function StoryGraphImporter({ existingItems, onImport, onClose }: Props) {
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
        names.push(f.name)
        parsed.push(...(await parseFile(f)))
      }
      if (parsed.length === 0) { setError('No rows found. Expected the StoryGraph CSV export.'); setBusy(false); return }
      const map = new Map<string, Row>()
      for (const r of parsed) if (!map.has(r.key)) map.set(r.key, r)
      const merged = Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title))
      setRows(merged); setFileName(names.join(' · '))
      const preselected = new Set<string>()
      for (const r of merged) if (!findExisting(existingItems, r.title, r.authors)) preselected.add(r.key)
      setSelected(preselected)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const matches = useMemo(() => {
    const map = new Map<string, Item | undefined>()
    for (const r of rows) map.set(r.key, findExisting(existingItems, r.title, r.authors))
    return map
  }, [rows, existingItems])
  const dupeCount = useMemo(() => rows.reduce((n, r) => (matches.get(r.key) ? n + 1 : n), 0), [rows, matches])

  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const selectAll = () => setSelected(new Set(rows.map((r) => r.key)))
  const selectNone = () => setSelected(new Set())
  const selectNewOnly = () => setSelected(new Set(rows.filter((r) => !matches.get(r.key)).map((r) => r.key)))

  const handleImport = () => {
    if (selected.size === 0) return
    const now = Date.now()
    const newItems: Item[] = []
    for (const r of rows) {
      if (!selected.has(r.key)) continue
      newItems.push({
        id: crypto.randomUUID(),
        categoryId: 'libros',
        title: r.title,
        createdAt: now,
        consumed: r.status === 'completed',
        rating: r.rating,
        bookStatus: r.status,
        authors: r.authors.length > 0 ? r.authors : undefined,
        isbn: r.isbn,
        finishedAt: r.finishedAt,
      } as Item)
    }
    if (newItems.length > 0) onImport(newItems)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780, width: '94vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Import from StoryGraph</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Grab the CSV from StoryGraph → Profile → Manage account → Manage your data → Export.
            Ratings snap to 0.5 increments to match Omnio's scale; status maps to Omnio's book status enum.
          </p>
          <div className="importer-dropzone">
            <input type="file" accept=".csv" style={{ display: 'none' }} id="sg-file-input"
              onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }} />
            <label htmlFor="sg-file-input" className="importer-file-btn">
              {busy ? 'Reading…' : rows.length > 0 ? 'Pick different file' : '+ Pick CSV'}
            </label>
            {fileName && <span className="importer-file-list">{fileName}</span>}
          </div>
          {error && <p className="save-files-error">{error}</p>}
          {rows.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{rows.length} books</span>
                <span className="importer-new">{rows.length - dupeCount} new</span>
                <span className="importer-dupe">{dupeCount} already in library</span>
                <div className="importer-select-actions">
                  <button type="button" onClick={selectNewOnly}>Select new only</button>
                  <button type="button" onClick={selectAll}>Select all</button>
                  <button type="button" onClick={selectNone}>Select none</button>
                </div>
              </div>
              <div className="importer-table-wrap">
                <table className="importer-table">
                  <thead><tr><th style={{ width: 32 }}></th><th>Title</th><th>Authors</th><th style={{ width: 90 }}>Status</th><th style={{ width: 60 }}>Rating</th><th style={{ width: 90 }}>Match</th></tr></thead>
                  <tbody>
                    {rows.map((r) => {
                      const existing = matches.get(r.key)
                      return (
                        <tr key={r.key} className={existing ? 'dupe' : ''}>
                          <td><input type="checkbox" checked={selected.has(r.key)} onChange={() => toggle(r.key)} /></td>
                          <td>{r.title}</td>
                          <td>{r.authors.join(', ')}</td>
                          <td>{r.status}</td>
                          <td>{r.rating ? r.rating.toFixed(1) : '—'}</td>
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
              Import {selected.size} book{selected.size === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Import book highlights + notes from Kindle's "My Clippings.txt".
//
// Kindle writes every highlight, note and bookmark to a single .txt on the
// device (root of the Kindle when plugged in via USB). Entries are separated
// by a line of "==========". Each entry:
//
//   Book Title (Author Name)
//   - Your Highlight on page N | location A-B | Added on Day, Month DD, YYYY HH:MM:SS
//   [blank line]
//   The highlighted text on one or more lines.
//   ==========
//
// Note entries have "Your Note on page N | location A" and their text is the
// note body. Bookmarks have no text — we skip them. Kindle firmware
// localizes the fixed strings ("Your Highlight", "on page", "Added on") so
// we match on structure (dash prefix, pipe separators) instead of English
// keywords when possible.
//
// Grouping: entries with the same "Book Title (Author)" first line are one
// book. Author is parsed out of the trailing parenthesized part when present.
// After parsing the whole file we match each book against the existing
// library (title + author fuzzy match); per-book the user picks "merge into
// existing" or "create new".

import { useMemo, useState } from 'react'
import type { Item, Highlight } from './types'

interface Props {
  existingItems: Item[]
  onImport: (updates: { updates: Map<string, Highlight[]>; creates: Item[] }) => void
  onClose: () => void
}

type ParsedEntry = {
  text: string
  note?: string
  page?: string
  location?: string
  addedAt?: string
}

type ParsedBook = {
  key: string          // `${titleLc}::${authorLc}`
  title: string
  author?: string
  entries: ParsedEntry[]
}

// Matches page number in the metadata line: `page 42`, `página 42`, etc.
const PAGE_RE = /page\s+(\S+)|p[áa]gina\s+(\S+)|pág(?:\.|ina)?\s+(\S+)/i
// Matches location range: `location 1200-1204`, `ubicación 1200-1204`.
const LOC_RE = /location\s+([\d-]+)|ubicaci[óo]n\s+([\d-]+)|posici[óo]n\s+([\d-]+)/i
// Matches trailing date on the metadata line — Kindle formats vary by
// locale/firmware, so we grab everything after "Added on"/"Añadido" up to
// end of line and store it verbatim.
const DATE_RE = /(?:Added on|A[ñn]adido(?: el)?|Ajout[eé] le|Aggiunto il|Adicionado em)\s*(.+?)$/i
// Whether the metadata line describes a Note vs a Highlight vs a Bookmark.
const NOTE_HINT = /note|nota|remarque|annotazione/i
const BOOKMARK_HINT = /bookmark|marcador|signet|segnalibro/i

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s
}

// Splits "The Great Gatsby (Fitzgerald, F. Scott)" into title + author.
// Author is optional — some books have no parenthesized author. If there
// are multiple parenthesized groups we treat the last one as the author
// (safer against titles like "Foo (revised edition) (Someone)").
function splitTitleAuthor(line: string): { title: string; author?: string } {
  const trimmed = line.trim()
  const lastOpen = trimmed.lastIndexOf('(')
  const lastClose = trimmed.lastIndexOf(')')
  if (lastOpen > 0 && lastClose === trimmed.length - 1 && lastClose > lastOpen) {
    return {
      title: trimmed.slice(0, lastOpen).trim(),
      author: trimmed.slice(lastOpen + 1, lastClose).trim() || undefined,
    }
  }
  return { title: trimmed }
}

function parseClippings(text: string): ParsedBook[] {
  const src = stripBom(text)
  const blocks = src.split(/\n=+\s*\n?/g).map((b) => b.trim()).filter(Boolean)
  const byKey = new Map<string, ParsedBook>()
  for (const block of blocks) {
    const lines = block.split(/\r?\n/)
    if (lines.length < 2) continue
    const headLine = lines[0]
    const metaLine = lines[1]
    if (!metaLine.startsWith('-')) continue
    if (BOOKMARK_HINT.test(metaLine)) continue // bookmarks carry no text
    const { title, author } = splitTitleAuthor(headLine)
    if (!title) continue
    // Body is everything after the meta line, joined back with newlines
    // and trimmed. Some Kindle exports have a blank line between meta and
    // body; splitting on \n already handled it, we just skip the leading
    // empties.
    const bodyLines = lines.slice(2).map((l) => l.trim()).filter((l, i, arr) => {
      // Drop leading empty lines but keep interior ones for multi-paragraph highlights.
      if (l.length > 0) return true
      return arr.slice(0, i).some((x) => x.length > 0)
    })
    const body = bodyLines.join('\n').trim()
    if (!body) continue
    const isNote = NOTE_HINT.test(metaLine)
    const pageMatch = PAGE_RE.exec(metaLine)
    const page = pageMatch ? (pageMatch[1] || pageMatch[2] || pageMatch[3]) : undefined
    const locMatch = LOC_RE.exec(metaLine)
    const location = locMatch ? (locMatch[1] || locMatch[2] || locMatch[3]) : undefined
    const dateMatch = DATE_RE.exec(metaLine)
    const addedAt = dateMatch?.[1]?.trim()
    const entry: ParsedEntry = isNote
      ? { text: '', note: body, page, location, addedAt }
      : { text: body, page, location, addedAt }
    const key = `${title.toLowerCase()}::${(author ?? '').toLowerCase()}`
    if (!byKey.has(key)) byKey.set(key, { key, title, author, entries: [] })
    byKey.get(key)!.entries.push(entry)
  }
  return Array.from(byKey.values()).sort((a, b) => a.title.localeCompare(b.title))
}

// Fuzzy match against the library — case-insensitive title equality, and
// author overlap when both sides have an author. Falls back to title-only.
function findExistingBook(existing: Item[], title: string, author?: string): Item | undefined {
  const titleLc = title.toLowerCase()
  const authorLc = author?.toLowerCase()
  for (const it of existing) {
    if (it.categoryId !== 'libros') continue
    if (it.title.toLowerCase() !== titleLc) continue
    if (!authorLc) return it
    const itAuthors = (it.authors ?? []).map((a) => a.toLowerCase())
    if (itAuthors.length === 0) return it
    if (itAuthors.some((a) => a.includes(authorLc) || authorLc.includes(a))) return it
  }
  // Second pass: title-only fallback (no author on either side).
  for (const it of existing) {
    if (it.categoryId !== 'libros') continue
    if (it.title.toLowerCase() === titleLc) return it
  }
  return undefined
}

type Action = 'merge' | 'create' | 'skip'

export default function HighlightsImporter({ existingItems, onImport, onClose }: Props) {
  const [books, setBooks] = useState<ParsedBook[]>([])
  const [actions, setActions] = useState<Record<string, Action>>({})
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const matches = useMemo(() => {
    const map = new Map<string, Item | undefined>()
    for (const b of books) map.set(b.key, findExistingBook(existingItems, b.title, b.author))
    return map
  }, [books, existingItems])

  const handleFile = async (file: File) => {
    setError(null)
    setBusy(true)
    try {
      const text = await file.text()
      const parsed = parseClippings(text)
      if (parsed.length === 0) {
        setError('No highlights or notes found. Point at your Kindle\'s My Clippings.txt.')
        setBusy(false)
        return
      }
      setBooks(parsed)
      setFileName(file.name)
      // Default action per book: merge if we found a match, else create.
      const init: Record<string, Action> = {}
      for (const b of parsed) init[b.key] = findExistingBook(existingItems, b.title, b.author) ? 'merge' : 'create'
      setActions(init)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const setAction = (key: string, a: Action) => setActions((s) => ({ ...s, [key]: a }))

  const summary = useMemo(() => {
    let toMerge = 0
    let toCreate = 0
    let entries = 0
    for (const b of books) {
      const a = actions[b.key]
      if (a === 'skip') continue
      entries += b.entries.length
      if (a === 'merge') toMerge++
      else if (a === 'create') toCreate++
    }
    return { toMerge, toCreate, entries }
  }, [books, actions])

  const handleImport = () => {
    const updates = new Map<string, Highlight[]>() // itemId -> new highlights to append
    const creates: Item[] = []
    const now = Date.now()
    for (const b of books) {
      const action = actions[b.key]
      if (action === 'skip') continue
      const asHighlights: Highlight[] = b.entries.map((e) => ({
        id: crypto.randomUUID(),
        text: e.text,
        note: e.note,
        page: e.page,
        location: e.location,
        addedAt: e.addedAt,
      }))
      if (action === 'merge') {
        const match = matches.get(b.key)
        if (!match) continue
        // Preserve any existing highlights + append new. Dedupe by (text, location)
        // so re-importing the same clippings file doesn't double up.
        const existing = match.highlights ?? []
        const seen = new Set(existing.map((h) => `${h.text}::${h.location ?? ''}`))
        const filtered = asHighlights.filter((h) => !seen.has(`${h.text}::${h.location ?? ''}`))
        if (filtered.length > 0) updates.set(match.id, [...existing, ...filtered])
      } else if (action === 'create') {
        creates.push({
          id: crypto.randomUUID(),
          categoryId: 'libros',
          title: b.title,
          authors: b.author ? [b.author] : undefined,
          createdAt: now,
          highlights: asHighlights,
        })
      }
    }
    onImport({ updates, creates })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel highlights-importer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780, width: '94vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Import Kindle highlights</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Plug your Kindle in via USB and drop <code>documents/My Clippings.txt</code> here. Every
            highlight and note gets parsed, grouped by book, and matched against your library. Per book
            you choose to merge into the existing entry or create a new one. Bookmarks are skipped
            (they carry no text).
          </p>

          <div className="importer-dropzone">
            <input
              type="file"
              accept=".txt"
              style={{ display: 'none' }}
              id="highlights-file-input"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />
            <label htmlFor="highlights-file-input" className="importer-file-btn">
              {busy ? 'Reading…' : books.length > 0 ? 'Pick different file' : '+ Pick My Clippings.txt'}
            </label>
            {fileName && <span className="importer-file-list">{fileName}</span>}
          </div>

          {error && <p className="save-files-error">{error}</p>}

          {books.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{books.length} book{books.length === 1 ? '' : 's'} parsed · {books.reduce((s, b) => s + b.entries.length, 0)} entries</span>
                <span className="importer-new">{summary.toCreate} to create</span>
                <span className="importer-dupe">{summary.toMerge} to merge</span>
              </div>

              <div className="importer-table-wrap">
                <table className="importer-table highlights-table">
                  <thead>
                    <tr>
                      <th>Book</th>
                      <th style={{ width: 90 }}>Entries</th>
                      <th style={{ width: 180 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((b) => {
                      const match = matches.get(b.key)
                      const action = actions[b.key] ?? 'skip'
                      return (
                        <tr key={b.key}>
                          <td>
                            <div className="hl-book-title">{b.title}</div>
                            {b.author && <div className="hl-book-author">{b.author}</div>}
                            {match && <div className="hl-book-match">→ matches "{match.title}"</div>}
                          </td>
                          <td>{b.entries.length}</td>
                          <td>
                            <select value={action} onChange={(e) => setAction(b.key, e.target.value as Action)}>
                              {match && <option value="merge">Merge into existing</option>}
                              <option value="create">Create new book</option>
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
        {books.length > 0 && (
          <div className="modal-footer">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="primary-btn"
              disabled={summary.toMerge + summary.toCreate === 0}
              onClick={handleImport}
            >
              Import {summary.entries} entr{summary.entries === 1 ? 'y' : 'ies'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

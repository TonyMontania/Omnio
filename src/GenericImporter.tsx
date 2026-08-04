// Bulk import from Excel (.xlsx / .xls), CSV (including Notion database
// exports) and plain .txt (one title per line). Companion to MalImporter,
// which handles the MyAnimeList / AniList XML format specifically.
//
// Flow:
//   1. User picks a file. We sniff the extension and route to the right
//      parser: SheetJS for xlsx/xls, hand-rolled CSV for csv/tsv, one line
//      per title for txt.
//   2. Rows are shown with detected headers plus a column-mapping UI. Common
//      names (title, rating, status, tags, notes, year) are auto-mapped.
//   3. User picks the target library and confirms. Each row becomes an Item
//      with the mapped fields; unmapped columns are dropped silently.
//
// txt files skip step 2 — the whole line is the title.

import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import type { Item } from './types'
import { CATEGORIES } from './categories'
import { parseCsv } from './utils/csv'
import {
  GAME_STATUS_OPTIONS, MANGA_STATUS_OPTIONS,
  ANIME_STATUS_OPTIONS, SERIES_STATUS_OPTIONS,
  BOOK_STATUS_OPTIONS,
} from './types'

interface Props {
  existingItems: Item[]
  onImport: (items: Item[]) => void
  onClose: () => void
}

type FieldTarget =
  | 'ignore' | 'title' | 'rating' | 'notes' | 'tags' | 'genres'
  | 'status' | 'releaseYear' | 'releaseDate' | 'artist' | 'devs'
  | 'publishers' | 'platforms' | 'directors' | 'cast'
  | 'chaptersRead' | 'episodesWatched' | 'playTime'
  | 'authors' | 'publisher' | 'saga' | 'sagaIndex' | 'pagesRead' | 'totalPages' | 'isbn'

// Auto-detect header -> field mapping. Match on lower-cased, punctuation-
// stripped column name.
const HEADER_ALIASES: Record<FieldTarget, string[]> = {
  ignore: [],
  title: ['title', 'name', 'nombre', 'titulo', 'series', 'game', 'movie', 'album'],
  rating: ['rating', 'score', 'stars', 'puntuacion', 'nota', 'my rating', 'my score'],
  notes: ['notes', 'note', 'comment', 'comments', 'my notes', 'observaciones'],
  tags: ['tags', 'tag', 'labels', 'etiquetas'],
  genres: ['genre', 'genres', 'genero', 'generos', 'category', 'categorias'],
  status: ['status', 'estado', 'progress', 'state'],
  releaseYear: ['year', 'ano', 'release year', 'anio'],
  releaseDate: ['release', 'released', 'release date', 'date', 'fecha'],
  artist: ['artist', 'artists', 'band', 'artista'],
  devs: ['developer', 'developers', 'dev', 'devs', 'estudio'],
  publishers: ['publisher', 'publishers', 'editor', 'editores'],
  platforms: ['platform', 'platforms', 'plataforma', 'plataformas'],
  directors: ['director', 'directors', 'director(s)'],
  cast: ['cast', 'actors', 'starring', 'reparto'],
  chaptersRead: ['chapters read', 'chapter', 'chapters', 'capitulos'],
  episodesWatched: ['episodes watched', 'episode', 'episodes', 'episodios'],
  playTime: ['playtime', 'time played', 'hours', 'horas'],
  authors: ['author', 'authors', 'autor', 'autores', 'by', 'writer'],
  // Playnite export uses: Name, Platform(s), Genre(s), Playtime, Source,
  // Developer(s), Publisher(s), CompletionStatus, ReleaseDate, LastActivity.
  // GOG Galaxy: Title, Platform, Playtime, Rating.
  // Header aliases above already cover title / platforms / devs /
  // publishers / genres / playtime / releaseDate / rating / status.
  publisher: ['publisher', 'publishers', 'editorial', 'editor', 'publisher s'],
  saga: ['saga', 'series', 'collection'],
  sagaIndex: ['book number', 'volume number', 'series index', 'book in series', 'n in series'],
  pagesRead: ['pages read', 'pagina', 'paginas leidas', 'read pages'],
  totalPages: ['pages', 'total pages', 'page count', 'paginas', 'num pages'],
  isbn: ['isbn', 'isbn 10', 'isbn 13', 'isbn10', 'isbn13'],
}

function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function autoMap(header: string): FieldTarget {
  const n = normalizeHeader(header)
  for (const [target, aliases] of Object.entries(HEADER_ALIASES) as [FieldTarget, string[]][]) {
    if (aliases.includes(n)) return target
  }
  return 'ignore'
}

// CSV parsing lives in utils/csv.ts — shared with LetterboxdImporter,
// LastfmImporter, and any future CSV importer.

interface ParsedTable {
  headers: string[]
  rows: string[][]
  format: 'xlsx' | 'csv' | 'txt'
}

async function parseFile(file: File): Promise<{ table?: ParsedTable; error?: string }> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt')) {
    const txt = await file.text()
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    return { table: { headers: ['title'], rows: lines.map((l) => [l]), format: 'txt' } }
  }
  if (name.endsWith('.csv') || name.endsWith('.tsv')) {
    const txt = await file.text()
    const delim = name.endsWith('.tsv') ? '\t' : ','
    const rows = parseCsv(txt, delim)
    if (rows.length === 0) return { error: 'The CSV file is empty.' }
    return { table: { headers: rows[0], rows: rows.slice(1), format: 'csv' } }
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm')) {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return { error: 'The Excel file has no sheets.' }
    const sheet = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, defval: '' }) as unknown[][]
    if (rows.length === 0) return { error: 'The Excel sheet is empty.' }
    return {
      table: {
        headers: rows[0].map((v) => String(v ?? '').trim()),
        rows: rows.slice(1).map((r) => r.map((v) => String(v ?? '').trim())),
        format: 'xlsx',
      },
    }
  }
  return { error: 'Unsupported file. Pick a .xlsx, .csv, .tsv or .txt file.' }
}

// External-tracker status vocabulary → Omnio's internal enum. Playnite
// uses NotPlayed / Played / Beaten / Completed / Playing / Abandoned /
// OnHold / Plan to Play. Goodreads uses to-read / currently-reading /
// read. Handled here so imports don't need per-tool presets.
const STATUS_ALIASES: Record<string, Record<string, string>> = {
  videojuegos: {
    'not played': 'backlog', 'plan to play': 'backlog', 'wishlist': 'backlog',
    'playing': 'playing', 'currently playing': 'playing',
    'played': 'played', 'beaten': 'played', 'finished': 'completed',
    'completed': 'completed', '100%': 'completed',
    'abandoned': 'dropped', 'on hold': 'played', 'shelved': 'played',
  },
  libros: {
    'to read': 'plan_to_read', 'to-read': 'plan_to_read', 'want to read': 'plan_to_read',
    'currently reading': 'reading', 'currently-reading': 'reading', 'reading': 'reading',
    'read': 'completed', 'finished': 'completed',
    'did not finish': 'dropped', 'dnf': 'dropped',
  },
  anime: { 'watching': 'watching', 'plan to watch': 'plan_to_watch', 'on-hold': 'paused', 'on hold': 'paused' },
  manga:  { 'reading': 'reading', 'plan to read': 'plan_to_read', 'on-hold': 'paused', 'on hold': 'paused' },
}

function mapStatus(raw: string, categoryId: string): string | undefined {
  const n = raw.toLowerCase().trim()
  if (!n) return undefined
  const aliasMap = STATUS_ALIASES[categoryId] ?? STATUS_ALIASES[categoryId === 'donghua' ? 'anime' : categoryId === 'manhwa' || categoryId === 'manhua' || categoryId === 'comics_west' ? 'manga' : '']
  if (aliasMap && aliasMap[n]) return aliasMap[n]
  const opts = categoryId === 'videojuegos' ? GAME_STATUS_OPTIONS
    : categoryId === 'anime' || categoryId === 'donghua' ? ANIME_STATUS_OPTIONS
    : categoryId === 'series' ? SERIES_STATUS_OPTIONS
    : categoryId === 'libros' ? BOOK_STATUS_OPTIONS
    : MANGA_STATUS_OPTIONS
  const hit = opts.find((o) => o.value.toLowerCase() === n || o.label.toLowerCase() === n)
  return hit?.value
}

function toItem(row: string[], mapping: FieldTarget[], categoryId: string): Item | null {
  const get = (target: FieldTarget) => {
    const idx = mapping.indexOf(target)
    return idx >= 0 ? (row[idx] ?? '').trim() : ''
  }
  const title = get('title')
  if (!title) return null
  const rating = parseFloat(get('rating'))
  const item: Partial<Item> = {
    id: crypto.randomUUID(),
    categoryId,
    title,
    createdAt: Date.now(),
  }
  if (!Number.isNaN(rating) && rating > 0) item.rating = Math.min(5, rating)
  const notes = get('notes'); if (notes) item.notes = notes
  const tags = get('tags'); if (tags) item.tags = tags.split(/[,;|]/).map((t) => t.trim()).filter(Boolean)
  const genres = get('genres'); if (genres) item.genres = genres.split(/[,;|]/).map((g) => g.trim()).filter(Boolean)
  const year = get('releaseYear'); if (year) item.releaseYear = year
  const date = get('releaseDate'); if (date && /^\d{4}-\d{2}-\d{2}/.test(date)) item.releaseDate = date.slice(0, 10)
  const artist = get('artist'); if (artist) item.artist = artist
  const devs = get('devs'); if (devs) item.devs = devs.split(/[,;|]/).map((d) => d.trim()).filter(Boolean)
  const publishers = get('publishers'); if (publishers) item.publishers = publishers.split(/[,;|]/).map((p) => p.trim()).filter(Boolean)
  const platforms = get('platforms'); if (platforms) item.platforms = platforms.split(/[,;|]/).map((p) => p.trim()).filter(Boolean)
  const directors = get('directors'); if (directors) item.directors = directors.split(/[,;|]/).map((d) => d.trim()).filter(Boolean)
  const cast = get('cast'); if (cast) item.cast = cast.split(/[,;|]/).map((c) => c.trim()).filter(Boolean)
  const chaptersRead = get('chaptersRead'); if (chaptersRead) item.chaptersRead = chaptersRead
  const episodesWatched = get('episodesWatched'); if (episodesWatched) item.episodesWatched = episodesWatched
  const playTime = get('playTime'); if (playTime) item.playTime = playTime
  // Book-specific fields — authors reuse the manga authors[] slot so
  // Books share the "list of writers" pattern with manga cleanly.
  const authors = get('authors'); if (authors) item.authors = authors.split(/[,;|]/).map((a) => a.trim()).filter(Boolean)
  const publisher = get('publisher'); if (publisher) item.publisher = publisher
  const saga = get('saga'); if (saga) item.saga = saga
  const sagaIndex = get('sagaIndex'); if (sagaIndex) item.sagaIndex = sagaIndex
  const pagesRead = get('pagesRead'); if (pagesRead) item.pagesRead = pagesRead
  const totalPages = get('totalPages'); if (totalPages) item.totalPages = totalPages
  const isbn = get('isbn'); if (isbn) item.isbn = isbn

  const statusRaw = get('status')
  if (statusRaw) {
    const mapped = mapStatus(statusRaw, categoryId)
    if (mapped) {
      if (categoryId === 'videojuegos') item.gameStatus = mapped as Item['gameStatus']
      else if (categoryId === 'anime' || categoryId === 'donghua') item.watchStatus = mapped as Item['watchStatus']
      else if (categoryId === 'series') item.seriesStatus = mapped as Item['seriesStatus']
      else if (categoryId === 'libros') item.bookStatus = mapped as Item['bookStatus']
      else item.mangaStatus = mapped as Item['mangaStatus']
    }
  }
  return item as Item
}

const FIELD_LABELS: Record<FieldTarget, string> = {
  ignore: '— Ignore column —',
  title: 'Title',
  rating: 'Rating (0-5)',
  notes: 'Notes',
  tags: 'Tags (comma-separated)',
  genres: 'Genres (comma-separated)',
  status: 'Status',
  releaseYear: 'Release year',
  releaseDate: 'Release date (YYYY-MM-DD)',
  artist: 'Artist',
  devs: 'Developers',
  publishers: 'Publishers',
  platforms: 'Platforms',
  directors: 'Directors',
  cast: 'Cast',
  chaptersRead: 'Chapters read',
  episodesWatched: 'Episodes watched',
  playTime: 'Time played',
  authors: 'Authors',
  publisher: 'Publisher',
  saga: 'Series / saga',
  sagaIndex: 'Book # in series',
  pagesRead: 'Pages read',
  totalPages: 'Total pages',
  isbn: 'ISBN',
}

export default function GenericImporter({ existingItems, onImport, onClose }: Props) {
  const [table, setTable] = useState<ParsedTable | null>(null)
  const [filename, setFilename] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mapping, setMapping] = useState<FieldTarget[]>([])
  const [targetCategory, setTargetCategory] = useState(CATEGORIES[0].id)
  const [skipExisting, setSkipExisting] = useState(true)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null); setTable(null)
    const f = e.target.files?.[0]
    if (!f) return
    setFilename(f.name)
    const r = await parseFile(f)
    if (r.error || !r.table) { setError(r.error ?? 'Parse failed'); return }
    setTable(r.table)
    setMapping(r.table.headers.map(autoMap))
  }

  const preview = useMemo(() => (table ? table.rows.slice(0, 5) : []), [table])
  const parsedItems = useMemo(() => {
    if (!table) return []
    return table.rows.map((r) => toItem(r, mapping, targetCategory)).filter((i): i is Item => i !== null)
  }, [table, mapping, targetCategory])
  const existingKeys = useMemo(() => {
    const s = new Set<string>()
    for (const it of existingItems) s.add(`${it.categoryId}::${it.title.toLowerCase().trim()}`)
    return s
  }, [existingItems])
  const readyItems = useMemo(() => {
    if (!skipExisting) return parsedItems
    return parsedItems.filter((i) => !existingKeys.has(`${i.categoryId}::${i.title.toLowerCase().trim()}`))
  }, [parsedItems, skipExisting, existingKeys])
  const dupCount = parsedItems.length - readyItems.length

  const doImport = () => { onImport(readyItems); onClose() }

  const hasTitle = mapping.includes('title')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel fetch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import from Excel · CSV · Notion · TXT</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Supported formats: <code>.xlsx</code> · <code>.xls</code> · <code>.csv</code> · <code>.tsv</code> · <code>.txt</code>.
            Notion databases export as CSV (Export → CSV) and work as-is. TXT files should have one title per line —
            no columns to map.
          </p>
          <label className="upload-btn" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
            {filename ? `Selected: ${filename}` : 'Choose file…'}
            <input type="file" accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt" style={{ display: 'none' }} onChange={handleFile} />
          </label>
          {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}
          {table && (
            <>
              <div className="field-group">
                <label>Target library</label>
                <select value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              {table.format !== 'txt' && (
                <div className="import-mapping">
                  <span className="import-mapping-label">Column mapping ({table.headers.length} columns, {table.rows.length} rows)</span>
                  <div className="import-mapping-grid">
                    {table.headers.map((h, idx) => (
                      <div key={idx} className="import-mapping-row">
                        <span className="import-mapping-col">{h || <em>(unnamed)</em>}</span>
                        <select
                          value={mapping[idx] ?? 'ignore'}
                          onChange={(e) => setMapping((prev) => prev.map((v, i) => i === idx ? e.target.value as FieldTarget : v))}
                        >
                          {(Object.keys(FIELD_LABELS) as FieldTarget[]).map((f) => (
                            <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.length > 0 && (
                <div className="import-preview">
                  <span className="import-mapping-label">Preview (first 5 rows)</span>
                  <div className="import-preview-scroll">
                    <table className="import-preview-table">
                      <thead>
                        <tr>{table.headers.map((h, i) => <th key={i}>{h || `col ${i + 1}`}</th>)}</tr>
                      </thead>
                      <tbody>
                        {preview.map((r, ri) => (
                          <tr key={ri}>{r.map((c, ci) => <td key={ci}>{c || <span className="hint">—</span>}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <label className="mal-skip" style={{ marginTop: 8 }}>
                <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
                Skip titles already in the target library (case-insensitive match)
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
                <button type="button" onClick={doImport} disabled={!hasTitle || readyItems.length === 0}
                  style={{ background: 'var(--accent)', color: '#1a1408', padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600 }}>
                  Import {readyItems.length} items
                </button>
                {dupCount > 0 && <span className="hint">{dupCount} skipped as duplicates</span>}
              </div>
              {!hasTitle && <p className="hint" style={{ color: 'var(--danger)' }}>Map at least one column to <em>Title</em>.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

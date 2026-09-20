// FTS5 PoC — in-memory SQLite index built at runtime from the JSON
// items. Used only by the "SQLite Search" modal (Ctrl+Shift+F) so we
// can compare BM25-ranked full-text search across every long-text
// field to the current Ctrl+K palette that only matches titles/tags.
//
// The JSON on disk stays the source of truth. Nothing here writes back.
// Rebuilt lazily on first query and whenever the caller passes a new
// items reference — cheap for ~1k rows (~150ms on a warm laptop).

import initSqlJs from 'sql.js'
import type { Database, SqlJsStatic, QueryExecResult } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import type { AnyItem } from '../types/entities'
import { CATEGORIES } from '../categories'

// Fields we want FTS5 to consider. Each category exposes a different
// mix — the shape is loose so we can walk every item without a switch
// per category. The `rowid` column FTS5 auto-populates from insert
// order maps back to `itemId` via a side-table below.
export interface FtsHit {
  itemId: string
  title: string
  categoryLabel: string
  score: number       // BM25 rank (lower = better in sqlite); we invert to positive-is-better for readability
  snippet: string     // FTS5 snippet() output with <mark></mark> around the match
  matchedFields: string[]
}

let SQL: SqlJsStatic | null = null
let db: Database | null = null
let sourceRef: AnyItem[] | null = null
let buildMs = 0
let indexedRows = 0

async function ensureSql(): Promise<SqlJsStatic> {
  if (SQL) return SQL
  SQL = await initSqlJs({ locateFile: () => wasmUrl })
  return SQL
}

function pluckString(item: AnyItem, key: string): string {
  const v = (item as unknown as Record<string, unknown>)[key]
  return typeof v === 'string' ? v : ''
}
// Some categories keep alternate titles in a string array — join with
// a separator so FTS5 treats them as extra searchable tokens on the
// title column without confusing tokenization.
function joinStringArray(item: AnyItem, key: string): string {
  const v = (item as unknown as Record<string, unknown>)[key]
  if (!Array.isArray(v)) return ''
  return v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).join(' · ')
}

// Concatenate every field into one FTS5-searchable blob. We also keep
// each field as its own column so snippet() can hint which one matched.
export async function buildIndex(items: AnyItem[]): Promise<{ ms: number; rows: number }> {
  const sql = await ensureSql()
  const start = performance.now()
  if (db) db.close()
  db = new sql.Database()
  db.exec(`
    CREATE VIRTUAL TABLE items USING fts5(
      title, original_title, description, notes,
      review, listening_note,
      tokenize = 'unicode61 remove_diacritics 2'
    );
    CREATE TABLE meta (rowid INTEGER PRIMARY KEY, item_id TEXT NOT NULL, category_id TEXT NOT NULL);
  `)
  const insertItem = db.prepare(
    'INSERT INTO items(rowid, title, original_title, description, notes, review, listening_note) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  const insertMeta = db.prepare('INSERT INTO meta(rowid, item_id, category_id) VALUES (?, ?, ?)')
  db.exec('BEGIN')
  let rowid = 1
  for (const it of items) {
    const title = pluckString(it, 'title')
    const original = [joinStringArray(it, 'alternativeTitles'), joinStringArray(it, 'vnAliases')]
      .filter(Boolean).join(' · ')
    const description = pluckString(it, 'description')
    const notes = pluckString(it, 'notes')
    // Review lives in a different key per category — coalesce them.
    const review = (
      pluckString(it, 'gameReview') || pluckString(it, 'animeReview')
      || pluckString(it, 'seriesReview') || pluckString(it, 'musicReview')
      || pluckString(it, 'mangaReview') || pluckString(it, 'movieReview')
      || pluckString(it, 'bookReview') || pluckString(it, 'vnReview')
    )
    const listeningNote = pluckString(it, 'listeningNote')
    // Empty rows still get inserted so BM25 normalization stays honest.
    insertItem.run([rowid, title, original, description, notes, review, listeningNote])
    insertMeta.run([rowid, it.id, it.categoryId])
    rowid += 1
  }
  db.exec('COMMIT')
  insertItem.free()
  insertMeta.free()
  sourceRef = items
  buildMs = performance.now() - start
  indexedRows = items.length
  return { ms: buildMs, rows: indexedRows }
}

// FTS5 accepts MATCH queries directly. We strip obvious punctuation so
// pasted queries don't blow up the parser (a stray colon is enough).
// Words become prefix matches (word*) so partial typing finds hits.
function normalizeQuery(raw: string): string {
  const cleaned = raw
    .replace(/["(){}\[\]:*^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  return cleaned.split(' ').filter(Boolean).map((t) => `${t}*`).join(' ')
}

export interface QueryOptions {
  limit?: number
  categoryFilter?: string  // categoryId to restrict to; omitted = all
}

export async function query(raw: string, opts: QueryOptions = {}): Promise<FtsHit[]> {
  if (!db) return []
  const q = normalizeQuery(raw)
  if (!q) return []
  const limit = opts.limit ?? 25
  const sql = `
    SELECT m.item_id AS item_id,
           m.category_id AS category_id,
           bm25(items) AS rank,
           snippet(items, -1, '<mark>', '</mark>', '…', 12) AS snippet,
           items.title AS title,
           items.original_title AS original_title,
           items.description AS description,
           items.notes AS notes,
           items.review AS review,
           items.listening_note AS listening_note
    FROM items
    JOIN meta m ON m.rowid = items.rowid
    WHERE items MATCH ?
      ${opts.categoryFilter ? 'AND m.category_id = ?' : ''}
    ORDER BY rank
    LIMIT ?
  `
  const params: (string | number)[] = opts.categoryFilter
    ? [q, opts.categoryFilter, limit]
    : [q, limit]
  const res: QueryExecResult[] = db.exec(sql, params)
  if (res.length === 0) return []
  const [{ columns, values }] = res
  const idx = Object.fromEntries(columns.map((c, i) => [c, i]))
  const hits: FtsHit[] = []
  for (const row of values) {
    const itemId = row[idx.item_id] as string
    const categoryId = row[idx.category_id] as string
    const cat = CATEGORIES.find((c) => c.id === categoryId)
    const matched: string[] = []
    const rawQueryTokens = raw.toLowerCase().split(/\s+/).filter(Boolean)
    const check = (fieldName: string, val: unknown) => {
      if (typeof val !== 'string' || !val) return
      const low = val.toLowerCase()
      if (rawQueryTokens.some((t) => t && low.includes(t))) matched.push(fieldName)
    }
    check('title', row[idx.title])
    check('altTitles', row[idx.original_title])
    check('description', row[idx.description])
    check('notes', row[idx.notes])
    check('review', row[idx.review])
    check('listeningNote', row[idx.listening_note])
    hits.push({
      itemId,
      title: (row[idx.title] as string) || '(untitled)',
      categoryLabel: cat?.label ?? categoryId,
      score: -Number(row[idx.rank]),
      snippet: (row[idx.snippet] as string) || '',
      matchedFields: matched,
    })
  }
  return hits
}

export function getIndexStats(): { built: boolean; rows: number; buildMs: number; sourceRef: AnyItem[] | null } {
  return { built: !!db, rows: indexedRows, buildMs, sourceRef }
}

// Command-palette-style global search. Ctrl+K anywhere in the app.
// Searches every item by title, artist, alternative titles, tags — grouped
// by category. Enter opens the highlighted result; arrows navigate.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Item, MusicArtist } from './types'
import { assetSrc } from './types'
import { CATEGORIES } from './categories'

interface Props {
  open: boolean
  items: Item[]
  artists: MusicArtist[]
  onClose: () => void
  onOpenItem: (item: Item) => void
  onOpenArtist: (artist: MusicArtist) => void
}

interface Hit {
  kind: 'item' | 'artist'
  item?: Item
  artist?: MusicArtist
  score: number
  matched: string
}

// Parse operator tokens ("status:completed", "year:2024", "rating:>4",
// "tag:jrpg", "category:games", "favorite:true") out of the raw query
// and return the remaining free text separately. Order-independent;
// unknown operators are treated as free text.
interface ParsedQuery {
  text: string
  status?: string
  year?: number
  yearOp?: '=' | '>' | '<' | '>=' | '<='
  rating?: number
  ratingOp?: '=' | '>' | '<' | '>=' | '<='
  tag?: string
  category?: string
  favorite?: boolean
}
function parseQuery(raw: string): ParsedQuery {
  const parsed: ParsedQuery = { text: '' }
  const remaining: string[] = []
  for (const tok of raw.trim().split(/\s+/)) {
    const m = /^([a-z]+):(.+)$/i.exec(tok)
    if (!m) { remaining.push(tok); continue }
    const key = m[1].toLowerCase()
    const val = m[2]
    if (key === 'status') parsed.status = val.toLowerCase()
    else if (key === 'tag') parsed.tag = val.toLowerCase()
    else if (key === 'category' || key === 'cat') parsed.category = val.toLowerCase()
    else if (key === 'favorite' || key === 'fav') parsed.favorite = /^(1|true|yes|y|on)$/i.test(val)
    else if (key === 'year' || key === 'rating') {
      const num = /^([<>]=?)?(\d+(?:\.\d+)?)$/.exec(val)
      if (!num) { remaining.push(tok); continue }
      const op = (num[1] ?? '=') as '=' | '>' | '<' | '>=' | '<='
      if (key === 'year') { parsed.year = Number(num[2]); parsed.yearOp = op }
      else { parsed.rating = Number(num[2]); parsed.ratingOp = op }
    }
    else remaining.push(tok)
  }
  parsed.text = remaining.join(' ')
  return parsed
}

// Test a numeric field against a query operator. Missing values fail
// any numeric constraint by default (a rating filter never matches
// unrated items).
function numOk(v: number | undefined, op: '=' | '>' | '<' | '>=' | '<=' | undefined, target: number | undefined): boolean {
  if (target === undefined || op === undefined) return true
  if (v === undefined) return false
  switch (op) {
    case '=':  return v === target
    case '>':  return v > target
    case '<':  return v < target
    case '>=': return v >= target
    case '<=': return v <= target
  }
}

// Best-effort status string across category-specific fields.
function itemStatus(item: Item): string | undefined {
  return (item.gameStatus || item.mangaStatus || item.watchStatus || item.seriesStatus || item.bookStatus || undefined)?.toLowerCase()
}

function itemYear(item: Item): number | undefined {
  if (item.releaseDate) {
    const m = /^(\d{4})/.exec(item.releaseDate)
    if (m) return Number(m[1])
  }
  if (item.releaseYear) {
    const n = Number(item.releaseYear)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

// Return null when any operator filter excludes this item; otherwise
// return the free-text score (with fallback score = 60 when there's
// no free text but every operator matched).
function scoreItem(item: Item, parsed: ParsedQuery): { score: number; matched: string } | null {
  if (parsed.status && itemStatus(item) !== parsed.status) return null
  if (parsed.tag && !(item.tags?.some((t) => t.toLowerCase() === parsed.tag))) return null
  if (parsed.category && item.categoryId.toLowerCase() !== parsed.category) return null
  if (parsed.favorite !== undefined && Boolean(item.favorite) !== parsed.favorite) return null
  if (!numOk(itemYear(item), parsed.yearOp, parsed.year)) return null
  if (!numOk(item.rating, parsed.ratingOp, parsed.rating)) return null

  const q = parsed.text.trim()
  if (!q) return { score: 60, matched: 'filter' }   // pure-operator query
  const nq = q.toLowerCase()
  const t = item.title.toLowerCase()
  if (t === nq) return { score: 100, matched: 'title' }
  if (t.startsWith(nq)) return { score: 90, matched: 'title' }
  if (t.includes(nq)) return { score: 70, matched: 'title' }
  if (item.artist && item.artist.toLowerCase().includes(nq)) return { score: 50, matched: 'artist' }
  const altHit = item.alternativeTitles?.some((a) => a.toLowerCase().includes(nq))
  if (altHit) return { score: 45, matched: 'alt title' }
  const tagHit = item.tags?.some((tg) => tg.toLowerCase().includes(nq))
  if (tagHit) return { score: 25, matched: 'tag' }
  return null
}

function scoreArtist(a: MusicArtist, q: string): { score: number; matched: string } | null {
  const nq = q.toLowerCase()
  const n = a.name.toLowerCase()
  if (n === nq) return { score: 100, matched: 'name' }
  if (n.startsWith(nq)) return { score: 88, matched: 'name' }
  if (n.includes(nq)) return { score: 68, matched: 'name' }
  const genreHit = a.genres?.some((g) => g.toLowerCase().includes(nq))
  if (genreHit) return { score: 30, matched: 'genre' }
  return null
}

export default function GlobalSearch({ open, items, artists, onClose, onOpenItem, onOpenArtist }: Props) {
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const hits: Hit[] = useMemo(() => {
    if (!q.trim()) return []
    const parsed = parseQuery(q)
    // If nothing was typed at all (empty free-text AND no operators),
    // don't flood the list with everything.
    if (!parsed.text.trim() && parsed.status === undefined && parsed.year === undefined && parsed.rating === undefined && parsed.tag === undefined && parsed.category === undefined && parsed.favorite === undefined) {
      return []
    }
    const results: Hit[] = []
    for (const it of items) {
      const s = scoreItem(it, parsed)
      if (s) results.push({ kind: 'item', item: it, score: s.score, matched: s.matched })
    }
    // Artists don't match operator filters (no status/rating on an
    // artist), so only surface them when the query has free-text.
    if (parsed.text.trim()) {
      for (const a of artists) {
        const s = scoreArtist(a, parsed.text.trim())
        if (s) results.push({ kind: 'artist', artist: a, score: s.score, matched: s.matched })
      }
    }
    results.sort((a, b) => b.score - a.score || (a.item?.title || a.artist?.name || '').localeCompare(b.item?.title || b.artist?.name || ''))
    return results.slice(0, 40)
  }, [q, items, artists])

  useEffect(() => { setCursor(0) }, [q])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector(`[data-hit-idx="${cursor}"]`) as HTMLElement | null
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [cursor, open])

  const activate = (h: Hit) => {
    if (h.kind === 'item' && h.item) onOpenItem(h.item)
    else if (h.kind === 'artist' && h.artist) onOpenArtist(h.artist)
    onClose()
  }

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(hits.length - 1, c + 1)) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)) }
    else if (e.key === 'Enter' && hits[cursor]) { e.preventDefault(); activate(hits[cursor]) }
  }

  const grouped: Record<string, Hit[]> = {}
  for (const h of hits) {
    const key = h.kind === 'artist' ? '_artists' : (h.item?.categoryId ?? 'other')
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(h)
  }
  const groupLabel = (k: string) => k === '_artists' ? 'Artists' : (CATEGORIES.find((c) => c.id === k)?.label ?? k)

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk-panel" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="cmdk-input-row">
          <span className="cmdk-search-icon" aria-hidden>⌕</span>
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Search everything…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <kbd className="cmdk-kbd">Esc</kbd>
        </div>
        <div className="cmdk-results" ref={listRef}>
          {!q.trim() && (
            <div className="cmdk-hint">
              <p style={{ margin: '0 0 8px' }}>Search across every library — titles, artists, alt titles, tags.</p>
              <p style={{ margin: 0, fontSize: 11.5 }}>
                Operators: <code>status:completed</code>, <code>year:2024</code>, <code>year:&gt;2020</code>,
                &nbsp;<code>rating:&gt;=4</code>, <code>tag:jrpg</code>, <code>category:musica</code>,
                &nbsp;<code>favorite:true</code>. Combine freely with free-text.
              </p>
            </div>
          )}
          {q.trim() && hits.length === 0 && (
            <p className="cmdk-hint">No matches.</p>
          )}
          {Object.entries(grouped).map(([groupKey, groupHits]) => (
            <div key={groupKey} className="cmdk-group">
              <div className="cmdk-group-label">{groupLabel(groupKey)}</div>
              {groupHits.map((h) => {
                const idx = hits.indexOf(h)
                const it = h.item
                const ar = h.artist
                const label = it?.title ?? ar?.name ?? ''
                const sub = it
                  ? [it.artist, it.releaseYear, it.releaseDate ? new Date(it.releaseDate).getFullYear() : null]
                      .filter(Boolean).join(' · ')
                  : (ar?.origin || 'Artist')
                const cover = assetSrc(it?.cover ?? ar?.photo)
                return (
                  <button
                    key={`${h.kind}-${it?.id ?? ar?.id}`}
                    data-hit-idx={idx}
                    className={`cmdk-hit ${idx === cursor ? 'active' : ''}`}
                    onMouseEnter={() => setCursor(idx)}
                    onClick={() => activate(h)}
                  >
                    <div className="cmdk-thumb">
                      {cover ? <img src={cover} alt="" /> : <span>{label.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="cmdk-hit-text">
                      <div className="cmdk-hit-title">{label}</div>
                      <div className="cmdk-hit-sub">{sub}</div>
                    </div>
                    <span className="cmdk-hit-matched">{h.matched}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

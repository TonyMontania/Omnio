// Command-palette-style global search. Ctrl+K anywhere in the app.
// Searches every item by title, artist, alternative titles, tags — grouped
// by category. Enter opens the highlighted result; arrows navigate.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Item, MusicArtist } from './types'
import { assetSrc } from './types'
import { CATEGORIES } from './categories'

// Action verbs the palette can execute on Enter. Each maps to a
// callback wired at the App level so we don't reach into router
// or setter internals from here.
export type CmdKAction =
  | { kind: 'open-library'; categoryId: string; label: string }
  | { kind: 'open-view'; view: 'home' | 'calendar' | 'stats' | 'settings' | 'arcade' | 'randomizer'; label: string }
  | { kind: 'add-item'; categoryId?: string; title: string; label: string }
  | { kind: 'franchise'; franchise: string; label: string }

interface Props {
  open: boolean
  items: Item[]
  artists: MusicArtist[]
  onClose: () => void
  onOpenItem: (item: Item) => void
  onOpenArtist: (artist: MusicArtist) => void
  onRunAction?: (action: CmdKAction) => void
}

// Every distinct non-empty `franchise` value across the library, used
// by the command palette's `franchise <name>` verb.
function collectFranchises(items: Item[]): string[] {
  const set = new Set<string>()
  for (const it of items) if (it.franchise) set.add(it.franchise)
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

interface Hit {
  kind: 'item' | 'artist' | 'action'
  item?: Item
  artist?: MusicArtist
  action?: CmdKAction
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

// Action-verb parser. Runs BEFORE the operator/free-text parser and
// short-circuits it when the query is clearly an action, so the
// action UI takes over the palette instead of listing search hits.
function parseAction(raw: string, items: Item[] = []): CmdKAction[] {
  const q = raw.trim()
  if (!q) return []
  const [head, ...rest] = q.split(/\s+/)
  const verb = head.toLowerCase()
  const arg = rest.join(' ').trim()
  const argLower = arg.toLowerCase()
  const out: CmdKAction[] = []
  // > open <view>
  if (verb === 'open' || verb === 'go' || verb === 'goto') {
    type ViewKey = 'home' | 'calendar' | 'stats' | 'settings' | 'arcade' | 'randomizer'
    const views: { key: string; view: ViewKey; label: string }[] = [
      { key: 'home', view: 'home', label: 'Open Home' },
      { key: 'calendar', view: 'calendar', label: 'Open Release calendar' },
      { key: 'stats', view: 'stats', label: 'Open Statistics' },
      { key: 'settings', view: 'settings', label: 'Open Settings' },
      { key: 'arcade', view: 'arcade', label: 'Open Arcade' },
      { key: 'random', view: 'randomizer', label: 'Open Random picker' },
      { key: 'randomizer', view: 'randomizer', label: 'Open Random picker' },
    ]
    for (const v of views) {
      if (!arg || v.key.startsWith(argLower)) out.push({ kind: 'open-view', view: v.view, label: v.label })
    }
    // > open <library>
    for (const cat of CATEGORIES) {
      const label = cat.label.toLowerCase()
      const id = cat.id.toLowerCase()
      if (!arg || label.startsWith(argLower) || id.startsWith(argLower) || label.includes(argLower)) {
        out.push({ kind: 'open-library', categoryId: cat.id, label: `Open ${cat.label} library` })
      }
    }
  }
  // > library <name>  (alias for `open <library>`)
  if (verb === 'library' || verb === 'lib') {
    for (const cat of CATEGORIES) {
      if (!arg || cat.label.toLowerCase().includes(argLower) || cat.id.toLowerCase().includes(argLower)) {
        out.push({ kind: 'open-library', categoryId: cat.id, label: `Open ${cat.label} library` })
      }
    }
  }
  // > franchise <name>
  if (verb === 'franchise' || verb === 'saga' || verb === 'series') {
    const franchises = collectFranchises(items)
    for (const f of franchises) {
      if (!arg || f.toLowerCase().includes(argLower)) {
        out.push({ kind: 'franchise', franchise: f, label: `Show cross-library timeline: ${f}` })
      }
    }
  }
  // > add [category] <title>
  if (verb === 'add' || verb === 'new' || verb === '+') {
    const first = rest[0]?.toLowerCase()
    const catByToken = first && CATEGORIES.find((c) => c.id.toLowerCase() === first || c.label.toLowerCase() === first)
    const title = catByToken ? rest.slice(1).join(' ').trim() : arg
    if (title) {
      if (catByToken) out.push({ kind: 'add-item', categoryId: catByToken.id, title, label: `Add “${title}” to ${catByToken.label}` })
      else out.push({ kind: 'add-item', title, label: `Add “${title}” to current library` })
    }
  }
  return out
}

export default function GlobalSearch({ open, items, artists, onClose, onOpenItem, onOpenArtist, onRunAction }: Props) {
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
    // Action verbs win over free-text search — if the palette
    // recognises them, we take over the result list entirely so the
    // user doesn't confuse "open games" (verb) with a search hit
    // titled "Open Games".
    const actions = parseAction(q, items)
    if (actions.length > 0) {
      return actions.slice(0, 40).map((a) => ({ kind: 'action' as const, action: a, score: 100, matched: 'action' }))
    }
    const parsed = parseQuery(q)
    if (!parsed.text.trim() && parsed.status === undefined && parsed.year === undefined && parsed.rating === undefined && parsed.tag === undefined && parsed.category === undefined && parsed.favorite === undefined) {
      return []
    }
    const results: Hit[] = []
    for (const it of items) {
      const s = scoreItem(it, parsed)
      if (s) results.push({ kind: 'item', item: it, score: s.score, matched: s.matched })
    }
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
    else if (h.kind === 'action' && h.action && onRunAction) onRunAction(h.action)
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
    const key = h.kind === 'action' ? '_actions'
      : h.kind === 'artist' ? '_artists'
      : (h.item?.categoryId ?? 'other')
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(h)
  }
  const groupLabel = (k: string) => k === '_actions' ? 'Actions'
    : k === '_artists' ? 'Artists'
    : (CATEGORIES.find((c) => c.id === k)?.label ?? k)

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
              <p style={{ margin: '0 0 6px', fontSize: 11.5 }}>
                Operators: <code>status:completed</code>, <code>year:2024</code>, <code>year:&gt;2020</code>,
                &nbsp;<code>rating:&gt;=4</code>, <code>tag:jrpg</code>, <code>category:musica</code>,
                &nbsp;<code>favorite:true</code>. Combine freely with free-text.
              </p>
              <p style={{ margin: 0, fontSize: 11.5 }}>
                Actions: <code>open home</code>, <code>open calendar</code>, <code>open games</code>,
                &nbsp;<code>library music</code>, <code>add game Hollow Knight</code>.
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
                const ac = h.action
                const label = it?.title ?? ar?.name ?? ac?.label ?? ''
                const sub = it
                  ? [it.artist, it.releaseYear, it.releaseDate ? new Date(it.releaseDate).getFullYear() : null].filter(Boolean).join(' · ')
                  : ar ? (ar.origin || 'Artist')
                  : (ac?.kind === 'add-item' ? 'Add'
                    : ac?.kind === 'open-view' ? 'Navigate'
                    : ac?.kind === 'franchise' ? 'Franchise'
                    : 'Open library')
                const cover = assetSrc(it?.cover ?? ar?.photo)
                const key = `${h.kind}-${it?.id ?? ar?.id ?? idx}`
                return (
                  <button
                    key={key}
                    data-hit-idx={idx}
                    className={`cmdk-hit ${idx === cursor ? 'active' : ''}`}
                    onMouseEnter={() => setCursor(idx)}
                    onClick={() => activate(h)}
                  >
                    <div className="cmdk-thumb">
                      {cover ? <img src={cover} alt="" />
                        : h.kind === 'action' ? <span>›</span>
                        : <span>{label.charAt(0).toUpperCase()}</span>}
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

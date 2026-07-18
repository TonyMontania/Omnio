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

// Score by presence: title exact word > title contains > artist/tag contains.
function scoreItem(item: Item, q: string): { score: number; matched: string } | null {
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
    const results: Hit[] = []
    for (const it of items) {
      const s = scoreItem(it, q.trim())
      if (s) results.push({ kind: 'item', item: it, score: s.score, matched: s.matched })
    }
    for (const a of artists) {
      const s = scoreArtist(a, q.trim())
      if (s) results.push({ kind: 'artist', artist: a, score: s.score, matched: s.matched })
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
            <p className="cmdk-hint">Search across every library — titles, artists, alt titles, tags.</p>
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

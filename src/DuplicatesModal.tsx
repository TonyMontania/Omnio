// Scans the library for items whose titles are close enough to be plausible
// duplicates. Cheap normalized Levenshtein distance — good enough for
// catching typos, articles ("The X" vs "X"), and remaster/original pairs
// that would otherwise stay hidden across a 500-item library.

import { useMemo, useState } from 'react'
import type { Item } from './types'
import { assetSrc } from './types'
import { CATEGORIES } from './categories'

interface Props {
  items: Item[]
  onOpenItem: (item: Item) => void
  onClose: () => void
}

// Standard Levenshtein, iterative rows. Small O(n·m) is fine — we compare
// pairs within a category only, and libraries top out in the low thousands.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    [prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(the|a|an|el|la|los|las)\s+/i, '') // strip leading articles
    .replace(/[^\w\s]/g, '')                       // drop punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

interface Pair {
  a: Item
  b: Item
  distance: number
  ratio: number
}

function findDuplicates(items: Item[]): Pair[] {
  // Compare only within a category — Elden Ring the game and Elden Ring the
  // OST are legitimately separate items and should not raise flags.
  const byCat: Record<string, Item[]> = {}
  for (const it of items) {
    if (!byCat[it.categoryId]) byCat[it.categoryId] = []
    byCat[it.categoryId].push(it)
  }
  const pairs: Pair[] = []
  for (const cat of Object.values(byCat)) {
    for (let i = 0; i < cat.length; i++) {
      const na = normalize(cat[i].title)
      if (na.length < 3) continue
      for (let j = i + 1; j < cat.length; j++) {
        const nb = normalize(cat[j].title)
        if (nb.length < 3) continue
        const maxLen = Math.max(na.length, nb.length)
        if (Math.abs(na.length - nb.length) / maxLen > 0.4) continue
        const d = levenshtein(na, nb)
        const ratio = d / maxLen
        if (ratio <= 0.2) pairs.push({ a: cat[i], b: cat[j], distance: d, ratio })
      }
    }
  }
  pairs.sort((x, y) => x.ratio - y.ratio)
  return pairs
}

export default function DuplicatesModal({ items, onOpenItem, onClose }: Props) {
  const [ignored, setIgnored] = useState<Set<string>>(new Set())

  const pairs = useMemo(() => findDuplicates(items), [items])
  const visible = pairs.filter((p) => !ignored.has(pairKey(p)))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel duplicates-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Similar titles</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint">
            Titles that look close within the same category. Nothing is deleted here — this is a heads-up so
            you can open both, decide which to keep, and remove the other by hand.
          </p>
          {visible.length === 0 && (
            <p className="hint" style={{ marginTop: 24 }}>
              {pairs.length === 0
                ? 'No suspicious pairs. Your library looks clean.'
                : 'All pairs dismissed for this session.'}
            </p>
          )}
          {visible.map((p) => (
            <DupRow
              key={pairKey(p)}
              pair={p}
              onOpen={(it) => { onOpenItem(it); onClose() }}
              onIgnore={() => setIgnored((s) => new Set(s).add(pairKey(p)))}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function pairKey(p: Pair): string {
  return p.a.id < p.b.id ? `${p.a.id}::${p.b.id}` : `${p.b.id}::${p.a.id}`
}

function DupRow({ pair, onOpen, onIgnore }: {
  pair: Pair
  onOpen: (item: Item) => void
  onIgnore: () => void
}) {
  const catLabel = CATEGORIES.find((c) => c.id === pair.a.categoryId)?.label ?? pair.a.categoryId
  const pct = Math.round((1 - pair.ratio) * 100)
  return (
    <div className="dup-row">
      <div className="dup-side">
        <button type="button" className="dup-thumb-btn" onClick={() => onOpen(pair.a)}>
          <div className="dup-thumb">
            {assetSrc(pair.a.cover) ? <img src={assetSrc(pair.a.cover)} alt="" /> : <span>{pair.a.title.charAt(0)}</span>}
          </div>
          <div className="dup-title">{pair.a.title}</div>
        </button>
      </div>
      <div className="dup-mid">
        <span className="dup-similarity">{pct}%</span>
        <span className="dup-cat">{catLabel}</span>
        <button type="button" className="link-btn" onClick={onIgnore}>Ignore</button>
      </div>
      <div className="dup-side">
        <button type="button" className="dup-thumb-btn" onClick={() => onOpen(pair.b)}>
          <div className="dup-thumb">
            {assetSrc(pair.b.cover) ? <img src={assetSrc(pair.b.cover)} alt="" /> : <span>{pair.b.title.charAt(0)}</span>}
          </div>
          <div className="dup-title">{pair.b.title}</div>
        </button>
      </div>
    </div>
  )
}

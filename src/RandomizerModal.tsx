// Backlog randomizer — for the "I have 200 games / 500 movies and can't
// decide what to start next" case. Filters items to the backlog / plan-
// to-* / not-consumed pool, optionally narrows by library, and picks
// one uniformly. Re-roll button until the user likes the pick, then
// "Open" jumps to the detail view.

import { useMemo, useState } from 'react'
import type { Item } from './types'
import { assetSrc } from './types'
import { CATEGORIES } from './categories'

interface Props {
  items: Item[]
  enabledCategories?: string[]
  onOpenItem: (item: Item) => void
  onClose: () => void
}

// "In backlog" per category — the status label each library uses for
// "haven't started yet". Music has no formal backlog status so we treat
// !consumed as the pool. Movies same.
function inBacklog(it: Item): boolean {
  if (it.categoryId === 'videojuegos') return (it.gameStatus ?? 'backlog') === 'backlog'
  if (it.categoryId === 'anime' || it.categoryId === 'donghua') return it.watchStatus === 'plan_to_watch'
  if (it.categoryId === 'series') return it.seriesStatus === 'plan_to_watch'
  if (['manga','manhwa','manhua','comics_west'].includes(it.categoryId)) return it.mangaStatus === 'plan_to_read'
  if (it.categoryId === 'libros') return it.bookStatus === 'plan_to_read'
  if (it.categoryId === 'peliculas') return !it.consumed
  if (it.categoryId === 'musica') return !it.consumed
  return false
}

export default function RandomizerModal({ items, enabledCategories, onOpenItem, onClose }: Props) {
  const [category, setCategory] = useState<string>('all')
  const [pick, setPick] = useState<Item | null>(null)
  const [rollNonce, setRollNonce] = useState(0)

  const pool = useMemo(() => {
    const cats = enabledCategories ?? CATEGORIES.map((c) => c.id)
    return items.filter((it) => {
      if (!cats.includes(it.categoryId)) return false
      if (category !== 'all' && it.categoryId !== category) return false
      return inBacklog(it)
    })
  }, [items, enabledCategories, category])

  // Deterministic roll on mount + on nonce change so React renders match.
  // Not cryptographically random — Math.random is fine for "surprise me".
  useMemo(() => {
    if (pool.length === 0) { setPick(null); return }
    setPick(pool[Math.floor(Math.random() * pool.length)])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length, category, rollNonce])

  const catOptions = (enabledCategories ?? CATEGORIES.map((c) => c.id))
    .map((id) => CATEGORIES.find((c) => c.id === id))
    .filter((c): c is (typeof CATEGORIES)[number] => !!c)

  return (
    <div className="modal-overlay">
      <div className="modal-panel randomizer-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '92vw' }}>
        <div className="modal-header">
          <h2>Pick something to start</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field-group">
            <label>From library</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">Any library</option>
              {catOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <p className="hint">Picks from your backlog / plan-to-play/watch/read pool for the chosen library. Music and Movies use "not consumed" as the pool since they don't have a formal backlog status.</p>
          </div>

          {pick ? (
            <div className="randomizer-pick">
              <button type="button" className="randomizer-pick-cover" onClick={() => { onOpenItem(pick); onClose() }}>
                {pick.cover
                  ? <img src={assetSrc(pick.cover)} alt="" />
                  : <span>{pick.title.charAt(0).toUpperCase()}</span>}
              </button>
              <div className="randomizer-pick-title">{pick.title}</div>
              <div className="randomizer-pick-meta">
                {CATEGORIES.find((c) => c.id === pick.categoryId)?.label}
                {pick.releaseYear && ` · ${pick.releaseYear}`}
              </div>
            </div>
          ) : (
            <p className="hint" style={{ textAlign: 'center', padding: '32px 0' }}>
              Nothing in the backlog for that library. Try another one.
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="ghost-btn" onClick={onClose}>Close</button>
          <button type="button" className="secondary-btn" disabled={pool.length < 2} onClick={() => setRollNonce((n) => n + 1)}>🎲 Re-roll</button>
          <button type="button" className="primary-btn" disabled={!pick} onClick={() => { if (pick) { onOpenItem(pick); onClose() } }}>Open</button>
        </div>
      </div>
    </div>
  )
}

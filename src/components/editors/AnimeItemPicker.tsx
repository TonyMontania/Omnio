// Search-then-pick helper. Filters `options` by title match against the query
// (excluding already-linked items) and returns the chosen id via onPick.
// Used by Related and Recommendations editors — the name is historical.
//
// Cross-library mode: pass `showCategoryBadge` to render a small badge on
// each result so users linking a Berserk manga ↔ Berserk PS2 game can
// tell them apart even though the titles match.

import { useState } from 'react'
import type { Item } from '../../types'
import { assetSrc } from '../../types'
import { CATEGORIES } from '../../categories'

const categoryLabelOf = (id: string): string => CATEGORIES.find((c) => c.id === id)?.label ?? id

export default function AnimeItemPicker({ options, excludeIds, onPick, placeholder, showCategoryBadge }: {
  options: Item[]
  excludeIds: string[]
  onPick: (id: string) => void
  placeholder?: string
  showCategoryBadge?: boolean
}) {
  const [query, setQuery] = useState('')
  const filtered = query.trim()
    ? options.filter((o) => !excludeIds.includes(o.id) && o.title.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []
  return (
    <div className="anime-picker">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder ?? 'Search…'} />
      {filtered.length > 0 && (
        <div className="anime-picker-results">
          {filtered.map((o) => (
            <button key={o.id} type="button" className="anime-picker-item" onClick={() => { onPick(o.id); setQuery('') }}>
              {o.cover && <img src={assetSrc(o.cover)} alt="" />}
              <span>{o.title}</span>
              {showCategoryBadge && <span className="anime-picker-cat">{categoryLabelOf(o.categoryId)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

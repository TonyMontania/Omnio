// Auto-derived franchise strip: same DOM in every category, only the
// year label is picked from a different date source depending on media type
// (release date for games/anime, release year for movies/music).

import type { Item } from '../../types'
import { assetSrc } from '../../types'

export default function DetailFranchiseTimeline({ items, currentId, franchise, yearOf, onNavigate }: {
  items: Item[]
  currentId: string
  franchise?: string
  yearOf: (i: Item) => string    // formatter for each entry's year badge
  onNavigate: (id: string) => void
}) {
  if (items.length <= 1) return null
  return (
    <div className="field-group">
      <label>Franchise{franchise ? ` — ${franchise}` : ''}</label>
      <div className="franchise-timeline">
        {items.map((f) => (
          <button
            key={f.id}
            type="button"
            className={f.id === currentId ? 'franchise-item current' : 'franchise-item'}
            onClick={() => f.id !== currentId && onNavigate(f.id)}
          >
            {f.cover && <img src={assetSrc(f.cover)} alt="" />}
            <span className="franchise-title">{f.title}</span>
            <span className="franchise-year">{yearOf(f)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

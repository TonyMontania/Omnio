// The library toolbar's Filters button + popover. Sections that aren't
// relevant to the current category (status/platform/genre) are gated with
// show* flags from the parent.

import { useState, useEffect, useRef, useMemo } from 'react'
import type { GameStatus, Platform } from '../../types'
import { GAME_STATUS_OPTIONS } from '../../types'
import { GameStatusIcon } from '../../icons'
import { flattenTagTree, type TagTree } from '../../utils/tags'

export default function FiltersDropdown({
  availableTags, filterTags, onToggleTag, showStatus, filterStatus, onToggleStatus, showPlatform, availablePlatforms, filterPlatforms, onTogglePlatform,
  showGenre, availableGenres, filterGenres, onToggleGenre, minRating, onSetMinRating, onClear,
  tagTree,
}: {
  availableTags: string[]; filterTags: string[]; onToggleTag: (t: string) => void
  showStatus: boolean; filterStatus: GameStatus[]; onToggleStatus: (s: GameStatus) => void
  showPlatform: boolean; availablePlatforms: Platform[]; filterPlatforms: Platform[]; onTogglePlatform: (p: Platform) => void
  showGenre: boolean; availableGenres: string[]; filterGenres: string[]; onToggleGenre: (g: string) => void
  minRating: number; onSetMinRating: (n: number) => void
  onClear: () => void
  tagTree?: TagTree
}) {
  const tagRows = useMemo(() => flattenTagTree(availableTags, tagTree), [availableTags, tagTree])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeCount = filterTags.length + filterStatus.length + filterPlatforms.length + filterGenres.length + (minRating > 0 ? 1 : 0)

  return (
    <div className="filters-wrap" ref={ref}>
      <button type="button" className={activeCount > 0 ? 'filters-btn active' : 'filters-btn'} onClick={() => setOpen((o) => !o)}>
        Filters{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>
      {open && (
        <div className="filters-menu">
          <div className="filters-section">
            <span className="filters-label">Tags</span>
            <div className="dropdown-pills tag-tree">
              {tagRows.length === 0 && <span className="hint">No tags yet</span>}
              {tagRows.map(({ tag, depth }) => (
                <button
                  key={tag}
                  type="button"
                  className={filterTags.includes(tag) ? 'pill active' : 'pill'}
                  style={depth > 0 ? { marginLeft: depth * 14 } : undefined}
                  onClick={() => onToggleTag(tag)}
                  title={depth > 0 ? 'Child of a parent tag — selecting the parent also matches this one.' : undefined}
                >
                  {depth > 0 ? '↳ ' : ''}{tag}
                </button>
              ))}
            </div>
          </div>
          {showStatus && (
            <div className="filters-section">
              <span className="filters-label">Status</span>
              <div className="dropdown-pills">
                {GAME_STATUS_OPTIONS.map((s) => (
                  <button key={s.value} type="button" className={filterStatus.includes(s.value) ? 'pill active' : 'pill'} onClick={() => onToggleStatus(s.value)}><GameStatusIcon value={s.value} /> {s.label}</button>
                ))}
              </div>
            </div>
          )}
          {showPlatform && (
            <div className="filters-section">
              <span className="filters-label">Platform</span>
              <div className="dropdown-pills">
                {availablePlatforms.length === 0 && <span className="hint">No platforms yet</span>}
                {availablePlatforms.map((p) => (
                  <button key={p} type="button" className={filterPlatforms.includes(p) ? 'pill active' : 'pill'} onClick={() => onTogglePlatform(p)}>{p}</button>
                ))}
              </div>
            </div>
          )}
          {showGenre && (
            <div className="filters-section">
              <span className="filters-label">Genre</span>
              <div className="dropdown-pills">
                {availableGenres.length === 0 && <span className="hint">No genres yet</span>}
                {availableGenres.map((g) => (
                  <button key={g} type="button" className={filterGenres.includes(g) ? 'pill active' : 'pill'} onClick={() => onToggleGenre(g)}>{g}</button>
                ))}
              </div>
            </div>
          )}
          <div className="filters-section">
            <span className="filters-label">Minimum rating</span>
            <div className="dropdown-pills">
              {[0, 3, 3.5, 4, 4.5, 5].map((r) => (
                <button key={r} type="button" className={minRating === r ? 'pill active' : 'pill'} onClick={() => onSetMinRating(r)}>
                  {r === 0 ? 'Any' : `★ ${r}+`}
                </button>
              ))}
            </div>
          </div>
          {activeCount > 0 && <button type="button" className="clear-filters" onClick={onClear}>Clear filters</button>}
        </div>
      )}
    </div>
  )
}

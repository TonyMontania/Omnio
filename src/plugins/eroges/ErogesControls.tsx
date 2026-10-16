import { useEffect, useRef, useState } from 'react'

export type ErogeFilter = 'all' | 'playing' | 'backlog' | 'played' | 'updates'
export type ErogeSort = 'az' | 'creator' | 'status' | 'engine' | 'releaseDate' | 'updated'
export type ErogeLayout = 'grid' | 'list'

interface Props {
  filter: ErogeFilter
  counts: Record<ErogeFilter, number>
  onFilter: (f: ErogeFilter) => void
  search: string
  onSearch: (v: string) => void
  sort: ErogeSort
  onSort: (s: ErogeSort) => void
  layout: ErogeLayout
  onLayout: (l: ErogeLayout) => void
  onOpenSettings: () => void
  checking: { done: number; total: number } | null
  onCheckUpdates: () => void
  onAdd: () => void
}

const FILTERS: { id: ErogeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'playing', label: 'Playing' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'played', label: 'Played' },
  { id: 'updates', label: 'Updates' },
]

const SORTS: { id: ErogeSort; label: string }[] = [
  { id: 'az', label: 'Alphabetical' },
  { id: 'updated', label: 'Most recent' },
  { id: 'creator', label: 'By creator' },
  { id: 'status', label: 'Status' },
  { id: 'engine', label: 'Engine' },
  { id: 'releaseDate', label: 'Release date' },
]

export default function ErogesControls(p: Props) {
  const [optionsOpen, setOptionsOpen] = useState(false)
  const optionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!optionsOpen) return
    const close = (e: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) setOptionsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOptionsOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [optionsOpen])

  return (
    <div className="er-controls">
      <div className="er-seg" role="tablist" aria-label="Filter games">
        {FILTERS.map((f) => {
          const n = p.counts[f.id]
          const isUpdates = f.id === 'updates'
          if (isUpdates && n === 0 && p.filter !== 'updates') return null
          return (
            <button key={f.id} role="tab" aria-selected={p.filter === f.id} className={p.filter === f.id ? 'on' : ''} onClick={() => p.onFilter(f.id)}>
              {f.label}
              {n > 0 && <span className={isUpdates ? 'er-seg-n accent' : 'er-seg-n'}>{n}</span>}
            </button>
          )
        })}
      </div>

      <label className="er-search">
        <span aria-hidden>⌕</span>
        <input value={p.search} onChange={(e) => p.onSearch(e.target.value)} placeholder="Search" aria-label="Search by title or creator" />
        {p.search && <button type="button" aria-label="Clear search" onClick={() => p.onSearch('')}>×</button>}
      </label>

      <div className="er-options" ref={optionsRef}>
        <button type="button" className="er-icon-btn" aria-label="View options" aria-expanded={optionsOpen} title="Sort, view and settings" onClick={() => setOptionsOpen((v) => !v)}>⚙</button>
        {optionsOpen && (
          <div className="er-options-pop" role="dialog" aria-label="View options">
            <div className="er-options-label">Sort by</div>
            <div className="er-options-list">
              {SORTS.map((s) => (
                <button key={s.id} className={p.sort === s.id ? 'on' : ''} onClick={() => p.onSort(s.id)}>{s.label}</button>
              ))}
            </div>
            <div className="er-options-label">View</div>
            <div className="er-seg small">
              <button className={p.layout === 'grid' ? 'on' : ''} onClick={() => p.onLayout('grid')}>▦ Grid</button>
              <button className={p.layout === 'list' ? 'on' : ''} onClick={() => p.onLayout('list')}>☰ List</button>
            </div>
            <button className="er-options-settings" onClick={() => { setOptionsOpen(false); p.onOpenSettings() }}>Eroges settings…</button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="er-icon-btn"
        onClick={p.onCheckUpdates}
        disabled={!!p.checking}
        title="Check for updates in this view"
        aria-label="Check for updates"
      >
        {p.checking ? <span className="er-checking">{p.checking.done}/{p.checking.total}</span> : '↻'}
      </button>
      <button type="button" className="add-btn" onClick={p.onAdd}>+ Add</button>
    </div>
  )
}

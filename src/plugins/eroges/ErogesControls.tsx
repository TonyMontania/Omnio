import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n'

export type ErogeFilter = 'all' | 'playing' | 'backlog' | 'played' | 'updates'
export type ErogeSort = 'az' | 'creator' | 'status' | 'engine' | 'releaseDate' | 'updated'
export type ErogeLayout = 'grid' | 'list'

interface Props {
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


const SORTS: { id: ErogeSort; label: string }[] = [
  { id: 'az', label: t('Alphabetical') },
  { id: 'updated', label: t('Most recent') },
  { id: 'creator', label: t('By creator') },
  { id: 'status', label: t('Status') },
  { id: 'engine', label: t('Engine') },
  { id: 'releaseDate', label: t('Release date') },
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
    <div className="ctl">
      <label className="search-box">
        <span aria-hidden>⌕</span>
        <input value={p.search} onChange={(e) => p.onSearch(e.target.value)} placeholder={t('Search')} aria-label={t('Search by title or creator')} />
        {p.search && <button type="button" aria-label={t('Clear search')} onClick={() => p.onSearch('')}>×</button>}
      </label>

      <div className="pop-wrap" ref={optionsRef}>
        <button type="button" className="icon-btn" aria-label={t('View options')} aria-expanded={optionsOpen} title={t('Sort, view and settings')} onClick={() => setOptionsOpen((v) => !v)}>⚙</button>
        {optionsOpen && (
          <div className="pop" role="dialog" aria-label={t('View options')}>
            <div className="pop-label">{t('Sort by')}</div>
            <div className="pop-list">
              {SORTS.map((s) => (
                <button key={s.id} className={p.sort === s.id ? 'on' : ''} onClick={() => p.onSort(s.id)}>{s.label}</button>
              ))}
            </div>
            <div className="pop-label">{t('View')}</div>
            <div className="seg small">
              <button className={p.layout === 'grid' ? 'on' : ''} onClick={() => p.onLayout('grid')}>{t('▦ Grid')}</button>
              <button className={p.layout === 'list' ? 'on' : ''} onClick={() => p.onLayout('list')}>{t('☰ List')}</button>
            </div>
            <button className="pop-foot" onClick={() => { setOptionsOpen(false); p.onOpenSettings() }}><span className="pop-icon" aria-hidden>⚙</span>{t('Eroges settings…')}</button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="icon-btn"
        onClick={p.onCheckUpdates}
        disabled={!!p.checking}
        title={t('Check for updates in this view')}
        aria-label={t('Check for updates')}
      >
        {p.checking ? <span className="ctl-checking">{p.checking.done}/{p.checking.total}</span> : '↻'}
      </button>
      <button type="button" className="add-btn" onClick={p.onAdd}>{t('+ Add')}</button>
    </div>
  )
}

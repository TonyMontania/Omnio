// One-row controls for a library page, rendered in the top bar next to the
// status segments: search, filters, a view popover (sort, grouping,
// layout, smart lists) and a "more" menu (groups, delete mode, export).
// Same look as the plugin library controls (styles/controls.css).

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

export interface Choice<T extends string> { value: T; label: string; icon?: ReactNode }

interface Props<S extends string, G extends string, L extends string> {
  search: string
  onSearch: (v: string) => void
  searchRef?: RefObject<HTMLInputElement>
  filters: ReactNode
  sort: S
  sortOptions: Choice<S>[]
  onSort: (v: S) => void
  groupBy: G
  groupOptions: Choice<G>[]
  onGroupBy: (v: G) => void
  groupDisabled?: boolean
  layout: L
  layoutOptions: Choice<L>[]
  onLayout: (v: L) => void
  smartLists: { id: string; name: string }[]
  activeSmartListId: string | null
  onSmartList: (id: string | null) => void
  onManageSmartLists: () => void
  views: { label: string; icon: string; onClick: () => void }[]
  deleteMode: boolean
  onToggleDelete: () => void
  exportCount: number
  onExport: (kind: 'csv' | 'json') => void
  extra?: ReactNode
  addLabel: string
  onAdd: () => void
}

function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return { open, setOpen, ref }
}

export default function LibraryControls<S extends string, G extends string, L extends string>(p: Props<S, G, L>) {
  const view = usePopover()
  const more = usePopover()
  const viewBadge = (p.groupBy !== 'none' ? 1 : 0) + (p.activeSmartListId ? 1 : 0)

  return (
    <div className="ctl">
      <label className="search-box">
        <span aria-hidden>⌕</span>
        <input ref={p.searchRef} value={p.search} onChange={(e) => p.onSearch(e.target.value)} placeholder="Search (Ctrl+F)" aria-label="Search by title" />
        {p.search && <button type="button" aria-label="Clear search" onClick={() => p.onSearch('')}>×</button>}
      </label>

      <div className="ctl-filters">{p.filters}</div>

      <div className="pop-wrap" ref={view.ref}>
        <button type="button" className={`icon-btn${view.open ? ' on' : ''}`} aria-label="View options" aria-expanded={view.open} title="Sort, grouping, layout and smart lists" onClick={() => view.setOpen((v) => !v)}>
          ⚙{viewBadge > 0 && <span className="badge">{viewBadge}</span>}
        </button>
        {view.open && (
          <div className="pop" role="dialog" aria-label="View options">
            <div className="pop-label">Sort by</div>
            <div className="pop-list">
              {p.sortOptions.map((o) => (
                <button type="button" key={o.value} className={p.sort === o.value ? 'on' : ''} onClick={() => p.onSort(o.value)}>{o.label}</button>
              ))}
            </div>
            <div className="pop-label">Group</div>
            <div className="pop-list">
              {p.groupOptions.map((o) => (
                <button type="button" key={o.value} className={p.groupBy === o.value ? 'on' : ''} disabled={p.groupDisabled} onClick={() => p.onGroupBy(o.value)}>{o.label}</button>
              ))}
            </div>
            <div className="pop-label">Layout</div>
            <div className="pop-list">
              {p.layoutOptions.map((o) => (
                <button type="button" key={o.value} className={p.layout === o.value ? 'on' : ''} onClick={() => p.onLayout(o.value)}>
                  {o.icon && <span className="pop-icon" aria-hidden>{o.icon}</span>}{o.label}
                </button>
              ))}
            </div>
            <div className="pop-label">Smart list</div>
            <div className="pop-list">
              <button type="button" className={!p.activeSmartListId ? 'on' : ''} onClick={() => p.onSmartList(null)}>All items</button>
              {p.smartLists.map((l) => (
                <button type="button" key={l.id} className={p.activeSmartListId === l.id ? 'on' : ''} onClick={() => p.onSmartList(l.id)}>★ {l.name}</button>
              ))}
            </div>
            <button type="button" className="pop-foot" onClick={() => { view.setOpen(false); p.onManageSmartLists() }}><span className="pop-icon" aria-hidden>⚙</span>Manage smart lists…</button>
          </div>
        )}
      </div>

      <div className="pop-wrap" ref={more.ref}>
        <button type="button" className={`icon-btn${p.deleteMode ? ' danger-on' : more.open ? ' on' : ''}`} aria-label="More" aria-expanded={more.open} title="Groups, delete mode and export" onClick={() => more.setOpen((v) => !v)}>⋯</button>
        {more.open && (
          <div className="pop" role="menu" aria-label="More">
            <div className="pop-list">
              {p.views.map((v) => (
                <button type="button" role="menuitem" key={v.label} onClick={() => { more.setOpen(false); v.onClick() }}>
                  <span className="pop-icon" aria-hidden>{v.icon}</span>{v.label}
                </button>
              ))}
            </div>
            <div className="pop-sep" />
            <div className="pop-list">
              <button type="button" role="menuitem" className={p.deleteMode ? 'on' : 'danger'} onClick={() => { more.setOpen(false); p.onToggleDelete() }}>
                <span className="pop-icon" aria-hidden>{p.deleteMode ? '←' : '✕'}</span>{p.deleteMode ? 'Exit delete mode' : 'Delete mode'}
              </button>
            </div>
            <div className="pop-sep" />
            <div className="pop-label">Export shown</div>
            <div className="pop-list">
              <button type="button" role="menuitem" disabled={p.exportCount === 0} onClick={() => { more.setOpen(false); p.onExport('csv') }}><span className="pop-icon" aria-hidden>↓</span>As CSV ({p.exportCount})</button>
              <button type="button" role="menuitem" disabled={p.exportCount === 0} onClick={() => { more.setOpen(false); p.onExport('json') }}><span className="pop-icon" aria-hidden>↓</span>As JSON ({p.exportCount})</button>
            </div>
          </div>
        )}
      </div>

      {p.extra}
      <button type="button" className="add-btn" onClick={p.onAdd}>{p.addLabel}</button>
    </div>
  )
}

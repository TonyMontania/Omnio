// Top-bar controls for library sub-pages (artists, groups, one artist):
// optional search, a ⚙ popover with sort and layout, an optional "+ New"
// button that asks for a name, and any extra buttons. Same look as
// LibraryControls (styles/controls.css).

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { t } from '../i18n'

export interface PageChoice<T extends string> { value: T; label: string; icon?: ReactNode }

interface Props<S extends string, L extends string> {
  search?: string
  onSearch?: (v: string) => void
  searchPlaceholder?: string
  sort: S
  sortOptions: PageChoice<S>[]
  onSort: (v: S) => void
  layout?: L
  layoutOptions?: PageChoice<L>[]
  onLayout?: (v: L) => void
  create?: { label: string; placeholder: string; onCreate: (name: string) => void }
  extra?: ReactNode
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

export default function PageControls<S extends string, L extends string>(p: Props<S, L>) {
  const view = usePopover()
  const add = usePopover()
  const [name, setName] = useState('')
  const submit = () => {
    if (!p.create || !name.trim()) return
    p.create.onCreate(name.trim())
    setName('')
    add.setOpen(false)
  }

  return (
    <div className="ctl">
      {p.onSearch && (
        <label className="search-box">
          <span aria-hidden>⌕</span>
          <input value={p.search ?? ''} onChange={(e) => p.onSearch!(e.target.value)} placeholder={t(p.searchPlaceholder ?? 'Search')} aria-label={t(p.searchPlaceholder ?? 'Search')} />
          {p.search && <button type="button" aria-label={t('Clear search')} onClick={() => p.onSearch!('')}>×</button>}
        </label>
      )}

      <div className="pop-wrap" ref={view.ref}>
        <button type="button" className={`icon-btn${view.open ? ' on' : ''}`} aria-label={t('View options')} aria-expanded={view.open} title={t('Sort and layout')} onClick={() => view.setOpen((v) => !v)}>⚙</button>
        {view.open && (
          <div className="pop" role="dialog" aria-label={t('View options')}>
            <div className="pop-label">{t('Sort by')}</div>
            <div className="pop-list">
              {p.sortOptions.map((o) => (
                <button type="button" key={o.value} className={p.sort === o.value ? 'on' : ''} onClick={() => p.onSort(o.value)}>{t(o.label)}</button>
              ))}
            </div>
            {p.layoutOptions && p.onLayout && (
              <>
                <div className="pop-label">{t('Layout')}</div>
                <div className="pop-list">
                  {p.layoutOptions.map((o) => (
                    <button type="button" key={o.value} className={p.layout === o.value ? 'on' : ''} onClick={() => p.onLayout!(o.value)}>
                      {o.icon && <span className="pop-icon" aria-hidden>{o.icon}</span>}{t(o.label)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {p.extra}

      {p.create && (
        <div className="pop-wrap" ref={add.ref}>
          <button type="button" className="add-btn" aria-expanded={add.open} onClick={() => add.setOpen((v) => !v)}>{t(p.create.label)}</button>
          {add.open && (
            <form className="pop pop-create" onSubmit={(e) => { e.preventDefault(); submit() }}>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t(p.create.placeholder)} aria-label={t(p.create.placeholder)} />
              <button type="submit" className="add-btn" disabled={!name.trim()}>{t('Create')}</button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

// Cross-library franchise timeline — every item that shares a franchise
// string, from ANY category, laid out by chronological release year.
//
// Opens as a full modal from the franchise chip in any detail view.
// The DetailFranchiseTimeline in the detail body remains scoped to
// the current category (games only see games); this modal is the
// "show me EVERY Witcher / Alien / Blade Runner thing I have" view.

import { useMemo } from 'react'
import type { Item } from '../types'
import { assetSrc } from '../types'
import { CATEGORIES } from '../categories'

interface Props {
  franchise: string
  allItems: Item[]
  onClose: () => void
  onNavigate: (id: string) => void
}

function releaseYear(it: Item): number {
  if (it.releaseDate) {
    const m = /^(\d{4})/.exec(it.releaseDate)
    if (m) return Number(m[1])
  }
  if (it.releaseYear) {
    const n = Number(it.releaseYear)
    if (Number.isFinite(n)) return n
  }
  return Number.POSITIVE_INFINITY
}

export default function CrossLibraryFranchiseModal({ franchise, allItems, onClose, onNavigate }: Props) {
  const items = useMemo(() => {
    const list = allItems.filter((i) => i.franchise === franchise)
    list.sort((a, b) => releaseYear(a) - releaseYear(b) || a.title.localeCompare(b.title))
    return list
  }, [allItems, franchise])

  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of items) m.set(it.categoryId, (m.get(it.categoryId) ?? 0) + 1)
    return m
  }, [items])

  const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: '96vw', maxHeight: '92vh' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0 }}>{franchise}</h2>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              {items.length} item{items.length === 1 ? '' : 's'} across{' '}
              {Array.from(byCategory.entries()).map(([id, n]) => `${catLabel(id)} (${n})`).join(' · ')}
            </p>
          </div>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {items.length === 0 ? (
            <p className="hint">No items share the "{franchise}" franchise yet — set it on a few and they'll all show up here.</p>
          ) : (
            <div className="franchise-cross-timeline">
              {items.map((it) => {
                const y = releaseYear(it)
                return (
                  <button
                    key={it.id}
                    type="button"
                    className="franchise-cross-item"
                    onClick={() => { onNavigate(it.id); onClose() }}
                  >
                    {it.cover
                      ? <img className="franchise-cross-cover" src={assetSrc(it.cover)} alt={it.title} loading="lazy" />
                      : <div className="franchise-cross-cover placeholder"><span>{it.title.charAt(0)}</span></div>}
                    <div className="franchise-cross-body">
                      <div className="franchise-cross-year">{Number.isFinite(y) ? y : '—'}</div>
                      <div className="franchise-cross-title">{it.title}</div>
                      <div className="franchise-cross-cat">{catLabel(it.categoryId)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

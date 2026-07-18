// Floating action bar that appears when the user has shift-clicked to
// select multiple items. Offers the bulk operations most likely to save
// keystrokes: change status, tag or untag, add to a group, delete.

import { useEffect, useMemo, useState } from 'react'
import type { Item, Collection, GameStatus, MangaStatus, AnimeStatus, SeriesStatus } from './types'
import {
  GAME_STATUS_OPTIONS, MANGA_STATUS_OPTIONS, ANIME_STATUS_OPTIONS, SERIES_STATUS_OPTIONS,
  isMangaLike,
} from './types'
import { isAnimeLikeCategory } from './categories'

interface Props {
  items: Item[]                       // full library
  selectedIds: Set<string>
  onClear: () => void
  onApplyStatus: (updater: (item: Item) => Partial<Item>) => void
  onApplyTag: (op: 'add' | 'remove', tag: string) => void
  onAddToGroup: (collectionId: string) => void
  onDelete: () => void
  collections: Collection[]
}

export default function BulkActionBar({
  items, selectedIds, onClear,
  onApplyStatus, onApplyTag, onAddToGroup, onDelete, collections,
}: Props) {
  const [menu, setMenu] = useState<null | 'status' | 'tag-add' | 'tag-remove' | 'group'>(null)
  const [draft, setDraft] = useState('')

  const selected = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds],
  )

  // A single category means we can offer per-category status options.
  const singleCategory = selected.length > 0 && selected.every((it) => it.categoryId === selected[0].categoryId)
    ? selected[0].categoryId
    : null

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(null); onClear() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClear])

  if (selectedIds.size === 0) return null

  const groupsForCategory = singleCategory
    ? collections.filter((c) => c.categoryId === singleCategory)
    : []

  const statusOptions = (() => {
    if (!singleCategory) return null
    if (singleCategory === 'videojuegos') return GAME_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label, apply: () => onApplyStatus(() => ({ gameStatus: s.value as GameStatus })) }))
    if (singleCategory === 'series') return SERIES_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label, apply: () => onApplyStatus(() => ({ seriesStatus: s.value as SeriesStatus })) }))
    if (isAnimeLikeCategory(singleCategory)) return ANIME_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label, apply: () => onApplyStatus(() => ({ watchStatus: s.value as AnimeStatus })) }))
    if (isMangaLike(singleCategory)) return MANGA_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label, apply: () => onApplyStatus(() => ({ mangaStatus: s.value as MangaStatus })) }))
    return null
  })()

  const commitTag = (op: 'add' | 'remove') => {
    const t = draft.trim()
    if (!t) return
    onApplyTag(op, t)
    setDraft('')
    setMenu(null)
  }

  return (
    <div className="bulk-bar" role="toolbar" aria-label="Bulk actions">
      <div className="bulk-bar-inner">
        <div className="bulk-count">
          <strong>{selectedIds.size}</strong>
          <span>{selectedIds.size === 1 ? 'item' : 'items'} selected</span>
        </div>
        <div className="bulk-actions">
          {statusOptions && (
            <div className="bulk-drop">
              <button type="button" className="secondary-btn" onClick={() => setMenu(menu === 'status' ? null : 'status')}>Status ▾</button>
              {menu === 'status' && (
                <div className="bulk-menu">
                  {statusOptions.map((o) => (
                    <button key={o.value} type="button" onClick={() => { o.apply(); setMenu(null) }}>{o.label}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="bulk-drop">
            <button type="button" className="secondary-btn" onClick={() => setMenu(menu === 'tag-add' ? null : 'tag-add')}>+ Tag</button>
            {menu === 'tag-add' && (
              <div className="bulk-menu">
                <input autoFocus placeholder="Tag to add" value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitTag('add') }} />
                <button type="button" onClick={() => commitTag('add')}>Add to all</button>
              </div>
            )}
          </div>
          <div className="bulk-drop">
            <button type="button" className="secondary-btn" onClick={() => setMenu(menu === 'tag-remove' ? null : 'tag-remove')}>− Tag</button>
            {menu === 'tag-remove' && (
              <div className="bulk-menu">
                <input autoFocus placeholder="Tag to remove" value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitTag('remove') }} />
                <button type="button" onClick={() => commitTag('remove')}>Remove from all</button>
              </div>
            )}
          </div>
          {singleCategory && groupsForCategory.length > 0 && (
            <div className="bulk-drop">
              <button type="button" className="secondary-btn" onClick={() => setMenu(menu === 'group' ? null : 'group')}>Add to group ▾</button>
              {menu === 'group' && (
                <div className="bulk-menu">
                  {groupsForCategory.map((g) => (
                    <button key={g.id} type="button" onClick={() => { onAddToGroup(g.id); setMenu(null) }}>{g.name}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button type="button" className="danger-btn" onClick={onDelete}>Delete</button>
        </div>
        <button type="button" className="bulk-clear" onClick={onClear} title="Clear selection (Esc)">✕</button>
      </div>
    </div>
  )
}

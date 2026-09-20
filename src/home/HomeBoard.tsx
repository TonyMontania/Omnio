// Widget-board home screen (prototype of DEFERRED style D). Renders the
// user's saved widget layout — or the default one — in an editable
// grid. Edit mode adds per-widget controls (move up/down, resize,
// remove) and an "Add widget" picker; the parent persists the new
// layout via `onSaveLayout`.

import { useMemo, useState } from 'react'
import type { Item } from '../types'
import type { CategoryId } from '../types/items'
import { CATEGORIES } from '../categories'
import './widgets'         // side-effect: registers built-in widgets
import {
  getHomeWidget, listHomeWidgets, DEFAULT_HOME_LAYOUT,
  type HomeWidgetSlot, type WidgetSize, type HomeContext,
} from './registry'

interface Props {
  items: Item[]
  enabledCategories?: string[]
  layout?: readonly HomeWidgetSlot[]      // undefined = fall back to default
  onSaveLayout: (next: HomeWidgetSlot[]) => void
  onOpenCategory: (id: CategoryId) => void
  onOpenItem: (item: Item) => void
  onOpenCalendar: () => void
  onOpenStats: () => void
  onOpenSettings: () => void
  onOpenSearch: () => void
  onOpenRandomizer?: () => void
  onQuickAdd?: (categoryId: CategoryId, title: string) => void
}

const SIZE_LABELS: Record<WidgetSize, string> = {
  small: 'Small', medium: 'Medium', large: 'Full width',
}
// CSS grid column-span per size. The board itself is a 4-column grid.
const SIZE_SPAN: Record<WidgetSize, number> = { small: 1, medium: 2, large: 4 }

export default function HomeBoard(props: Props) {
  const {
    items, enabledCategories, layout, onSaveLayout,
    onOpenCategory, onOpenItem, onOpenCalendar, onOpenStats,
    onQuickAdd,
  } = props

  const [editing, setEditing] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  // Native HTML5 drag & drop reordering (edit mode only). No library —
  // we track the source slot on dragstart, highlight the hovered
  // target on dragover, and commit a swap on drop. `dragIdx`/`dragOverIdx`
  // are null when nothing is being dragged.
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const today = useMemo(() => new Date(), [])
  const greeting = useMemo(() => {
    const h = today.getHours()
    return h < 6 ? 'Late night' : h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening'
  }, [today])
  const dateLabel = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // The layout coming from settings might be empty (user cleared everything)
  // or missing (never touched). Both fall back to the default so the board
  // never renders as literally blank. `EmptyHint` handles the truly-blank
  // case by being seeded by the user.
  const effectiveLayout: readonly HomeWidgetSlot[] = layout && layout.length > 0
    ? layout
    : (layout === undefined ? DEFAULT_HOME_LAYOUT : [{ id: 'empty-hint', size: 'large' as WidgetSize }])
  const cats = enabledCategories ?? CATEGORIES.map((c) => c.id)

  const ctx: HomeContext = {
    items, enabledCategories: cats,
    onOpenItem, onOpenCategory, onOpenCalendar, onOpenStats,
    onQuickAdd,
  }

  const commit = (next: HomeWidgetSlot[]) => onSaveLayout(next)

  const move = (idx: number, delta: -1 | 1) => {
    const next = [...effectiveLayout]
    const target = idx + delta
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    commit(next)
  }
  const remove = (idx: number) => {
    const next = effectiveLayout.filter((_, i) => i !== idx)
    commit(next)
  }
  const resize = (idx: number, size: WidgetSize) => {
    const next = effectiveLayout.map((s, i) => i === idx ? { ...s, size } : s)
    commit(next)
  }
  // Move a slot from `from` to just before `to`. `to` is expressed in
  // pre-move indices, so if it's greater than `from` we account for the
  // gap left behind by the removal. Used by the drop handler.
  const reorder = (from: number, to: number) => {
    if (from === to) return
    const next = [...effectiveLayout]
    const [moved] = next.splice(from, 1)
    const insertAt = to > from ? to - 1 : to
    next.splice(insertAt, 0, moved)
    commit(next)
  }
  const add = (id: string) => {
    const w = getHomeWidget(id)
    if (!w) return
    commit([...effectiveLayout.filter((s) => s.id !== 'empty-hint'), { id, size: w.defaultSize }])
    setPickerOpen(false)
  }

  // Hide widgets already on the board (each is a singleton for now) and
  // the meta "empty hint" that only surfaces when the board is empty.
  const placed = new Set(effectiveLayout.map((s) => s.id))
  const availableToAdd = listHomeWidgets().filter((w) => w.id !== 'empty-hint' && !placed.has(w.id))

  return (
    <div className="home">
      <div className="home-header">
        <div className="home-brand">
          <svg className="brand-logo" viewBox="0 0 128 128" aria-hidden="true">
            <circle cx="64" cy="64" r="46" fill="none" stroke="currentColor" strokeWidth="6" />
            <path d="M64 26 L71.5 56.5 L102 64 L71.5 71.5 L64 102 L56.5 71.5 L26 64 L56.5 56.5 Z" fill="currentColor" />
            <circle cx="64" cy="64" r="6" fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
          <div>
            <h1>{greeting}</h1>
            <span className="home-date">{dateLabel}</span>
          </div>
        </div>
        <div className="home-utils">
          <button
            type="button"
            className={editing ? 'home-util active' : 'home-util'}
            onClick={() => setEditing((v) => !v)}
            title="Toggle layout editor"
          >
            <span>{editing ? '✓ Done editing' : '✎ Edit layout'}</span>
          </button>
        </div>
      </div>

      {editing && (
        <div className="home-edit-bar">
          <span className="hint">Edit mode — drag widgets to reorder, or use the ↑/↓ buttons. Resize / remove from each card.</span>
          <button type="button" className="secondary-btn" onClick={() => setPickerOpen(true)}>+ Add widget</button>
        </div>
      )}

      <div className="content-scroll">
        <div className="home-board">
          {effectiveLayout.map((slot, idx) => {
            const w = getHomeWidget(slot.id)
            if (!w) return null
            const body = w.render(ctx, slot.size)
            // Widgets that opt into self-hiding (like "On this day")
            // return null when they have nothing to show. Skip the
            // whole card outside of edit mode so the board stays
            // clean instead of surfacing an empty header. In edit
            // mode we still render the frame so the user can move,
            // resize or remove it.
            if (body === null && !editing) return null
            const isDragging = dragIdx === idx
            const isDropTarget = editing && dragIdx !== null && dragOverIdx === idx && dragIdx !== idx
            const cls = [
              `home-widget span-${slot.size}`,
              editing ? 'editing' : '',
              isDragging ? 'dragging' : '',
              isDropTarget ? (dragIdx !== null && dragIdx < idx ? 'drop-after' : 'drop-before') : '',
            ].filter(Boolean).join(' ')
            return (
              <section
                key={`${slot.id}-${idx}`}
                className={cls}
                style={{ gridColumn: `span ${SIZE_SPAN[slot.size]}` }}
                draggable={editing}
                onDragStart={editing ? (e) => {
                  setDragIdx(idx)
                  e.dataTransfer.effectAllowed = 'move'
                  // Firefox refuses to fire dragstart without any payload.
                  e.dataTransfer.setData('text/plain', slot.id)
                } : undefined}
                onDragOver={editing ? (e) => {
                  if (dragIdx === null) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (dragOverIdx !== idx) setDragOverIdx(idx)
                } : undefined}
                onDragLeave={editing ? () => {
                  // Only clear when leaving the specific card that's marked;
                  // otherwise a dragover on a child element bounces state.
                  if (dragOverIdx === idx) setDragOverIdx(null)
                } : undefined}
                onDrop={editing ? (e) => {
                  e.preventDefault()
                  if (dragIdx === null) return
                  const to = dragIdx < idx ? idx + 1 : idx
                  reorder(dragIdx, to)
                  setDragIdx(null)
                  setDragOverIdx(null)
                } : undefined}
                onDragEnd={editing ? () => {
                  setDragIdx(null)
                  setDragOverIdx(null)
                } : undefined}
              >
                <header className="home-widget-header">
                  <h2>
                    {editing && <span className="home-widget-grip" title="Drag to reorder" aria-hidden>⋮⋮</span>}
                    {w.label}
                  </h2>
                  {editing && (
                    <div className="home-widget-controls">
                      <button type="button" title="Move up" onClick={() => move(idx, -1)} disabled={idx === 0}>↑</button>
                      <button type="button" title="Move down" onClick={() => move(idx, +1)} disabled={idx === effectiveLayout.length - 1}>↓</button>
                      <select
                        title="Resize"
                        value={slot.size}
                        onChange={(e) => resize(idx, e.target.value as WidgetSize)}
                      >
                        {w.sizesSupported.map((s) => (
                          <option key={s} value={s}>{SIZE_LABELS[s]}</option>
                        ))}
                      </select>
                      <button type="button" className="danger" title="Remove" onClick={() => remove(idx)}>✕</button>
                    </div>
                  )}
                </header>
                <div className="home-widget-body">{body ?? <p className="hint">Nothing to show right now — will appear on the right day.</p>}</div>
              </section>
            )
          })}
        </div>
      </div>

      {pickerOpen && (
        <div className="modal-overlay" onClick={() => setPickerOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: '92vw' }}>
            <div className="modal-header">
              <h2>Add widget</h2>
              <button type="button" className="panel-close" onClick={() => setPickerOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              {availableToAdd.length === 0
                ? <p className="hint">Every widget is already on your board.</p>
                : <ul className="home-widget-picker">
                    {availableToAdd.map((w) => (
                      <li key={w.id}>
                        <button type="button" onClick={() => add(w.id)}>
                          <span className="picker-title">{w.label}</span>
                          <span className="picker-desc">{w.description}</span>
                        </button>
                      </li>
                    ))}
                  </ul>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Kanban board view — universal across every library.
//
// Columns = statuses for the current category. Cards are draggable
// between columns; dropping on a column applies the matching status
// patch. Every library uses this same component — the only per-
// category thing is which statuses exist and where the value lands
// on the item (see `utils/statusUniversal.ts`).

import type { DragEvent } from 'react'
import { useState } from 'react'
import type { AnyItem } from '../types/entities'
import type { CategoryId } from '../types/items'
import { assetSrc } from '../types'
import { getUniversalStatusOptions, getUniversalStatusValue } from '../utils/statusUniversal'

interface Props {
  items: AnyItem[]
  categoryId: CategoryId
  onOpen: (item: AnyItem) => void
  onSetStatus: (id: string, status: string) => void
}

export default function KanbanView({ items, categoryId, onOpen, onSetStatus }: Props) {
  const columns = getUniversalStatusOptions(categoryId)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverCol, setHoverCol] = useState<string | null>(null)

  // Bucket items by their current status. Anything with a status not
  // in the options list still gets grouped under whatever value it has
  // so it isn't lost — but the column won't render unless it's declared,
  // so those items disappear from the view. Rare in practice (only if
  // legacy data has a status that the enum dropped).
  const byStatus = new Map<string, AnyItem[]>()
  for (const c of columns) byStatus.set(c.value, [])
  for (const it of items) {
    const s = getUniversalStatusValue(it)
    if (byStatus.has(s)) byStatus.get(s)!.push(it)
  }

  if (columns.length === 0) {
    return <p className="hint">This library doesn't have a status enum, so a Kanban view can't be built.</p>
  }

  const onDragStart = (e: DragEvent, id: string) => {
    setDraggingId(id)
    // DataTransfer needs something set for Firefox to fire drop.
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
  const onDragOver = (e: DragEvent, col: string) => {
    if (!draggingId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (hoverCol !== col) setHoverCol(col)
  }
  const onDrop = (e: DragEvent, col: string) => {
    e.preventDefault()
    if (draggingId) onSetStatus(draggingId, col)
    setDraggingId(null)
    setHoverCol(null)
  }
  const onDragEnd = () => { setDraggingId(null); setHoverCol(null) }

  return (
    <div className="kanban-board">
      {columns.map((col) => {
        const list = byStatus.get(col.value) ?? []
        const hovered = hoverCol === col.value && draggingId !== null
        return (
          <div
            key={col.value}
            className={hovered ? 'kanban-col hovered' : 'kanban-col'}
            onDragOver={(e) => onDragOver(e, col.value)}
            onDrop={(e) => onDrop(e, col.value)}
            onDragLeave={() => setHoverCol((c) => c === col.value ? null : c)}
          >
            <header className="kanban-col-header">
              <span className="kanban-col-title">{col.label}</span>
              <span className="kanban-col-count">{list.length}</span>
            </header>
            <div className="kanban-col-body">
              {list.length === 0 && <p className="kanban-col-empty">Drop items here</p>}
              {list.map((it) => (
                <div
                  key={it.id}
                  className={draggingId === it.id ? 'kanban-card dragging' : 'kanban-card'}
                  draggable
                  onDragStart={(e) => onDragStart(e, it.id)}
                  onDragEnd={onDragEnd}
                  onClick={() => onOpen(it)}
                  title={it.title}
                >
                  <div className="kanban-card-cover">
                    {it.cover
                      ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                      : <span>{it.title.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="kanban-card-body">
                    <div className="kanban-card-title">{it.title}</div>
                    {it.rating ? <div className="kanban-card-rating">★ {it.rating}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

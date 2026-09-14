// Kanban board view — universal across every library.
//
// Columns = statuses for the current category. Cards are draggable
// between columns; dropping on a column applies the matching status
// patch. Every library uses this same component — the only per-
// category thing is which statuses exist and where the value lands
// on the item (see `utils/statusUniversal.ts`).

import type { DragEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useRef, useState } from 'react'
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
  // Refs (not state) for the drag tracking so the drag* event handlers
  // always read the latest value without waiting for React's next
  // render. State was letting the drop handler close over a stale
  // `draggingId === null` snapshot from the previous render, so drops
  // silently no-op'd.
  const draggingIdRef = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverCol, setHoverCol] = useState<string | null>(null)
  // Small pointerdown → pointerup delta detector so we can tell a
  // "click to open" from a "drag start" — a card that gets dragged
  // even a couple of pixels shouldn't also fire the detail-open
  // click when the drag ends.
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const didDrag = useRef(false)

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
    draggingIdRef.current = id
    setDraggingId(id)
    didDrag.current = true
    // DataTransfer needs something set for Firefox to fire drop.
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    // Explicit drag image on the card itself. WebView2 sometimes picks
    // the inner <img> as the drag source and never bubbles the drag to
    // the parent — pinning the drag image to the card guarantees the
    // whole card ships as the drag payload.
    try {
      const el = e.currentTarget as HTMLElement
      e.dataTransfer.setDragImage(el, 20, 20)
    } catch { /* older browsers */ }
  }
  // Accept drops unconditionally while the mouse is over a column. We
  // used to bail early if `draggingIdRef.current` was falsy, but any
  // race that clears the ref between dragstart and dragover then made
  // the column silently reject the drop. It's cheap to preventDefault
  // on every dragover and let the drop handler decide.
  const onDragOver = (e: DragEvent, col: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (hoverCol !== col) setHoverCol(col)
  }
  const onDrop = (e: DragEvent, col: string) => {
    e.preventDefault()
    const id = draggingIdRef.current
    if (id) onSetStatus(id, col)
    draggingIdRef.current = null
    setDraggingId(null)
    setHoverCol(null)
  }
  const onDragEnd = () => {
    draggingIdRef.current = null
    setDraggingId(null)
    setHoverCol(null)
    // Reset the click-vs-drag guard on the next tick so a legit
    // click on a card in the same view still opens the item.
    setTimeout(() => { didDrag.current = false }, 0)
  }

  // Pointer heuristics: if the user pressed but hasn't moved more than
  // 4px by the time they lift, treat as a click. Anything past that is
  // a drag intent — we let the browser handle it and skip onClick.
  const onPointerDown = (e: ReactPointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY }
    didDrag.current = false
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointerStart.current) return
    const dx = Math.abs(e.clientX - pointerStart.current.x)
    const dy = Math.abs(e.clientY - pointerStart.current.y)
    if (dx > 4 || dy > 4) didDrag.current = true
  }
  const onCardClick = (it: AnyItem) => {
    if (didDrag.current) return
    onOpen(it)
  }

  return (
    <div className="kanban-board">
      {columns.map((col) => {
        const list = byStatus.get(col.value) ?? []
        const hovered = hoverCol === col.value && draggingId !== null
        return (
          <div
            key={col.value}
            className={hovered ? 'kanban-col hovered' : 'kanban-col'}
          >
            <header className="kanban-col-header">
              <span className="kanban-col-title">{col.label}</span>
              <span className="kanban-col-count">{list.length}</span>
            </header>
            <div
              className="kanban-col-body"
              onDragOver={(e) => onDragOver(e, col.value)}
              onDrop={(e) => onDrop(e, col.value)}
              onDragLeave={() => setHoverCol((c) => c === col.value ? null : c)}
            >
              {list.length === 0 && <p className="kanban-col-empty">Drop items here</p>}
              {list.map((it) => (
                <div
                  key={it.id}
                  className={draggingId === it.id ? 'kanban-card dragging' : 'kanban-card'}
                  draggable
                  onDragStart={(e) => onDragStart(e, it.id)}
                  onDragEnd={onDragEnd}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onClick={() => onCardClick(it)}
                  title={it.title}
                >
                  <div className="kanban-card-cover">
                    {it.cover
                      ? <img src={assetSrc(it.cover)} alt="" loading="lazy" draggable={false} />
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

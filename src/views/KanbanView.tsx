// Kanban board view — universal across every library.
//
// Columns = statuses for the current category. Cards are draggable
// between columns; dropping on a column applies the matching status
// patch. Every library uses this same component — the only per-
// category thing is which statuses exist and where the value lands
// on the item (see `utils/statusUniversal.ts`).
//
// Why pointer events instead of HTML5 drag-and-drop: WebView2 (Tauri
// on Windows) has repeatedly refused to fire `dragstart` / `drop`
// reliably from these cards, even with an explicit setDragImage and
// non-draggable child images. Rather than keep fighting it, we drive
// the drag manually with pointer events + elementFromPoint hit-tests
// against the columns. Works identically across every webview.

import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
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

// A drag intent has to travel more than this many pixels before we
// treat pointerdown → pointerup as a drag. Below the threshold the
// gesture is a click and opens the item detail.
const DRAG_THRESHOLD = 5

export default function KanbanView({ items, categoryId, onOpen, onSetStatus }: Props) {
  const columns = getUniversalStatusOptions(categoryId)

  // Refs (not state) for the mid-flight drag so pointermove handlers
  // don't cause a React re-render on every mouse pixel. State is only
  // set at gesture boundaries (start / end) so the ghost card and
  // hover column highlight actually paint.
  const draggingIdRef = useRef<string | null>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const startedDrag = useRef(false)
  const ghostRef = useRef<HTMLDivElement | null>(null)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverCol, setHoverCol] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string; cover?: string } | null>(null)

  // Bucket items by their current status. Items whose status isn't in
  // the enum silently disappear from the view — that's rare (only
  // happens when a legacy value survived an enum change).
  const byStatus = new Map<string, AnyItem[]>()
  for (const c of columns) byStatus.set(c.value, [])
  for (const it of items) {
    const s = getUniversalStatusValue(it)
    if (byStatus.has(s)) byStatus.get(s)!.push(it)
  }

  // Which column (by data-col value) sits under the pointer right now?
  // We hit-test the DOM under the cursor instead of trusting drag
  // events, so this works even when the browser refuses to fire them.
  const colUnderPoint = useCallback((x: number, y: number): string | null => {
    // Temporarily hide the ghost — it sits under the cursor and would
    // always be the top element otherwise.
    const g = ghostRef.current
    const prev = g?.style.display
    if (g) g.style.display = 'none'
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    if (g && prev !== undefined) g.style.display = prev
    if (!el) return null
    const target = el.closest('[data-kanban-col]') as HTMLElement | null
    return target ? target.getAttribute('data-kanban-col') : null
  }, [])

  const endDrag = useCallback((commit: boolean, x?: number, y?: number) => {
    const id = draggingIdRef.current
    if (commit && id != null && x != null && y != null) {
      const col = colUnderPoint(x, y)
      if (col) onSetStatus(id, col)
    }
    draggingIdRef.current = null
    startedDrag.current = false
    pointerStart.current = null
    setDraggingId(null)
    setHoverCol(null)
    setGhost(null)
  }, [colUnderPoint, onSetStatus])

  // Global pointermove / pointerup listeners while a drag is live.
  // Attached on window so a fast drag that leaves the card element
  // doesn't drop the gesture. We only add them when a drag has
  // actually started (past the threshold) so idle boards don't pay
  // for a global listener.
  useEffect(() => {
    if (!draggingId) return
    const onMove = (e: PointerEvent) => {
      setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g))
      const col = colUnderPoint(e.clientX, e.clientY)
      setHoverCol(col)
    }
    const onUp = (e: PointerEvent) => {
      endDrag(true, e.clientX, e.clientY)
    }
    const onCancel = () => { endDrag(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') endDrag(false) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onEsc)
    }
  }, [draggingId, colUnderPoint, endDrag])

  if (columns.length === 0) {
    return <p className="hint">This library doesn't have a status enum, so a Kanban view can't be built.</p>
  }

  // Card pointerdown: record the anchor point but don't commit to a
  // drag yet — pointermove past the threshold is what promotes the
  // gesture to a drag. That way a plain tap still opens the item.
  const onCardPointerDown = (e: ReactPointerEvent, it: AnyItem) => {
    if (e.button !== 0) return
    pointerStart.current = { x: e.clientX, y: e.clientY }
    startedDrag.current = false
    draggingIdRef.current = it.id
  }
  const onCardPointerMove = (e: ReactPointerEvent, it: AnyItem) => {
    const start = pointerStart.current
    if (!start || startedDrag.current) return
    const dx = Math.abs(e.clientX - start.x)
    const dy = Math.abs(e.clientY - start.y)
    if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return
    // Promote to a real drag: paint the ghost + dim the source card,
    // and the global pointermove listener installed by the effect
    // takes over from here.
    startedDrag.current = true
    setDraggingId(it.id)
    setGhost({ x: e.clientX, y: e.clientY, label: it.title, cover: it.cover })
  }
  const onCardClick = (it: AnyItem) => {
    // A gesture that never crossed the drag threshold is a click.
    if (startedDrag.current) return
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
            data-kanban-col={col.value}
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
                  onPointerDown={(e) => onCardPointerDown(e, it)}
                  onPointerMove={(e) => onCardPointerMove(e, it)}
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
      {ghost && (
        <div
          ref={ghostRef}
          className="kanban-ghost"
          style={{ left: ghost.x + 12, top: ghost.y + 12 }}
        >
          <div className="kanban-card-cover">
            {ghost.cover
              ? <img src={assetSrc(ghost.cover)} alt="" draggable={false} />
              : <span>{ghost.label.charAt(0).toUpperCase()}</span>}
          </div>
          <div className="kanban-card-body">
            <div className="kanban-card-title">{ghost.label}</div>
          </div>
        </div>
      )}
    </div>
  )
}

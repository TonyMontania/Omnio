// Universal kanban board. Columns = status enum for the current
// category (see utils/statusUniversal.ts). Drag is driven by pointer
// events + elementFromPoint because HTML5 drag-and-drop doesn't fire
// reliably from these cards under WebView2 on Windows.

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

// Below this pixel distance the gesture is treated as a click.
const DRAG_THRESHOLD = 5

export default function KanbanView({ items, categoryId, onOpen, onSetStatus }: Props) {
  const columns = getUniversalStatusOptions(categoryId)

  // Refs for the mid-flight drag so pointermove doesn't re-render every
  // mouse pixel; state is set only at gesture boundaries.
  const draggingIdRef = useRef<string | null>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const startedDrag = useRef(false)
  const ghostRef = useRef<HTMLDivElement | null>(null)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverCol, setHoverCol] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string; cover?: string } | null>(null)

  const byStatus = new Map<string, AnyItem[]>()
  for (const c of columns) byStatus.set(c.value, [])
  for (const it of items) {
    const s = getUniversalStatusValue(it)
    if (byStatus.has(s)) byStatus.get(s)!.push(it)
  }

  const colUnderPoint = useCallback((x: number, y: number): string | null => {
    // Hide the ghost during the hit-test so it doesn't return itself.
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
  //
  // The effect depends ONLY on `draggingId`. Reading fresh callbacks
  // from refs inside the handlers keeps the effect from tearing down
  // and reinstalling on every re-render (setGhost fires on every
  // pointermove — the churn used to swallow the first Esc press
  // because the keydown listener was momentarily absent between the
  // cleanup and the reinstall).
  const colUnderPointRef = useRef(colUnderPoint)
  const endDragRef = useRef(endDrag)
  colUnderPointRef.current = colUnderPoint
  endDragRef.current = endDrag
  useEffect(() => {
    if (!draggingId) return
    const onMove = (e: PointerEvent) => {
      setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g))
      setHoverCol(colUnderPointRef.current(e.clientX, e.clientY))
    }
    const onUp = (e: PointerEvent) => { endDragRef.current(true, e.clientX, e.clientY) }
    const onCancel = () => { endDragRef.current(false) }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      endDragRef.current(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    // Capture phase so we run before App.tsx's own Escape handler
    // (which might close a panel behind the drag if it went first).
    window.addEventListener('keydown', onEsc, true)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onEsc, true)
    }
  }, [draggingId])

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

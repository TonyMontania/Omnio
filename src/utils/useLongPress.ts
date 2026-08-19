// Long-press hook for touch users. Desktop already gets a context menu
// through `onContextMenu` (right click); on a touchscreen there is no
// right click, so a hold-to-open gesture stands in.
//
// Contract:
//   - fires `onLongPress(x, y)` after `delayMs` if the user hasn't
//     lifted or moved beyond `moveTolerancePx`
//   - cancels on touchmove past the tolerance, on touchend, and on
//     touchcancel — so scrolling still works
//   - suppresses the synthetic click that follows a long press by
//     stopping propagation on the fired touchend
//
// Attach the returned object to any element: <div {...longPress}> or
// spread alongside other props. Does nothing on non-touch pointers so
// mouse users keep their existing context-menu behavior untouched.

import { useRef } from 'react'

export interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  onTouchCancel: (e: React.TouchEvent) => void
}

export function useLongPress(
  onLongPress: (x: number, y: number) => void,
  opts: { delayMs?: number; moveTolerancePx?: number } = {},
): LongPressHandlers {
  const { delayMs = 500, moveTolerancePx = 10 } = opts
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  return {
    onTouchStart: (e) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
      fired.current = false
      clear()
      timer.current = window.setTimeout(() => {
        fired.current = true
        onLongPress(t.clientX, t.clientY)
      }, delayMs)
    },
    onTouchMove: (e) => {
      if (!start.current || !timer.current) return
      const t = e.touches[0]
      const dx = t.clientX - start.current.x
      const dy = t.clientY - start.current.y
      if (Math.hypot(dx, dy) > moveTolerancePx) clear()
    },
    onTouchEnd: (e) => {
      clear()
      if (fired.current) {
        // Swallow the click that would otherwise follow this touchend
        // so we don't also fire onOpen after showing the context menu.
        e.preventDefault()
        e.stopPropagation()
        fired.current = false
      }
      start.current = null
    },
    onTouchCancel: () => {
      clear()
      start.current = null
      fired.current = false
    },
  }
}

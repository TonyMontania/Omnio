// Right-click / long-press menu that appears over any ItemCard. Renders
// as a fixed-position popover clamped to the viewport, so it never spills
// off the screen even in a top-right card. Consumer decides which
// actions to include via the actions prop; each entry is { label, kind,
// onClick, danger? } and the menu handles keyboard navigation + Escape
// dismiss on its own.

import { useEffect, useRef } from 'react'

export interface CardMenuAction {
  label: string
  onClick: () => void
  danger?: boolean
  divider?: boolean       // renders as a horizontal separator; label/onClick ignored
}

interface Props {
  x: number
  y: number
  actions: CardMenuAction[]
  onClose: () => void
}

export default function CardContextMenu({ x, y, actions, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Clamp against viewport so a right-edge card doesn't clip the menu.
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    let nx = x, ny = y
    if (nx + r.width > vw - 8) nx = vw - r.width - 8
    if (ny + r.height > vh - 8) ny = vh - r.height - 8
    el.style.left = `${Math.max(8, nx)}px`
    el.style.top = `${Math.max(8, ny)}px`
  }, [x, y, actions.length])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', zIndex: 1000,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        padding: 4,
        minWidth: 180,
        display: 'flex', flexDirection: 'column', gap: 0,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {actions.map((a, i) => a.divider ? (
        <div key={`div-${i}`} style={{ height: 1, background: 'var(--border-soft)', margin: '4px 0' }} />
      ) : (
        <button
          key={`${a.label}-${i}`}
          type="button"
          onClick={() => { a.onClick(); onClose() }}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '6px 10px',
            background: 'transparent', border: 'none',
            color: a.danger ? 'var(--danger)' : 'var(--text)',
            fontSize: 13, cursor: 'pointer', borderRadius: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >{a.label}</button>
      ))}
    </div>
  )
}

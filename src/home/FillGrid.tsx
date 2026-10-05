import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { fillLayout } from './fillLayout'

interface Props<T> {
  items: T[]
  minWidth: number
  gap: number
  rows: number
  className: string
  stretch?: boolean
  children: (item: T) => ReactNode
}

export default function FillGrid<T>({ items, minWidth, gap, rows, className, stretch = false, children }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { columns, count } = fillLayout({ width, available: items.length, minWidth, gap, rows, stretch })

  return (
    <div ref={ref} className={className} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {items.slice(0, count).map(children)}
    </div>
  )
}

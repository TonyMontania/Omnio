// GitHub-style yearly activity heatmap. Reads the same `finishedAt` field
// each detail modal already writes on completion — nothing new to fill in.
// Rendered from the Statistics view; one grid per category.

import { useMemo, useState } from 'react'
import type { Item } from '../types'

interface Props {
  items: Item[]
  label?: string
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isoOrNull(s?: string | null): string | null {
  if (!s) return null
  // Accept 'YYYY-MM-DD' or full ISO. Reject anything else.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

const WEEK_MS = 7 * 24 * 3600 * 1000
const DAY_MS = 24 * 3600 * 1000

export default function Heatmap({ items, label }: Props) {
  const availableYears = useMemo(() => {
    const set = new Set<number>()
    for (const it of items) {
      const d = isoOrNull(it.finishedAt)
      if (d) set.add(parseInt(d.slice(0, 4), 10))
    }
    if (set.size === 0) set.add(new Date().getFullYear())
    return Array.from(set).sort((a, b) => b - a)
  }, [items])

  const [year, setYear] = useState<number>(availableYears[0])

  // Group finishedAt counts by day for the chosen year.
  const buckets = useMemo(() => {
    const m: Record<string, Item[]> = {}
    for (const it of items) {
      const d = isoOrNull(it.finishedAt)
      if (!d || !d.startsWith(`${year}-`)) continue
      if (!m[d]) m[d] = []
      m[d].push(it)
    }
    return m
  }, [items, year])

  // Layout: 53 columns × 7 rows. Column 0 is the ISO week that contains
  // Jan 1st; each subsequent column is +7 days.
  const cells = useMemo(() => {
    const jan1 = new Date(Date.UTC(year, 0, 1))
    // Roll back to the Sunday on or before Jan 1st so the column reads top-to-bottom Sun→Sat.
    const start = new Date(jan1.getTime() - jan1.getUTCDay() * DAY_MS)
    const columns: { date: Date; inYear: boolean; key: string; count: number }[][] = []
    for (let col = 0; col < 53; col++) {
      const week: typeof columns[number] = []
      for (let row = 0; row < 7; row++) {
        const date = new Date(start.getTime() + col * WEEK_MS + row * DAY_MS)
        const k = dayKey(date)
        week.push({
          date,
          inYear: date.getUTCFullYear() === year,
          key: k,
          count: buckets[k]?.length ?? 0,
        })
      }
      columns.push(week)
    }
    return columns
  }, [year, buckets])

  const max = useMemo(() => Object.values(buckets).reduce((m, arr) => Math.max(m, arr.length), 0), [buckets])
  const total = useMemo(() => Object.values(buckets).reduce((s, arr) => s + arr.length, 0), [buckets])

  const level = (n: number): number => {
    if (n === 0) return 0
    if (max <= 1) return 4
    const r = n / max
    if (r > 0.75) return 4
    if (r > 0.5) return 3
    if (r > 0.25) return 2
    return 1
  }

  const monthLabels = useMemo(() => {
    const seen: Record<number, number> = {}
    const out: { col: number; label: string }[] = []
    cells.forEach((week, col) => {
      const first = week.find((d) => d.inYear)
      if (!first) return
      const m = first.date.getUTCMonth()
      if (seen[m] === undefined) {
        seen[m] = col
        out.push({ col, label: new Date(Date.UTC(2000, m, 1)).toLocaleString('en', { month: 'short' }) })
      }
    })
    return out
  }, [cells])

  return (
    <div className="heatmap">
      <div className="heatmap-head">
        <div className="heatmap-title">
          <h4>{label ?? 'Completion activity'}</h4>
          <span className="heatmap-meta">
            {total} {total === 1 ? 'item' : 'items'} finished in {year}
          </span>
        </div>
        <div className="heatmap-years">
          {availableYears.map((y) => (
            <button
              key={y}
              type="button"
              className={y === year ? 'on' : ''}
              onClick={() => setYear(y)}
            >{y}</button>
          ))}
        </div>
      </div>

      <div className="heatmap-scroll">
        <div className="heatmap-grid">
          <div className="heatmap-months">
            {monthLabels.map((m) => (
              <span key={m.label} style={{ gridColumnStart: m.col + 1 }}>{m.label}</span>
            ))}
          </div>
          <div className="heatmap-days">
            {cells.map((week, col) => (
              <div key={col} className="heatmap-week">
                {week.map((cell) => (
                  <div
                    key={cell.key}
                    className={`heatmap-cell l${level(cell.count)}${cell.inYear ? '' : ' outside'}`}
                    title={cell.inYear ? `${cell.key} · ${cell.count} ${cell.count === 1 ? 'item' : 'items'}` : ''}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="heatmap-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => <div key={l} className={`heatmap-cell l${l}`} />)}
        <span>More</span>
      </div>
    </div>
  )
}

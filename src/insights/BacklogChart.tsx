// Backlog burndown chart. Two bars per month over the last 12 months:
//   - Added this month (createdAt fell in that window)
//   - Completed this month (finishedAt fell in that window)
//
// Purely descriptive — no "backlog is growing" alerts, no
// comparisons, no red numbers. Just the two counts side by side so
// the user can see their own patterns.

import { useMemo, useState } from 'react'
import type { Item } from '../types'
import { CATEGORIES } from '../categories'

interface Props {
  items: Item[]
  enabledCategories?: readonly string[]
}

interface MonthBucket {
  key: string
  label: string
  added: number
  completed: number
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

function isFinished(it: Item): boolean {
  if (it.gameStatus === 'completed') return true
  if (it.watchStatus === 'completed') return true
  if (it.seriesStatus === 'completed') return true
  if (it.mangaStatus === 'completed') return true
  if (it.bookStatus === 'completed') return true
  if (it.visualNovelStatus === 'completed') return true
  if (it.consumed === true && (it.categoryId === 'musica' || it.categoryId === 'peliculas')) return true
  return false
}

function parseFinishedDate(it: Item): Date | null {
  if (!it.finishedAt) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(it.finishedAt)
  if (!m) return null
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10))
  return Number.isNaN(d.getTime()) ? null : d
}

function buildBuckets(items: Item[], months: number, now: Date): MonthBucket[] {
  const buckets: MonthBucket[] = []
  const cursor = startOfMonth(now)
  // Walk backwards to build the ordered list, then reverse.
  for (let i = 0; i < months; i++) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1)
    buckets.push({ key: monthKey(d), label: monthLabel(d), added: 0, completed: 0 })
  }
  buckets.reverse()
  const idxByKey = new Map(buckets.map((b, i) => [b.key, i]))

  for (const it of items) {
    if (it.createdAt) {
      const d = new Date(it.createdAt)
      const key = monthKey(d)
      const idx = idxByKey.get(key)
      if (idx !== undefined) buckets[idx].added += 1
    }
    if (isFinished(it)) {
      const d = parseFinishedDate(it)
      if (d) {
        const key = monthKey(d)
        const idx = idxByKey.get(key)
        if (idx !== undefined) buckets[idx].completed += 1
      }
    }
  }
  return buckets
}

export default function BacklogChart({ items, enabledCategories }: Props) {
  const [monthsToShow, setMonthsToShow] = useState<number>(12)
  const [scope, setScope] = useState<string>('all')

  const now = useMemo(() => new Date(), [])

  const scoped = useMemo(() => {
    const catSet = new Set<string>(enabledCategories ?? CATEGORIES.map((c) => c.id))
    return items.filter((it) => {
      if (!catSet.has(it.categoryId)) return false
      if (scope !== 'all' && it.categoryId !== scope) return false
      return true
    })
  }, [items, scope, enabledCategories])

  const buckets = useMemo(() => buildBuckets(scoped, monthsToShow, now), [scoped, monthsToShow, now])
  const max = useMemo(() => {
    let m = 0
    for (const b of buckets) {
      if (b.added > m) m = b.added
      if (b.completed > m) m = b.completed
    }
    return Math.max(m, 3)
  }, [buckets])

  const totalAdded = buckets.reduce((s, b) => s + b.added, 0)
  const totalDone = buckets.reduce((s, b) => s + b.completed, 0)

  const cats = CATEGORIES.filter((c) => !enabledCategories || enabledCategories.includes(c.id))

  return (
    <div className="backlog-chart">
      <div className="backlog-chart-header">
        <div>
          <h3 className="insights-subheading" style={{ margin: 0 }}>Added vs finished</h3>
          <span className="hint">Two bars per month — items you added, items you finished. Not a scoreboard, just what happened.</span>
        </div>
        <div className="backlog-chart-controls">
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">All libraries</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={monthsToShow} onChange={(e) => setMonthsToShow(parseInt(e.target.value, 10))}>
            {[6, 12, 24, 36].map((n) => <option key={n} value={n}>{n} months</option>)}
          </select>
        </div>
      </div>

      <div className="backlog-chart-body">
        {buckets.map((b) => {
          const addedPct = (b.added / max) * 100
          const donePct = (b.completed / max) * 100
          return (
            <div key={b.key} className="backlog-chart-col" title={`${b.label} · added ${b.added} · finished ${b.completed}`}>
              <div className="backlog-chart-bars">
                <div
                  className="backlog-chart-bar bar-added"
                  style={{ height: `${addedPct}%` }}
                >{b.added > 0 && <span className="backlog-chart-bar-value">{b.added}</span>}</div>
                <div
                  className="backlog-chart-bar bar-done"
                  style={{ height: `${donePct}%` }}
                >{b.completed > 0 && <span className="backlog-chart-bar-value">{b.completed}</span>}</div>
              </div>
              <span className="backlog-chart-label">{b.label}</span>
            </div>
          )
        })}
      </div>

      <div className="backlog-chart-legend">
        <span className="legend-swatch swatch-added"></span>
        <span>Added ({totalAdded})</span>
        <span className="legend-swatch swatch-done"></span>
        <span>Finished ({totalDone})</span>
      </div>
    </div>
  )
}

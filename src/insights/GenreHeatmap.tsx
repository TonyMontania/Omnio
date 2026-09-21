// Cross-library genre heatmap. Rows are the top-N genres across every
// enabled category; columns are the categories themselves. Cell
// intensity scales with the count — logarithmic so a music-heavy
// library doesn't wash out low-count games/movies genres.
//
// Sits above the per-category Statistics view so the user can see at
// a glance where their tastes cluster: "half my anime is Action, but
// most of my music is Rock, and my books are exclusively Fantasy".
// No time filter — this is a snapshot, not a timeline.

import { useMemo, useState } from 'react'
import type { Item } from '../types'
import { CATEGORIES } from '../categories'

interface Props {
  items: Item[]
  enabledCategories?: readonly string[]
}

interface RowStat {
  genre: string
  total: number
  perCategory: Map<string, number>
}

const DEFAULT_TOP = 15
const MIN_ROW_COUNT = 2  // hide one-off genres

function collectGenreStats(items: Item[], categoryIds: readonly string[]): RowStat[] {
  const catSet = new Set(categoryIds)
  const byGenre = new Map<string, RowStat>()
  for (const it of items) {
    if (!catSet.has(it.categoryId)) continue
    const gs = it.genres
    if (!gs || gs.length === 0) continue
    for (const raw of gs) {
      const g = raw.trim()
      if (!g) continue
      let row = byGenre.get(g)
      if (!row) {
        row = { genre: g, total: 0, perCategory: new Map() }
        byGenre.set(g, row)
      }
      row.total += 1
      row.perCategory.set(it.categoryId, (row.perCategory.get(it.categoryId) ?? 0) + 1)
    }
  }
  return Array.from(byGenre.values())
    .filter((r) => r.total >= MIN_ROW_COUNT)
    .sort((a, b) => b.total - a.total)
}

// Log-scaled intensity in [0, 1]. Zero counts render as an empty cell;
// counts saturate as they approach `max`.
function intensity(count: number, max: number): number {
  if (count <= 0) return 0
  if (max <= 1) return count > 0 ? 1 : 0
  return Math.log1p(count) / Math.log1p(max)
}

export default function GenreHeatmap({ items, enabledCategories }: Props) {
  const [topN, setTopN] = useState<number>(DEFAULT_TOP)
  const cats = useMemo(
    () => CATEGORIES.filter((c) => !enabledCategories || enabledCategories.includes(c.id)),
    [enabledCategories],
  )

  const rows = useMemo(() => collectGenreStats(items, cats.map((c) => c.id)), [items, cats])
  const visibleRows = rows.slice(0, topN)

  const maxCount = useMemo(() => {
    let max = 0
    for (const r of visibleRows) {
      for (const [, v] of r.perCategory) if (v > max) max = v
    }
    return max
  }, [visibleRows])

  if (visibleRows.length === 0) {
    return (
      <div className="genre-heatmap-empty">
        <p className="hint">No genres tagged yet across your libraries. Add a genre or two to a few items and this heatmap lights up.</p>
      </div>
    )
  }

  return (
    <div className="genre-heatmap">
      <div className="genre-heatmap-header">
        <div>
          <h3 className="insights-subheading" style={{ margin: 0 }}>Genres across libraries</h3>
          <span className="hint">Cell intensity scales with the item count in that library. Empty cells mean no items with that genre in that library.</span>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="hint">Show top</span>
          <select value={topN} onChange={(e) => setTopN(parseInt(e.target.value, 10))}>
            {[10, 15, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      <div className="genre-heatmap-scroll">
        <table className="genre-heatmap-table">
          <thead>
            <tr>
              <th className="genre-heatmap-corner"></th>
              {cats.map((c) => <th key={c.id} className="genre-heatmap-col-head">{c.label}</th>)}
              <th className="genre-heatmap-total-head">Total</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.genre}>
                <td className="genre-heatmap-row-head" title={r.genre}>{r.genre}</td>
                {cats.map((c) => {
                  const count = r.perCategory.get(c.id) ?? 0
                  const alpha = intensity(count, maxCount)
                  const bg = count > 0
                    ? `color-mix(in srgb, var(--accent) ${(alpha * 90).toFixed(0)}%, transparent)`
                    : 'transparent'
                  return (
                    <td
                      key={c.id}
                      className="genre-heatmap-cell"
                      style={{ background: bg, color: alpha > 0.55 ? '#1a1408' : undefined }}
                      title={`${r.genre} · ${c.label} · ${count} item${count === 1 ? '' : 's'}`}
                    >{count > 0 ? count : ''}</td>
                  )
                })}
                <td className="genre-heatmap-total">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > topN && (
        <p className="hint" style={{ marginTop: 8 }}>
          Showing top {topN} of {rows.length} genres. {rows.length - topN} more hidden.
        </p>
      )}
    </div>
  )
}

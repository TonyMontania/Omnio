// Timeline view — horizontal scroll of items by release / start year.
//
// Items are grouped into year buckets and rendered as covers pinned
// under the year label. Fast visual for "when did this stuff come
// out". Categories without a release-date field (or items missing it)
// aren't included — they'd distort the timeline. A hint at the bottom
// counts how many were skipped so users can go find + fill their
// missing year field.

import type { AnyItem } from '../types/entities'
import { assetSrc } from '../types'

interface Props {
  items: AnyItem[]
  onOpen: (item: AnyItem) => void
}

function pickYear(it: AnyItem): number | null {
  // NOTE: use `||`, not `??`. An unset year field on a game/book is
  // typically the empty string `''`, which is not nullish — `??` would
  // stop there instead of falling through to the next candidate. The
  // truthy-fallback chain skips empty strings and picks the first
  // populated value.
  const raw = it.releaseYear
    || it.seasonYear
    || it.startYear
    || (it.airedFrom ? it.airedFrom.slice(0, 4) : '')
    || (it.releaseDate ? it.releaseDate.slice(0, 4) : '')
    || ''
  const n = parseInt(String(raw), 10)
  if (isNaN(n) || n < 1000 || n > 3000) return null
  return n
}

export default function TimelineView({ items, onOpen }: Props) {
  const buckets = new Map<number, AnyItem[]>()
  let missing = 0
  for (const it of items) {
    const y = pickYear(it)
    if (y === null) { missing += 1; continue }
    if (!buckets.has(y)) buckets.set(y, [])
    buckets.get(y)!.push(it)
  }
  const years = Array.from(buckets.keys()).sort((a, b) => a - b)

  if (years.length === 0) {
    return <p className="hint">No items have a release year yet. Fill in the "Year" or "Release date" field to see them here.</p>
  }

  return (
    <div className="timeline-view">
      <div className="timeline-track">
        {years.map((year) => {
          const list = buckets.get(year)!.slice().sort((a, b) => a.title.localeCompare(b.title))
          return (
            <div key={year} className="timeline-year">
              <div className="timeline-year-label">{year}</div>
              <div className="timeline-year-count">{list.length}</div>
              <div className="timeline-year-covers">
                {list.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className="timeline-cover"
                    onClick={() => onOpen(it)}
                    title={`${it.title} (${year})`}
                  >
                    {it.cover
                      ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                      : <span>{it.title.charAt(0).toUpperCase()}</span>}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {missing > 0 && (
        <p className="hint" style={{ marginTop: 12 }}>
          {missing} item{missing === 1 ? '' : 's'} not shown — missing a release year.
        </p>
      )}
    </div>
  )
}

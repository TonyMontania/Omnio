// Diary view — chronological log of the current library.
//
// Entries are keyed by whichever of `finishedAt` / `createdAt` exists,
// grouped by month. Renders like a Letterboxd diary: each row is a
// dated entry with cover + title + optional review snippet. Kept read-
// only; edits still go through the regular editor.

import type { AnyItem } from '../types/entities'
import { assetSrc } from '../types'

interface Props {
  items: AnyItem[]
  onOpen: (item: AnyItem) => void
}

interface Entry {
  item: AnyItem
  date: Date
  kind: 'finished' | 'added'
}

function entryDate(it: AnyItem): { date: Date; kind: 'finished' | 'added' } | null {
  if (it.finishedAt) {
    const t = new Date(it.finishedAt).getTime()
    if (!isNaN(t)) return { date: new Date(t), kind: 'finished' }
  }
  if (it.createdAt) return { date: new Date(it.createdAt), kind: 'added' }
  return null
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function reviewFor(it: AnyItem): string | undefined {
  return it.gameReview ?? it.seriesReview ?? it.bookReview ?? it.vnReview ?? it.notes
}

export default function DiaryView({ items, onOpen }: Props) {
  const entries: Entry[] = []
  for (const it of items) {
    const d = entryDate(it)
    if (d) entries.push({ item: it, ...d })
  }
  entries.sort((a, b) => b.date.getTime() - a.date.getTime())

  if (entries.length === 0) {
    return <p className="hint">Nothing dated yet. Add items or set a "Finished on" date to see them here.</p>
  }

  // Bucket by month for the sidebar labels.
  const groups = new Map<string, { label: string; entries: Entry[] }>()
  for (const e of entries) {
    const key = monthKey(e.date)
    if (!groups.has(key)) groups.set(key, { label: monthLabel(e.date), entries: [] })
    groups.get(key)!.entries.push(e)
  }

  return (
    <div className="diary-view">
      {Array.from(groups.entries()).map(([key, group]) => (
        <section key={key} className="diary-month">
          <h3 className="diary-month-label">{group.label}</h3>
          <ul className="diary-entries">
            {group.entries.map((e, i) => {
              const review = reviewFor(e.item)
              return (
                <li key={`${e.item.id}-${i}`} className="diary-entry" onClick={() => onOpen(e.item)}>
                  <div className="diary-entry-day">
                    <span className="diary-entry-num">{e.date.getDate()}</span>
                    <span className="diary-entry-dow">{e.date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                  </div>
                  <div className="diary-entry-cover">
                    {e.item.cover
                      ? <img src={assetSrc(e.item.cover)} alt="" loading="lazy" />
                      : <span>{e.item.title.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="diary-entry-body">
                    <div className="diary-entry-title">{e.item.title}</div>
                    <div className="diary-entry-meta">
                      <span className={`diary-entry-kind kind-${e.kind}`}>{e.kind === 'finished' ? 'Finished' : 'Added'}</span>
                      {e.item.rating ? <span className="diary-entry-rating">★ {e.item.rating}</span> : null}
                    </div>
                    {review && <p className="diary-entry-review">{review.length > 240 ? review.slice(0, 240) + '…' : review}</p>}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

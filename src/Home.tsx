// Home dashboard — landing view showing every library as a portal card
// with a cover strip, count breakdown and recent activity, plus two
// cross-library sections underneath (upcoming releases, in progress).
//
// Reads the existing items[] state; no separate storage. Click any
// library card → jump into that library's full view. Click any item
// (cover or "in progress" row) → open its detail view.

import { useMemo } from 'react'
import type { Item } from './types'
import { assetSrc } from './types'
import { CATEGORIES } from './categories'
import { CategoryIcon, CalendarIcon } from './icons'

interface Props {
  items: Item[]
  enabledCategories?: string[]
  onOpenCategory: (id: string) => void
  onOpenItem: (item: Item) => void
  onOpenCalendar: () => void
}

// Rank an item's recency by whichever of finishedAt / createdAt is
// larger — items you edited most recently bubble up.
function recencyScore(it: Item): number {
  const f = it.finishedAt ? new Date(it.finishedAt).getTime() : 0
  const c = it.createdAt ?? 0
  return Math.max(f, c)
}

// Same date-parse helpers as ReleaseCalendar so upcoming stays consistent.
function parseISODate(s?: string): Date | null {
  if (!s) return null
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(s)
  if (!m) return null
  return new Date(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) - 1 : 0, m[3] ? parseInt(m[3], 10) : 1)
}
function parseYear(y?: string): Date | null {
  if (!y || !/^\d{4}$/.test(y.trim())) return null
  return new Date(parseInt(y, 10), 0, 1)
}

// Per-category "in progress" predicate. Matches Games playing, manga
// reading, anime watching, series watching, books reading, music unheard.
function isInProgress(it: Item): boolean {
  if (it.categoryId === 'videojuegos') return it.gameStatus === 'playing'
  if (it.categoryId === 'anime' || it.categoryId === 'donghua') return it.watchStatus === 'watching'
  if (it.categoryId === 'series') return it.seriesStatus === 'watching'
  if (it.categoryId === 'manga' || it.categoryId === 'manhwa' || it.categoryId === 'manhua' || it.categoryId === 'comics_west') return it.mangaStatus === 'reading'
  if (it.categoryId === 'libros') return it.bookStatus === 'reading'
  return false
}

// One-line status summary shown at the bottom of each library card.
function summarizeCategory(catId: string, list: Item[]): string {
  if (list.length === 0) return 'Empty'
  const n = list.length
  const count = (pred: (i: Item) => boolean) => list.filter(pred).length
  switch (catId) {
    case 'videojuegos': {
      const backlog = count((i) => (i.gameStatus ?? 'backlog') === 'backlog')
      const done = count((i) => i.gameStatus === 'completed')
      return `${n} total · ${backlog} backlog · ${done} completed`
    }
    case 'peliculas': {
      const w = count((i) => !!i.consumed)
      return `${n} total · ${w} watched · ${n - w} unwatched`
    }
    case 'musica': {
      const heard = count((i) => !!i.consumed)
      return `${n} albums · ${heard} listened`
    }
    case 'series': {
      const done = count((i) => i.seriesStatus === 'completed')
      return `${n} total · ${done} completed`
    }
    case 'anime': case 'donghua': {
      const done = count((i) => i.watchStatus === 'completed')
      return `${n} total · ${done} completed`
    }
    case 'manga': case 'manhwa': case 'manhua': case 'comics_west': {
      const done = count((i) => i.mangaStatus === 'completed')
      return `${n} total · ${done} completed`
    }
    case 'libros': {
      const done = count((i) => i.bookStatus === 'completed')
      return `${n} total · ${done} completed`
    }
    default: return `${n} items`
  }
}

export default function Home({ items, enabledCategories, onOpenCategory, onOpenItem, onOpenCalendar }: Props) {
  const today = useMemo(() => new Date(), [])
  const greeting = useMemo(() => {
    const h = today.getHours()
    return h < 6 ? 'Late night' : h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening'
  }, [today])
  const dateLabel = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const cats = CATEGORIES.filter((c) => !enabledCategories || enabledCategories.includes(c.id))

  const inProgress = useMemo(
    () => items.filter(isInProgress).sort((a, b) => recencyScore(b) - recencyScore(a)).slice(0, 12),
    [items],
  )

  const upcoming = useMemo(() => {
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const horizon = new Date(startOfToday); horizon.setDate(horizon.getDate() + 30)
    const out: { item: Item; date: Date; label: string }[] = []
    for (const it of items) {
      const d = parseISODate(it.releaseDate) ?? parseISODate(it.airedFrom) ?? parseYear(it.releaseYear) ?? parseYear(it.startYear)
      if (!d || d < startOfToday || d > horizon) continue
      out.push({ item: it, date: d, label: it.airedFrom && !it.releaseDate ? 'Airs from' : 'Release' })
    }
    return out.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 6)
  }, [items, today])

  return (
    <div className="home">
      <div className="content-header">
        <div className="page-title">
          <div>
            <h1>{greeting}</h1>
            <span className="page-count">{dateLabel}</span>
          </div>
        </div>
      </div>

      <div className="content-scroll">

        <div className="home-lib-grid">
          {cats.map((c) => {
            const list = items.filter((i) => i.categoryId === c.id)
            const covers = list.slice().sort((a, b) => recencyScore(b) - recencyScore(a)).slice(0, 6)
            const recent = covers.slice(0, 3)
            return (
              <button
                key={c.id}
                type="button"
                className="home-lib-card"
                onClick={() => onOpenCategory(c.id)}
              >
                <div className="home-lib-header">
                  <span className="home-lib-icon"><CategoryIcon id={c.id} /></span>
                  <span className="home-lib-name">{c.label}</span>
                  <span className="home-lib-count">{list.length}</span>
                </div>
                <div className="home-lib-covers">
                  {covers.length === 0 ? (
                    <div className="home-lib-empty">Empty — click to start adding {c.singular}s</div>
                  ) : (
                    covers.map((it) => (
                      <div
                        key={it.id}
                        className="home-lib-cover"
                        onClick={(e) => { e.stopPropagation(); onOpenItem(it) }}
                        title={it.title}
                      >
                        {it.cover
                          ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                          : <span className="home-lib-cover-fallback">{it.title.charAt(0).toUpperCase()}</span>}
                      </div>
                    ))
                  )}
                </div>
                <div className="home-lib-summary">{summarizeCategory(c.id, list)}</div>
                {recent.length > 0 && (
                  <ul className="home-lib-recent">
                    {recent.map((it) => (
                      <li
                        key={it.id}
                        onClick={(e) => { e.stopPropagation(); onOpenItem(it) }}
                      >{it.title}</li>
                    ))}
                  </ul>
                )}
              </button>
            )
          })}
        </div>

        {inProgress.length > 0 && (
          <section className="home-section">
            <div className="home-section-header">
              <h2>Currently in progress</h2>
              <span className="page-count">{inProgress.length}</span>
            </div>
            <div className="home-progress-strip">
              {inProgress.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="home-progress-card"
                  onClick={() => onOpenItem(it)}
                >
                  <div className="home-progress-cover">
                    {it.cover
                      ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                      : <span>{it.title.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="home-progress-title">{it.title}</div>
                  <div className="home-progress-sub">{CATEGORIES.find((c) => c.id === it.categoryId)?.label}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {upcoming.length > 0 && (
          <section className="home-section">
            <div className="home-section-header">
              <h2>Coming up in the next 30 days</h2>
              <button type="button" className="secondary-btn" onClick={onOpenCalendar}><CalendarIcon /> Full calendar</button>
            </div>
            <div className="home-upcoming-list">
              {upcoming.map((e, i) => (
                <button
                  key={`${e.item.id}-${i}`}
                  type="button"
                  className="home-upcoming-row"
                  onClick={() => onOpenItem(e.item)}
                >
                  <div className="home-upcoming-cover">
                    {e.item.cover
                      ? <img src={assetSrc(e.item.cover)} alt="" loading="lazy" />
                      : <span>{e.item.title.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="home-upcoming-body">
                    <div className="home-upcoming-title">{e.item.title}</div>
                    <div className="home-upcoming-sub">
                      {e.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}{e.label}
                      {' · '}{CATEGORIES.find((c) => c.id === e.item.categoryId)?.label}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}

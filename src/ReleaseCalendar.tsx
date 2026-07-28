// Upcoming-releases view. Reads every date-bearing field on every item
// (releaseDate for games/movies/albums, startDate for anime/manga,
// airedFrom for anime, endDate on manga volumes if present) and renders
// two things: a "Coming up" list of everything in the future, sorted
// ascending, plus a compact month grid you can page through.
//
// No fetch, no network — just a projection of what's already saved.
// Items live in your backlog with real dates from AniList / TMDb / IGDB
// / MangaDex fetches, and this view surfaces the ones you'll want to
// know about instead of scrolling each library looking for them.

import { useMemo, useState } from 'react'
import type { Item } from './types'
import { assetSrc } from './types'
import { CATEGORIES } from './categories'
import { CalendarIcon } from './icons'

interface Props {
  items: Item[]
  onNavigate: (item: Item) => void
}

type Entry = { item: Item; date: Date; label: string; source: 'release' | 'aired' }

function parseISODate(s?: string): Date | null {
  if (!s) return null
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(s)
  if (!m) return null
  const y = parseInt(m[1], 10)
  const mo = m[2] ? parseInt(m[2], 10) - 1 : 0
  const d = m[3] ? parseInt(m[3], 10) : 1
  const dt = new Date(y, mo, d)
  return Number.isNaN(dt.getTime()) ? null : dt
}

// Pick every candidate date on an item and return the ones in the future
// (or today). Same item can produce multiple entries — e.g. an anime with
// airedFrom (season starts) shows separately from its releaseDate.
function collectEntries(items: Item[], today: Date): Entry[] {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const out: Entry[] = []
  for (const it of items) {
    const push = (raw: string | undefined, label: string, source: Entry['source']) => {
      const d = parseISODate(raw)
      if (!d || d < startOfToday) return
      out.push({ item: it, date: d, label, source })
    }
    push(it.releaseDate, 'Release', 'release')
    push(it.airedFrom, 'Airs from', 'aired')
    push(it.startDate, 'Starts', 'release')
  }
  // Dedup: same item + same date + same source is redundant.
  const seen = new Set<string>()
  return out.filter((e) => {
    const key = `${e.item.id}-${e.date.toISOString().slice(0, 10)}-${e.source}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => a.date.getTime() - b.date.getTime())
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
function fmtDay(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export default function ReleaseCalendar({ items, onNavigate }: Props) {
  const today = useMemo(() => new Date(), [])
  const [monthCursor, setMonthCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  const filteredItems = useMemo(
    () => (categoryFilter ? items.filter((i) => i.categoryId === categoryFilter) : items),
    [items, categoryFilter],
  )
  const entries = useMemo(() => collectEntries(filteredItems, today), [filteredItems, today])
  const monthEntries = useMemo(() => entries.filter((e) => isSameMonth(e.date, monthCursor)), [entries, monthCursor])

  // Group month entries by day-of-month for grid rendering.
  const byDay = useMemo(() => {
    const map = new Map<number, Entry[]>()
    for (const e of monthEntries) {
      const d = e.date.getDate()
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(e)
    }
    return map
  }, [monthEntries])

  const days = daysInMonth(monthCursor.getFullYear(), monthCursor.getMonth())
  const firstDayWeekday = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay()

  const prevMonth = () => setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
  const nextMonth = () => setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
  const jumpToday = () => setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1))

  const upcoming = entries.slice(0, 20)

  return (
    <div className="release-calendar">
      <div className="content-header">
        <div className="page-title">
          <span className="page-icon"><CalendarIcon /></span>
          <div>
            <h1>Release calendar</h1>
            <span className="page-count">{entries.length} upcoming</span>
          </div>
        </div>
        <div className="header-actions">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">All libraries</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)', gap: 24, alignItems: 'start' }}>

          <section>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 12 }}>Coming up next</h2>
            {upcoming.length === 0 ? (
              <p className="hint">Nothing on the horizon. Add items with future <code>releaseDate</code>, <code>airedFrom</code> or <code>startDate</code> and they'll show up here.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcoming.map((e, i) => {
                  const cover = assetSrc(e.item.cover)
                  const category = CATEGORIES.find((c) => c.id === e.item.categoryId)
                  return (
                    <button
                      key={`${e.item.id}-${e.source}-${i}`}
                      type="button"
                      onClick={() => onNavigate(e.item)}
                      style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }}
                    >
                      <div style={{ width: 44, height: 60, flex: '0 0 auto', background: 'var(--surface-3)', borderRadius: 4, overflow: 'hidden' }}>
                        {cover && <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.item.title}</div>
                        <div className="hint" style={{ margin: 0, fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span>{fmtDay(e.date)}</span>
                          <span>·</span>
                          <span>{e.label}</span>
                          {category && <><span>·</span><span>{category.label}</span></>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: 0 }}>{fmtMonthYear(monthCursor)}</h2>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="secondary-btn" onClick={prevMonth}>←</button>
                <button type="button" className="secondary-btn" onClick={jumpToday}>Today</button>
                <button type="button" className="secondary-btn" onClick={nextMonth}>→</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
                <div key={w} style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-dim)', padding: '4px 0', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{w}</div>
              ))}
              {Array.from({ length: firstDayWeekday }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {Array.from({ length: days }).map((_, i) => {
                const day = i + 1
                const entriesOn = byDay.get(day) ?? []
                const isToday = today.getFullYear() === monthCursor.getFullYear() && today.getMonth() === monthCursor.getMonth() && today.getDate() === day
                return (
                  <div
                    key={day}
                    style={{
                      minHeight: 70,
                      padding: 6,
                      background: entriesOn.length > 0 ? 'var(--surface-2)' : 'transparent',
                      border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: isToday ? 'var(--accent)' : 'var(--text-dim)' }}>{day}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {entriesOn.slice(0, 3).map((e, k) => (
                        <button
                          key={`${e.item.id}-${k}`}
                          type="button"
                          onClick={() => onNavigate(e.item)}
                          title={`${e.item.title} · ${e.label}`}
                          style={{
                            fontSize: 11,
                            padding: '2px 4px',
                            background: 'var(--accent)',
                            color: '#000',
                            border: 'none',
                            borderRadius: 3,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textAlign: 'left',
                          }}
                        >{e.item.title}</button>
                      ))}
                      {entriesOn.length > 3 && (
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>+{entriesOn.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}

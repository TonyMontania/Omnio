// Built-in home widgets. Kept in one file for the prototype — each is
// tiny and moving them to separate files later is a rename operation.
// Importing this module registers every widget for its side effect.

import React from 'react'
import type { Item } from '../types'
import type { CategoryId } from '../types/items'
import { assetSrc } from '../types'
import { isCurrentlyAiring } from '../utils/airing'
import { CATEGORIES } from '../categories'
import { CategoryIcon, CalendarIcon, InsightsIcon } from '../icons'
import { registerHomeWidget, type WidgetSize } from './registry'

// ---- Shared helpers (copied from the legacy Home; will move into a
// per-widget file once the prototype settles) ----

function recencyScore(it: Item): number {
  const f = it.finishedAt ? new Date(it.finishedAt).getTime() : 0
  const c = it.createdAt ?? 0
  return Math.max(f, c)
}
function inProgressLabel(it: Item): string | null {
  if (it.gameStatus === 'playing') return 'Playing'
  if (it.watchStatus === 'watching') return 'Watching'
  if (it.seriesStatus === 'watching') return 'Watching'
  if (it.mangaStatus === 'reading') return 'Reading'
  if (it.bookStatus === 'reading') return 'Reading'
  if (it.visualNovelStatus === 'playing') return 'Playing'
  return null
}
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
    case 'series':                                             { const done = count((i) => i.seriesStatus === 'completed'); return `${n} total · ${done} completed` }
    case 'anime': case 'donghua':                              { const done = count((i) => i.watchStatus === 'completed'); return `${n} total · ${done} completed` }
    case 'manga': case 'manhwa': case 'manhua': case 'comics_west': { const done = count((i) => i.mangaStatus === 'completed'); return `${n} total · ${done} completed` }
    case 'libros':                                             { const done = count((i) => i.bookStatus === 'completed'); return `${n} total · ${done} completed` }
    default: return `${n} items`
  }
}

// ---- Widget: Libraries (rich portals) ----
//
// Legacy layout — cover strip, summary line, recent titles. The compact
// chip variant and the KPI-tile "Library totals" widget were retired
// once the persistent sidebar landed (both were pure duplication of
// the sidebar's own library list). This rich portal view stays as an
// opt-in for users who want the busier, cover-heavy dashboard.

registerHomeWidget({
  id: 'libraries',
  label: 'Libraries (rich portals)',
  description: 'One portal per library with cover strip + counts + recent titles. Denser.',
  defaultSize: 'large',
  sizesSupported: ['large'],
  render: (ctx) => {
    const cats = CATEGORIES.filter((c) => ctx.enabledCategories.includes(c.id))
    return (
      <div className="home-lib-grid">
        {cats.map((c) => {
          const list = ctx.items.filter((i) => i.categoryId === c.id)
          const covers = list.slice().sort((a, b) => recencyScore(b) - recencyScore(a)).slice(0, 6)
          const recent = covers.slice(0, 3)
          return (
            <button key={c.id} type="button" className="home-lib-card" onClick={() => ctx.onOpenCategory(c.id)}>
              <div className="home-lib-header">
                <span className="home-lib-icon"><CategoryIcon id={c.id} /></span>
                <span className="home-lib-name">{c.label}</span>
                <span className="home-lib-count">{list.length}</span>
              </div>
              <div className="home-lib-covers">
                {covers.length === 0
                  ? <div className="home-lib-empty">Empty — click to start adding {c.singular}s</div>
                  : covers.map((it) => (
                    <div key={it.id} className="home-lib-cover" onClick={(e) => { e.stopPropagation(); ctx.onOpenItem(it) }} title={it.title}>
                      {it.cover
                        ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                        : <span className="home-lib-cover-fallback">{it.title.charAt(0).toUpperCase()}</span>}
                    </div>
                  ))}
              </div>
              <div className="home-lib-summary">{summarizeCategory(c.id, list)}</div>
              {recent.length > 0 && (
                <ul className="home-lib-recent">
                  {recent.map((it) => (
                    <li key={it.id} onClick={(e) => { e.stopPropagation(); ctx.onOpenItem(it) }}>{it.title}</li>
                  ))}
                </ul>
              )}
            </button>
          )
        })}
      </div>
    )
  },
})

// ---- Widget: Currently in progress ----

registerHomeWidget({
  id: 'currently',
  label: 'Currently',
  description: 'Everything you\'re actively playing / watching / reading, newest first.',
  defaultSize: 'large',
  sizesSupported: ['medium', 'large'],
  render: (ctx, size) => {
    const rows: { item: Item; label: string }[] = []
    for (const it of ctx.items) {
      const label = inProgressLabel(it)
      if (label) rows.push({ item: it, label })
    }
    rows.sort((a, b) => recencyScore(b.item) - recencyScore(a.item))
    const cap = size === 'medium' ? 4 : 8
    const list = rows.slice(0, cap)
    if (list.length === 0) return <p className="hint">Nothing in progress right now.</p>
    return (
      <div className="home-current-list">
        {list.map(({ item, label }) => (
          <button key={item.id} type="button" className="home-current-card" onClick={() => ctx.onOpenItem(item)} title={`${item.title} — ${label}`}>
            <div className="home-current-cover">
              {item.cover
                ? <img src={assetSrc(item.cover)} alt="" loading="lazy" />
                : <span>{item.title.charAt(0).toUpperCase()}</span>}
              <span className="home-current-badge">{label}</span>
            </div>
            <div className="home-current-title">{item.title}</div>
          </button>
        ))}
      </div>
    )
  },
})

// ---- Widget: Upcoming (next 30 days) ----

registerHomeWidget({
  id: 'upcoming',
  label: 'Upcoming',
  description: 'Release / airing dates within the next 30 days.',
  defaultSize: 'large',
  sizesSupported: ['medium', 'large'],
  render: (ctx, size) => {
    const today = new Date()
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const horizon = new Date(startOfToday); horizon.setDate(horizon.getDate() + 30)
    const out: { item: Item; date: Date; label: string }[] = []
    for (const it of ctx.items) {
      const d = parseISODate(it.releaseDate) ?? parseISODate(it.airedFrom) ?? parseYear(it.releaseYear) ?? parseYear(it.startYear)
      if (!d || d < startOfToday || d > horizon) continue
      out.push({ item: it, date: d, label: it.airedFrom && !it.releaseDate ? 'Airs from' : 'Release' })
    }
    out.sort((a, b) => a.date.getTime() - b.date.getTime())
    const cap = size === 'medium' ? 4 : 6
    const list = out.slice(0, cap)
    if (list.length === 0) return <p className="hint">Nothing scheduled in the next 30 days.</p>
    return (
      <>
        <div className="home-upcoming-list">
          {list.map((e, i) => (
            <button key={`${e.item.id}-${i}`} type="button" className="home-upcoming-row" onClick={() => ctx.onOpenItem(e.item)}>
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
        <div style={{ marginTop: 10, textAlign: 'right' }}>
          <button type="button" className="ghost-btn" onClick={ctx.onOpenCalendar}>
            <CalendarIcon /> Full calendar
          </button>
        </div>
      </>
    )
  },
})

// ---- Widget: Recently rated highly ----

registerHomeWidget({
  id: 'recently-rated',
  label: 'Recently rated',
  description: 'Items you gave 4★ or more, newest first — a personal "recently loved" strip.',
  defaultSize: 'medium',
  sizesSupported: ['small', 'medium', 'large'],
  render: (ctx, size) => {
    const cap = size === 'small' ? 3 : size === 'medium' ? 6 : 10
    const list = ctx.items
      .filter((i) => (i.rating ?? 0) >= 4)
      .sort((a, b) => recencyScore(b) - recencyScore(a))
      .slice(0, cap)
    if (list.length === 0) return <p className="hint">Rate some items ★ 4 or higher to see them here.</p>
    return (
      <div className="home-current-list">
        {list.map((it) => (
          <button key={it.id} type="button" className="home-current-card" onClick={() => ctx.onOpenItem(it)} title={`${it.title} — ★${it.rating}`}>
            <div className="home-current-cover">
              {it.cover
                ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                : <span>{it.title.charAt(0).toUpperCase()}</span>}
              <span className="home-current-badge">★ {it.rating}</span>
            </div>
            <div className="home-current-title">{it.title}</div>
          </button>
        ))}
      </div>
    )
  },
})

// (Library totals KPI widget was retired alongside the compact library
// chips — the sidebar already surfaces per-library counts, and the KPI
// tiles just added noise for anyone with more than a handful of
// libraries enabled.)

// ---- Widget: 1cc / bullet-hell placeholder ----
//
// Deliberately a placeholder — the feature itself isn't built yet, but
// having the widget registered validates that "new feature = drop-in
// widget" is the actual shape of the board. When 1cc lands, this file
// gets replaced with a real implementation.

registerHomeWidget({
  id: 'shmup-1cc',
  label: '1cc tracker (placeholder)',
  description: 'Preview of the upcoming shmup / bullet-hell 1cc log widget. No data yet.',
  defaultSize: 'medium',
  sizesSupported: ['small', 'medium', 'large'],
  render: () => {
    return (
      <div className="home-placeholder-widget">
        <div className="home-placeholder-icon"><InsightsIcon /></div>
        <div className="home-placeholder-title">1cc log — coming soon</div>
        <div className="home-placeholder-sub">
          Track credits, character, difficulty, and 1cc / no-miss / no-bomb runs per shmup.
          This tile is here so the widget board can already reserve its slot.
        </div>
      </div>
    )
  },
})

// ---- Widget: Big number tiles ----
//
// A row of scrapbook-style totals — no comparisons, no deltas, no
// "you did less than last month" framing (per the design note that
// insights never guilt-trip). Just current-state accumulators the
// user might feel good about glancing at.

function totalHoursLogged(items: Item[]): number {
  let mins = 0
  for (const it of items) {
    const play = parseFloat(it.playTime ?? '')
    if (!isNaN(play) && play > 0) mins += play * 60
    const mov = parseInt(it.duration ?? '', 10)
    if (!isNaN(mov) && mov > 0) mins += mov
    const epW = parseInt(it.episodesWatched ?? '', 10)
    const epDur = parseInt(it.episodeDuration ?? '', 10)
    if (!isNaN(epW) && !isNaN(epDur) && epW > 0 && epDur > 0) mins += epW * epDur
    const vnH = typeof it.vnLengthHours === 'number' ? it.vnLengthHours : parseFloat(String(it.vnLengthHours ?? ''))
    if (!isNaN(vnH) && vnH > 0 && it.visualNovelStatus === 'completed') mins += vnH * 60
  }
  return Math.round(mins / 60)
}

function finalizedThisYear(items: Item[]): number {
  const year = new Date().getFullYear()
  let n = 0
  for (const it of items) {
    if (!it.finishedAt) continue
    const y = new Date(it.finishedAt).getFullYear()
    if (y === year) n++
  }
  return n
}

registerHomeWidget({
  id: 'big-numbers',
  label: 'Big numbers',
  description: 'Scrapbook-style totals — items in your library, hours logged, finished this year, favorites.',
  defaultSize: 'large',
  sizesSupported: ['medium', 'large'],
  render: (ctx) => {
    const items = ctx.items
    const tiles = [
      { label: 'Items in your library', value: items.length.toLocaleString() },
      { label: 'Finished this year',    value: finalizedThisYear(items).toLocaleString() },
      { label: 'Hours logged',          value: `${totalHoursLogged(items).toLocaleString()}h` },
      { label: 'Loved (★4+)',           value: items.filter((i) => (i.rating ?? 0) >= 4).length.toLocaleString() },
    ]
    return (
      <div className="home-bignum-grid">
        {tiles.map((t) => (
          <div key={t.label} className="home-bignum-tile">
            <div className="home-bignum-value">{t.value}</div>
            <div className="home-bignum-label">{t.label}</div>
          </div>
        ))}
      </div>
    )
  },
})

// ---- Widget: Upcoming (this week — 7-day horizon) ----
//
// Companion to the 30-day `upcoming` widget. Same data source, tighter
// window — for users who want the "what's imminent" row instead of the
// whole month.

registerHomeWidget({
  id: 'upcoming-week',
  label: 'Upcoming this week',
  description: 'Release / airing dates in the next 7 days.',
  defaultSize: 'medium',
  sizesSupported: ['small', 'medium', 'large'],
  render: (ctx, size) => {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const horizon = new Date(start); horizon.setDate(horizon.getDate() + 7)
    const out: { item: Item; date: Date; label: string }[] = []
    for (const it of ctx.items) {
      const d = parseISODate(it.releaseDate) ?? parseISODate(it.airedFrom) ?? parseYear(it.releaseYear) ?? parseYear(it.startYear)
      if (!d || d < start || d > horizon) continue
      out.push({ item: it, date: d, label: it.airedFrom && !it.releaseDate ? 'Airs from' : 'Release' })
    }
    out.sort((a, b) => a.date.getTime() - b.date.getTime())
    const cap = size === 'small' ? 3 : size === 'medium' ? 5 : 8
    const list = out.slice(0, cap)
    if (list.length === 0) return <p className="hint">Nothing scheduled this week.</p>
    return (
      <div className="home-upcoming-list">
        {list.map((e, i) => (
          <button key={`${e.item.id}-${i}`} type="button" className="home-upcoming-row" onClick={() => ctx.onOpenItem(e.item)}>
            <div className="home-upcoming-cover">
              {e.item.cover
                ? <img src={assetSrc(e.item.cover)} alt="" loading="lazy" />
                : <span>{e.item.title.charAt(0).toUpperCase()}</span>}
            </div>
            <div className="home-upcoming-body">
              <div className="home-upcoming-title">{e.item.title}</div>
              <div className="home-upcoming-sub">
                {e.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                {' · '}{e.label}
              </div>
            </div>
          </button>
        ))}
      </div>
    )
  },
})

// ---- Widget: Currently airing ----
//
// Anime / donghua / series flagged as `airing` (or series with
// `seriesStatus === 'ongoing'`) that you've marked as watching or
// backlogged. Distinct from "upcoming" — this is stuff that's ALREADY
// running, so new episodes drop weekly.

registerHomeWidget({
  id: 'currently-airing',
  label: 'Currently airing',
  description: 'Anime, donghua and series that are on air right now.',
  defaultSize: 'medium',
  sizesSupported: ['medium', 'large'],
  render: (ctx, size) => {
    const airingCats = new Set(['anime', 'donghua', 'series'])
    const list = ctx.items
      .filter((i) => airingCats.has(i.categoryId))
      // Sprint I — accept items whose airingStatus is 'airing' AS WELL
      // AS items where the derived airing check passes. That covers
      // shows the user added bare (title + season + seasonYear) without
      // touching the status flag: if season+year matches the current
      // calendar quarter, the show still shows up here.
      .filter((i) => isCurrentlyAiring(i))
      .sort((a, b) => recencyScore(b) - recencyScore(a))
    const cap = size === 'medium' ? 4 : 8
    const cut = list.slice(0, cap)
    if (cut.length === 0) return <p className="hint">Nothing airing in your library right now.</p>
    return (
      <div className="home-current-list">
        {cut.map((it) => (
          <button key={it.id} type="button" className="home-current-card" onClick={() => ctx.onOpenItem(it)} title={it.title}>
            <div className="home-current-cover">
              {it.cover
                ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                : <span>{it.title.charAt(0).toUpperCase()}</span>}
              <span className="home-current-badge">Airing</span>
            </div>
            <div className="home-current-title">{it.title}</div>
          </button>
        ))}
      </div>
    )
  },
})

// ---- Widget: Quick add ----
//
// Inline stub-creation form. Fills only the required minimum
// (title + categoryId + createdAt); the user flesh-fills the rest in
// the Add panel later. Bound to `ctx.onQuickAdd` which is wired up in
// App.tsx to append the item and toast confirmation.

// eslint-disable-next-line react-refresh/only-export-components
const QuickAddWidget = ({ ctx }: { ctx: import('./registry').HomeContext }) => {
  const cats = CATEGORIES.filter((c) => ctx.enabledCategories.includes(c.id))
  const [title, setTitle] = React.useState('')
  const [categoryId, setCategoryId] = React.useState<string>(cats[0]?.id ?? 'videojuegos')
  React.useEffect(() => {
    // If the default cat gets disabled, snap to the first enabled one.
    if (!cats.some((c) => c.id === categoryId) && cats[0]) setCategoryId(cats[0].id)
  }, [cats, categoryId])
  const canSubmit = title.trim().length > 0 && !!ctx.onQuickAdd
  const submit = () => {
    if (!canSubmit) return
    ctx.onQuickAdd!(categoryId as CategoryId, title.trim())
    setTitle('')
  }
  return (
    <div className="home-quickadd">
      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="home-quickadd-cat"
      >
        {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        placeholder={`Add a ${cats.find((c) => c.id === categoryId)?.singular ?? 'item'}…`}
        className="home-quickadd-input"
      />
      <button type="button" className="home-quickadd-btn" onClick={submit} disabled={!canSubmit}>+ Add</button>
    </div>
  )
}

registerHomeWidget({
  id: 'quick-add',
  label: 'Quick add',
  description: 'One-line "title + category" form — skip the full Add panel for fast stub entries.',
  defaultSize: 'small',
  sizesSupported: ['small', 'medium'],
  render: (ctx) => <QuickAddWidget ctx={ctx} />,
})

// ---- Widget: Cover carousel ----
//
// Decorative auto-scrolling strip of covers pulled from the whole
// library. Duplicated once so the CSS marquee loop reads seamless.
// Purely visual — clicking a cover opens the item.

registerHomeWidget({
  id: 'cover-carousel',
  label: 'Cover carousel',
  description: 'Auto-scrolling ribbon of covers from your library. Purely decorative — click any cover to open.',
  defaultSize: 'medium',
  sizesSupported: ['medium', 'large'],
  render: (ctx) => {
    const withCover = ctx.items.filter((i) => !!i.cover)
    if (withCover.length === 0) return <p className="hint">Add items with covers to fill this carousel.</p>
    // Deterministic shuffle so re-renders don't reshuffle mid-hover.
    const seeded = withCover.slice().sort((a, b) => (a.id > b.id ? 1 : -1))
    const strip = seeded.slice(0, 40)
    // Duplicate so the marquee has enough content to loop seamlessly.
    const doubled = [...strip, ...strip]
    return (
      <div className="home-carousel">
        <div className="home-carousel-track">
          {doubled.map((it, i) => (
            <button
              key={`${it.id}-${i}`}
              type="button"
              className="home-carousel-cover"
              onClick={() => ctx.onOpenItem(it)}
              title={it.title}
            >
              <img src={assetSrc(it.cover)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    )
  },
})

// ---- Widget: On this day ----
//
// Anniversary flashback: items you finished on today's month + day in
// past years. Groups by "N year(s) ago". Reads `finishedAt` (ISO
// yyyy-mm-dd) — anything without a date is skipped, and if nothing
// matches at all the widget hides itself rather than nag with an
// "you haven't finished anything on this day" empty state. Fully
// respects the no-guilt rule: no comparisons, no counters, no
// "start something today".

interface AnniversaryHit { item: Item; year: number; yearsAgo: number }

function collectAnniversaries(items: Item[], now: Date): AnniversaryHit[] {
  const thisYear = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()
  const hits: AnniversaryHit[] = []
  for (const it of items) {
    if (!it.finishedAt) continue
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(it.finishedAt)
    if (!match) continue
    const yr = parseInt(match[1], 10)
    const mo = parseInt(match[2], 10)
    const day = parseInt(match[3], 10)
    if (mo !== m || day !== d) continue
    const yearsAgo = thisYear - yr
    if (yearsAgo <= 0) continue
    hits.push({ item: it, year: yr, yearsAgo })
  }
  // Sort by yearsAgo ascending, then by rating desc so best-loved stuff
  // wins the tiebreak within the same year bucket.
  hits.sort((a, b) => a.yearsAgo - b.yearsAgo || (b.item.rating ?? 0) - (a.item.rating ?? 0))
  return hits
}

registerHomeWidget({
  id: 'on-this-day',
  label: 'On this day',
  description: 'Items you finished on today\'s date in past years. Hides itself when there\'s nothing to show.',
  defaultSize: 'medium',
  sizesSupported: ['small', 'medium', 'large'],
  render: (ctx, size) => {
    const now = new Date()
    const hits = collectAnniversaries(ctx.items, now)
    if (hits.length === 0) return null
    const cap = size === 'small' ? 3 : size === 'medium' ? 6 : 12
    const list = hits.slice(0, cap)
    // Group by yearsAgo so the reader sees "1 year ago: X" then "5
    // years ago: Y" instead of a flat list they have to squint at.
    const groups = new Map<number, AnniversaryHit[]>()
    for (const h of list) {
      const g = groups.get(h.yearsAgo) ?? []
      g.push(h); groups.set(h.yearsAgo, g)
    }
    const orderedGroups = Array.from(groups.entries()).sort(([a], [b]) => a - b)
    return (
      <div className="home-on-this-day">
        {orderedGroups.map(([yearsAgo, entries]) => (
          <div key={yearsAgo} className="home-on-this-day-group">
            <div className="home-on-this-day-header">
              <span className="home-on-this-day-when">
                {yearsAgo === 1 ? 'One year ago' : `${yearsAgo} years ago`}
              </span>
              <span className="home-on-this-day-year">{now.getFullYear() - yearsAgo}</span>
            </div>
            <div className="home-on-this-day-rows">
              {entries.map((h) => {
                const cat = CATEGORIES.find((c) => c.id === h.item.categoryId)
                return (
                  <button
                    key={h.item.id}
                    type="button"
                    className="home-on-this-day-row"
                    onClick={() => ctx.onOpenItem(h.item)}
                    title={h.item.title}
                  >
                    <div className="home-on-this-day-cover">
                      {h.item.cover
                        ? <img src={assetSrc(h.item.cover)} alt="" loading="lazy" />
                        : <span>{h.item.title.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="home-on-this-day-body">
                      <div className="home-on-this-day-title">{h.item.title}</div>
                      <div className="home-on-this-day-sub">
                        {cat?.label ?? h.item.categoryId}
                        {typeof h.item.rating === 'number' && h.item.rating > 0 && (
                          <>{' · '}<span className="home-on-this-day-rating">★ {h.item.rating.toFixed(1)}</span></>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  },
})

// ---- Widget: Empty-state hint (only appears when the board is empty) ----

registerHomeWidget({
  id: 'empty-hint',
  label: 'Empty board hint',
  description: 'Shown when the layout has no widgets — points to Edit layout.',
  defaultSize: 'large',
  sizesSupported: ['large'],
  render: () => (
    <div className="home-empty-hint">
      <h3>Your home board is empty.</h3>
      <p>Click <b>Edit layout</b> above to add widgets — libraries, upcoming releases, recently rated, and more.</p>
    </div>
  ),
})

// Ensure `WidgetSize` is imported at type-level even if no runtime use.
export type { WidgetSize }

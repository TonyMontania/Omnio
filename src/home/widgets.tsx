// Built-in home widgets. Importing the module registers each one as a
// side effect via `registerHomeWidget`.

import React from 'react'
import type { Item, Weekday } from '../types'
import { assetSrc, WEEKDAY_OPTIONS } from '../types'
import { isCurrentlyAiring } from '../utils/airing'
import { CATEGORIES } from '../categories'
import { CalendarIcon, InsightsIcon } from '../icons'
import { registerHomeWidget, type WidgetSize } from './registry'
import FillGrid from './FillGrid'

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
function currentProgressLine(it: Item): string | null {
  const ep = parseInt(it.episodesWatched ?? '', 10)
  const totalEp = parseInt(it.totalEpisodes ?? '', 10)
  if (!isNaN(ep) && ep > 0) return isNaN(totalEp) || totalEp <= 0 ? `Episode ${ep}` : `Episode ${ep} of ${totalEp}`
  const ch = parseInt(it.chaptersRead ?? '', 10)
  const totalCh = parseInt(it.totalChapters ?? '', 10)
  if (!isNaN(ch) && ch > 0) return isNaN(totalCh) || totalCh <= 0 ? `Chapter ${ch}` : `Chapter ${ch} of ${totalCh}`
  const pg = parseInt(it.pagesRead ?? '', 10)
  const totalPg = parseInt(it.totalPages ?? '', 10)
  if (!isNaN(pg) && pg > 0) return isNaN(totalPg) || totalPg <= 0 ? `Page ${pg}` : `Page ${pg} of ${totalPg}`
  const play = parseFloat(it.playTime ?? '')
  if (!isNaN(play) && play > 0) return `${play.toFixed(1)}h played`
  return null
}

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
    if (rows.length === 0) return <p className="hint">Nothing in progress right now.</p>

    if (size === 'medium') {
      return (
        <FillGrid items={rows} minWidth={140} gap={14} rows={2} className="home-current-list">
          {({ item, label }) => (
            <button key={item.id} type="button" className="home-current-card" onClick={() => ctx.onOpenItem(item)} title={`${item.title} — ${label}`}>
              <div className="home-current-cover">
                {item.cover
                  ? <img src={assetSrc(item.cover)} alt="" loading="lazy" />
                  : <span>{item.title.charAt(0).toUpperCase()}</span>}
                <span className="home-current-badge">{label}</span>
              </div>
              <div className="home-current-title">{item.title}</div>
            </button>
          )}
        </FillGrid>
      )
    }

    const [hero, ...rest] = rows
    const heroProgress = currentProgressLine(hero.item)
    const heroCat = CATEGORIES.find((c) => c.id === hero.item.categoryId)?.label
    return (
      <div className="home-currently-hero-wrap">
        <button
          type="button"
          className="home-currently-hero"
          onClick={() => ctx.onOpenItem(hero.item)}
          title={`${hero.item.title} — ${hero.label}`}
          style={hero.item.cover ? { '--hero-cover': `url(${assetSrc(hero.item.cover)})` } as React.CSSProperties : undefined}
        >
          <div className="home-currently-hero-bg" aria-hidden />
          <div className="home-currently-hero-cover">
            {hero.item.cover
              ? <img src={assetSrc(hero.item.cover)} alt="" loading="lazy" />
              : <span>{hero.item.title.charAt(0).toUpperCase()}</span>}
          </div>
          <div className="home-currently-hero-body">
            <span className="home-currently-hero-badge">{hero.label}</span>
            <div className="home-currently-hero-title">{hero.item.title}</div>
            <div className="home-currently-hero-meta">
              {heroCat && <span>{heroCat}</span>}
              {heroProgress && <><span className="home-currently-hero-dot" aria-hidden>·</span><span>{heroProgress}</span></>}
            </div>
          </div>
        </button>
        {rest.length > 0 && (
          <FillGrid items={rest} minWidth={130} gap={12} rows={1} className="home-currently-rest">
            {({ item, label }) => (
              <button key={item.id} type="button" className="home-current-card" onClick={() => ctx.onOpenItem(item)} title={`${item.title} — ${label}`}>
                <div className="home-current-cover">
                  {item.cover
                    ? <img src={assetSrc(item.cover)} alt="" loading="lazy" />
                    : <span>{item.title.charAt(0).toUpperCase()}</span>}
                  <span className="home-current-badge">{label}</span>
                </div>
                <div className="home-current-title">{item.title}</div>
              </button>
            )}
          </FillGrid>
        )}
      </div>
    )
  },
})


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


registerHomeWidget({
  id: 'recently-rated',
  label: 'Recently rated',
  description: 'Items you gave 4★ or more, newest first — a personal "recently loved" strip.',
  defaultSize: 'medium',
  sizesSupported: ['small', 'medium', 'large'],
  render: (ctx, size) => {
    const list = ctx.items
      .filter((i) => (i.rating ?? 0) >= 4)
      .sort((a, b) => recencyScore(b) - recencyScore(a))
    if (list.length === 0) return <p className="hint">Rate some items ★ 4 or higher to see them here.</p>
    return (
      <FillGrid items={list} minWidth={140} gap={14} rows={size === 'small' ? 1 : 2} className="home-current-list">
        {(it) => (
          <button key={it.id} type="button" className="home-current-card" onClick={() => ctx.onOpenItem(it)} title={`${it.title} — ★${it.rating}`}>
            <div className="home-current-cover">
              {it.cover
                ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                : <span>{it.title.charAt(0).toUpperCase()}</span>}
              <span className="home-current-badge">★ {it.rating}</span>
            </div>
            <div className="home-current-title">{it.title}</div>
          </button>
        )}
      </FillGrid>
    )
  },
})

// (Library totals KPI widget was retired alongside the compact library
// chips — the sidebar already surfaces per-library counts, and the KPI
// tiles just added noise for anyone with more than a handful of
// libraries enabled.)

// Deliberately a placeholder — the feature itself isn't built yet, but
// having the widget registered validates that "new feature = drop-in
// widget" is the actual shape of the board. When 1cc lands, this file
// gets replaced with a real implementation.

// Backlog roulette. Answers "what should I actually pick next?" by
// surfacing a small random sample of items sitting in a backlog-style
// status. Reshuffles on click of the ↻ button so it isn't stuck on the
// same three every time you open Home.
function isBacklogItem(it: Item): boolean {
  if (it.gameStatus === 'backlog') return true
  if (it.watchStatus === 'plan_to_watch') return true
  if (it.seriesStatus === 'plan_to_watch') return true
  if (it.mangaStatus === 'plan_to_read') return true
  if (it.bookStatus === 'plan_to_read') return true
  if (it.visualNovelStatus === 'plan_to_play') return true
  return false
}

// eslint-disable-next-line react-refresh/only-export-components
const BacklogPickWidget = ({ ctx, size }: { ctx: import('./registry').HomeContext; size: WidgetSize }) => {
  const backlog = React.useMemo(() => ctx.items.filter(isBacklogItem), [ctx.items])
  const [seed, setSeed] = React.useState(0)
  const picks = React.useMemo(() => {
    const cap = size === 'small' ? 2 : size === 'medium' ? 3 : 5
    const pool = [...backlog]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, cap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backlog, seed])
  if (backlog.length === 0) return <p className="hint">Nothing in a backlog status right now.</p>
  return (
    <div className="home-backlog-pick">
      <div className="home-backlog-head">
        <span className="hint" style={{ margin: 0 }}>Random from {backlog.length.toLocaleString()} in your backlog</span>
        <button
          type="button"
          className="home-backlog-reshuffle"
          onClick={() => setSeed((s) => s + 1)}
          title="Reshuffle"
          aria-label="Reshuffle"
        >↻</button>
      </div>
      <div className="home-backlog-list">
        {picks.map((it) => {
          const cat = CATEGORIES.find((c) => c.id === it.categoryId)?.label
          return (
            <button
              key={it.id}
              type="button"
              className="home-backlog-card"
              onClick={() => ctx.onOpenItem(it)}
              title={it.title}
            >
              <div className="home-backlog-cover">
                {it.cover
                  ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                  : <span>{it.title.charAt(0).toUpperCase()}</span>}
              </div>
              <div className="home-backlog-body">
                <div className="home-backlog-title">{it.title}</div>
                {cat && <div className="home-backlog-cat">{cat}</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

registerHomeWidget({
  id: 'pick-from-backlog',
  label: 'Pick from your backlog',
  description: 'A shuffle of a few things sitting in a backlog / plan-to status — helps break decision paralysis.',
  defaultSize: 'medium',
  sizesSupported: ['small', 'medium', 'large'],
  render: (ctx, size) => <BacklogPickWidget ctx={ctx} size={size} />,
})

// Weekly simulcast grid — one column per weekday with covers of
// currently-airing anime/donghua/series that have `airingDay` set. The
// "today" column gets a subtle highlight so you spot new episodes fast.
registerHomeWidget({
  id: 'weekly-airing',
  label: 'This week (airing)',
  description: 'Anime, donghua and series that air each weekday. Missing weekdays get a placeholder — set Airs on in the editor.',
  defaultSize: 'large',
  sizesSupported: ['medium', 'large'],
  render: (ctx, size) => {
    const AIRING_CATS = new Set(['anime', 'donghua', 'series'])
    const airing = ctx.items.filter((i) => AIRING_CATS.has(i.categoryId) && isCurrentlyAiring(i) && i.airingDay)
    if (airing.length === 0) return <p className="hint">Nothing airing on a set weekday. Add <b>Airs on</b> in the anime / series editor to fill this grid.</p>
    const buckets = new Map<Weekday, Item[]>()
    for (const w of WEEKDAY_OPTIONS) buckets.set(w.value, [])
    for (const item of airing) buckets.get(item.airingDay!)?.push(item)
    for (const list of buckets.values()) list.sort((a, b) => a.title.localeCompare(b.title))

    const todayIdx = new Date().getDay()
    const todayValue: Weekday = (['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as Weekday[])[todayIdx]
    const days = size === 'medium' ? WEEKDAY_OPTIONS.slice(0, 4) : WEEKDAY_OPTIONS
    return (
      <div className={`home-weekly-airing home-weekly-airing-${size}`}>
        {days.map((day) => {
          const list = buckets.get(day.value) ?? []
          const isToday = day.value === todayValue
          return (
            <div key={day.value} className={`home-weekly-day${isToday ? ' today' : ''}`}>
              <div className="home-weekly-day-head">
                <span className="home-weekly-day-name">{day.short}</span>
                {isToday && <span className="home-weekly-day-badge">Today</span>}
              </div>
              {list.length === 0 ? (
                <div className="home-weekly-day-empty">—</div>
              ) : (
                <div className="home-weekly-day-list">
                  {list.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      className="home-weekly-card"
                      onClick={() => ctx.onOpenItem(it)}
                      title={it.title}
                    >
                      <div className="home-weekly-cover">
                        {it.cover
                          ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                          : <span>{it.title.charAt(0).toUpperCase()}</span>}
                      </div>
                      <div className="home-weekly-title">{it.title}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  },
})

// "Continue where you left off" — for each in-progress series/anime/manga/book
// with numeric progress + a total, computes the next unit (episode / chapter /
// page) and surfaces it as a compact actionable card. Sorted by recency so
// what you actually touched last comes first.
function nextUnitFor(it: Item): { label: string; sub?: string } | null {
  const parseNum = (s?: string): number | null => {
    if (!s) return null
    const n = parseInt(s, 10)
    return isNaN(n) ? null : n
  }
  const ep = parseNum(it.episodesWatched)
  const totEp = parseNum(it.totalEpisodes)
  if (ep !== null && ep >= 0) {
    const next = ep + 1
    if (totEp !== null && totEp > 0 && next > totEp) return null
    return { label: `Episode ${next}`, sub: totEp ? `of ${totEp}` : undefined }
  }
  const ch = parseNum(it.chaptersRead)
  const totCh = parseNum(it.totalChapters)
  if (ch !== null && ch >= 0) {
    const next = ch + 1
    if (totCh !== null && totCh > 0 && next > totCh) return null
    return { label: `Chapter ${next}`, sub: totCh ? `of ${totCh}` : undefined }
  }
  const pg = parseNum(it.pagesRead)
  const totPg = parseNum(it.totalPages)
  if (pg !== null && pg >= 0) {
    const next = pg + 1
    if (totPg !== null && totPg > 0 && next > totPg) return null
    return { label: `Page ${next}`, sub: totPg ? `of ${totPg}` : undefined }
  }
  return null
}

registerHomeWidget({
  id: 'continue-watching',
  label: 'Continue where you left off',
  description: 'The next episode / chapter / page for each series, anime, manga and book you have in progress.',
  defaultSize: 'large',
  sizesSupported: ['medium', 'large'],
  render: (ctx) => {
    const rows: { item: Item; next: { label: string; sub?: string } }[] = []
    for (const it of ctx.items) {
      if (!inProgressLabel(it)) continue
      const next = nextUnitFor(it)
      if (!next) continue
      rows.push({ item: it, next })
    }
    rows.sort((a, b) => recencyScore(b.item) - recencyScore(a.item))
    if (rows.length === 0) return <p className="hint">Nothing with a next-unit set yet. Fill in <b>Episodes watched</b> / <b>Chapters read</b> / <b>Pages read</b> to see resumable items here.</p>
    return (
      <FillGrid items={rows} minWidth={240} gap={12} rows={2} stretch className="home-continue-grid">
        {({ item, next }) => {
          const cat = CATEGORIES.find((c) => c.id === item.categoryId)?.label
          return (
            <button
              key={item.id}
              type="button"
              className="home-continue-card"
              onClick={() => ctx.onOpenItem(item)}
              title={`${item.title} — ${next.label}${next.sub ? ` ${next.sub}` : ''}`}
            >
              <div className="home-continue-cover">
                {item.cover
                  ? <img src={assetSrc(item.cover)} alt="" loading="lazy" />
                  : <span>{item.title.charAt(0).toUpperCase()}</span>}
                <span className="home-continue-arrow" aria-hidden>▶</span>
              </div>
              <div className="home-continue-body">
                <div className="home-continue-title">{item.title}</div>
                <div className="home-continue-next">
                  <span className="home-continue-next-label">{next.label}</span>
                  {next.sub && <span className="home-continue-next-sub"> · {next.sub}</span>}
                </div>
                {cat && <div className="home-continue-cat">{cat}</div>}
              </div>
            </button>
          )
        }}
      </FillGrid>
    )
  },
})

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
  render: (ctx, size) => {
    const items = ctx.items
    const tiles = [
      { label: 'Items in your library', value: items.length.toLocaleString() },
      { label: 'Finished this year',    value: finalizedThisYear(items).toLocaleString() },
      { label: 'Hours logged',          value: `${totalHoursLogged(items).toLocaleString()}h` },
      { label: 'Loved (★4+)',           value: items.filter((i) => (i.rating ?? 0) >= 4).length.toLocaleString() },
    ]
    return (
      <div className={`home-bignum-grid home-bignum-grid-${size}`}>
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
    if (list.length === 0) return <p className="hint">Nothing airing in your library right now.</p>
    return (
      <FillGrid items={list} minWidth={140} gap={14} rows={size === 'medium' ? 1 : 2} className="home-current-list">
        {(it) => (
          <button key={it.id} type="button" className="home-current-card" onClick={() => ctx.onOpenItem(it)} title={it.title}>
            <div className="home-current-cover">
              {it.cover
                ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                : <span>{it.title.charAt(0).toUpperCase()}</span>}
              <span className="home-current-badge">Airing</span>
            </div>
            <div className="home-current-title">{it.title}</div>
          </button>
        )}
      </FillGrid>
    )
  },
})

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


// Rating spread — small horizontal bar chart showing how many items you
// rated per star bucket. Buckets are floor(rating) so ★4.5 lands in the
// ★4 column. Purely informational, no comparisons across time.
registerHomeWidget({
  id: 'rating-spread',
  label: 'Rating spread',
  description: 'A quick bar chart of how many items you rated at each star level.',
  defaultSize: 'medium',
  sizesSupported: ['small', 'medium', 'large'],
  render: (ctx) => {
    const buckets = [0, 0, 0, 0, 0]
    for (const it of ctx.items) {
      const r = it.rating ?? 0
      if (r <= 0) continue
      const idx = Math.min(4, Math.max(0, Math.floor(r) - 1))
      buckets[idx]++
    }
    const total = buckets.reduce((a, b) => a + b, 0)
    if (total === 0) return <p className="hint">Rate some items to fill in the spread.</p>
    const max = Math.max(...buckets, 1)
    return (
      <div className="home-rating-spread">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = buckets[star - 1]
          const pct = (count / max) * 100
          return (
            <div key={star} className="home-rating-row">
              <span className="home-rating-star">
                {'★'.repeat(star)}<span className="home-rating-star-dim">{'★'.repeat(5 - star)}</span>
              </span>
              <div className="home-rating-track">
                <div className="home-rating-bar" style={{ width: `${pct}%` }} />
              </div>
              <span className="home-rating-count">{count.toLocaleString()}</span>
            </div>
          )
        })}
        <div className="home-rating-footer">{total.toLocaleString()} rated</div>
      </div>
    )
  },
})

// Finished this week — items completed / finished within the last 7 days,
// oldest first so today lands at the bottom (chronological reading).
registerHomeWidget({
  id: 'finished-this-week',
  label: 'Finished this week',
  description: 'Items you finished in the last 7 days.',
  defaultSize: 'medium',
  sizesSupported: ['small', 'medium', 'large'],
  render: (ctx, size) => {
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const rows: { item: Item; when: number }[] = []
    for (const it of ctx.items) {
      if (!it.finishedAt) continue
      const t = new Date(it.finishedAt).getTime()
      if (isNaN(t) || t < weekAgo || t > now + 24 * 60 * 60 * 1000) continue
      rows.push({ item: it, when: t })
    }
    rows.sort((a, b) => b.when - a.when)
    if (rows.length === 0) return <p className="hint">Nothing marked finished in the last 7 days.</p>
    return (
      <FillGrid items={rows} minWidth={140} gap={14} rows={size === 'small' ? 1 : 2} className="home-current-list">
        {({ item, when }) => {
          const d = new Date(when)
          const relDays = Math.max(0, Math.round((now - when) / (24 * 60 * 60 * 1000)))
          const rel = relDays === 0 ? 'Today' : relDays === 1 ? 'Yesterday' : `${relDays}d ago`
          return (
            <button key={item.id} type="button" className="home-current-card" onClick={() => ctx.onOpenItem(item)} title={`${item.title} — ${d.toLocaleDateString()}`}>
              <div className="home-current-cover">
                {item.cover
                  ? <img src={assetSrc(item.cover)} alt="" loading="lazy" />
                  : <span>{item.title.charAt(0).toUpperCase()}</span>}
                <span className="home-current-badge">{rel}</span>
              </div>
              <div className="home-current-title">{item.title}</div>
            </button>
          )
        }}
      </FillGrid>
    )
  },
})

// Top of the year (so far) — highlights ★4+ items you finished this
// calendar year. Sorted rating-first, then by recency so the strongest
// picks lead. Hides itself entirely if nothing qualifies yet.
registerHomeWidget({
  id: 'top-of-year',
  label: 'Top of the year (so far)',
  description: 'Items you rated ★4+ and finished this year. Hides itself when the list is empty.',
  defaultSize: 'medium',
  sizesSupported: ['medium', 'large'],
  render: (ctx) => {
    const year = new Date().getFullYear()
    const rows = ctx.items.filter((it) => {
      if ((it.rating ?? 0) < 4) return false
      if (!it.finishedAt) return false
      return new Date(it.finishedAt).getFullYear() === year
    })
    if (rows.length === 0) return null
    rows.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || recencyScore(b) - recencyScore(a))
    return (
      <FillGrid items={rows} minWidth={140} gap={14} rows={2} className="home-current-list">
        {(it) => (
          <button key={it.id} type="button" className="home-current-card" onClick={() => ctx.onOpenItem(it)} title={`${it.title} — ★${it.rating}`}>
            <div className="home-current-cover">
              {it.cover
                ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                : <span>{it.title.charAt(0).toUpperCase()}</span>}
              <span className="home-current-badge">★ {it.rating}</span>
            </div>
            <div className="home-current-title">{it.title}</div>
          </button>
        )}
      </FillGrid>
    )
  },
})

// Random from favorites — same shuffle mechanic as "Pick from your backlog"
// but scoped to ★5 items. A rediscovery widget: "you loved this, did you
// forget about it?".
// eslint-disable-next-line react-refresh/only-export-components
const FavoritesShuffleWidget = ({ ctx, size }: { ctx: import('./registry').HomeContext; size: WidgetSize }) => {
  const favorites = React.useMemo(() => ctx.items.filter((i) => (i.rating ?? 0) >= 5), [ctx.items])
  const [seed, setSeed] = React.useState(0)
  const picks = React.useMemo(() => {
    const cap = size === 'small' ? 2 : size === 'medium' ? 3 : 5
    const pool = [...favorites]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, cap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites, seed])
  if (favorites.length === 0) return <p className="hint">Rate some items ★ 5 to build a favorites pool.</p>
  return (
    <div className="home-backlog-pick">
      <div className="home-backlog-head">
        <span className="hint" style={{ margin: 0 }}>Random from {favorites.length.toLocaleString()} ★5 favorites</span>
        <button
          type="button"
          className="home-backlog-reshuffle"
          onClick={() => setSeed((s) => s + 1)}
          title="Reshuffle"
          aria-label="Reshuffle"
        >↻</button>
      </div>
      <div className="home-backlog-list">
        {picks.map((it) => {
          const cat = CATEGORIES.find((c) => c.id === it.categoryId)?.label
          return (
            <button
              key={it.id}
              type="button"
              className="home-backlog-card"
              onClick={() => ctx.onOpenItem(it)}
              title={it.title}
            >
              <div className="home-backlog-cover">
                {it.cover
                  ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                  : <span>{it.title.charAt(0).toUpperCase()}</span>}
              </div>
              <div className="home-backlog-body">
                <div className="home-backlog-title">{it.title}</div>
                {cat && <div className="home-backlog-cat">{cat}</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

registerHomeWidget({
  id: 'random-favorites',
  label: 'Random from favorites',
  description: 'A shuffle of a few things you rated ★5 — rediscovery, not shame.',
  defaultSize: 'medium',
  sizesSupported: ['small', 'medium', 'large'],
  render: (ctx, size) => <FavoritesShuffleWidget ctx={ctx} size={size} />,
})

// Genre spotlight — top 5 genres by count across the whole library, with
// a mini cover strip per genre so the row reads more like a magazine
// than a bar chart.
registerHomeWidget({
  id: 'genre-spotlight',
  label: 'Genre spotlight',
  description: 'Your top 5 genres by count, with a mini cover strip of items in each.',
  defaultSize: 'medium',
  sizesSupported: ['medium', 'large'],
  render: (ctx) => {
    const bucket = new Map<string, Item[]>()
    for (const it of ctx.items) {
      if (!it.genres) continue
      for (const g of it.genres) {
        const key = g.trim()
        if (!key) continue
        const list = bucket.get(key) ?? []
        list.push(it); bucket.set(key, list)
      }
    }
    if (bucket.size === 0) return <p className="hint">Add genres to items to see spotlights here.</p>
    const top = Array.from(bucket.entries())
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 5)
    return (
      <div className="home-genre-spotlight">
        {top.map(([genre, list]) => {
          const covers = list.slice().sort((a, b) => recencyScore(b) - recencyScore(a)).slice(0, 5)
          return (
            <div key={genre} className="home-genre-row">
              <div className="home-genre-meta">
                <div className="home-genre-name">{genre}</div>
                <div className="home-genre-count">{list.length.toLocaleString()}</div>
              </div>
              <div className="home-genre-covers">
                {covers.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className="home-genre-cover"
                    onClick={() => ctx.onOpenItem(it)}
                    title={it.title}
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
    )
  },
})

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

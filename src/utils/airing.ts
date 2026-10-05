// Derive whether an anime / donghua / series counts as "currently
// airing" from the fields the user has filled in, without requiring
// them to touch airingStatus explicitly.
//
// Priority order:
//   1. Explicit `airingStatus` set by the user (or an earlier
//      fetcher) — always wins. If they set "finished", we don't
//      second-guess them.
//   2. Date window: airedFrom is in the past AND (airedTo is unset
//      OR airedTo is in the future). This is the strongest signal
//      when the user pulled dates from any fetcher.
//   3. Season match: season + seasonYear line up with the calendar
//      quarter we're in right now. This is the "I just added Winter
//      2026 with a bare title and expect it to show up" path.
//
// Returns 'airing' when the item counts, `undefined` otherwise so
// callers can render nothing when a show clearly isn't relevant.

import type { AnyItem, AnimeSeason, Weekday } from '../types'

// Northern-hemisphere anime seasons matching AniDB / AniList /
// Kitsu conventions. Jan/Feb/Mar = Winter, etc.
export function getCurrentAnimeSeason(now: Date = new Date()): { season: AnimeSeason; year: number } {
  const m = now.getMonth()
  const season: AnimeSeason =
    m <= 2 ? 'winter' :
    m <= 5 ? 'spring' :
    m <= 8 ? 'summer' :
    'fall'
  return { season, year: now.getFullYear() }
}

// True if the item is on air right now. Reads item as unknown-shape
// AnyItem so callers don't have to narrow to AnimeItem/SeriesItem
// — the fields we touch (airingStatus, airedFrom, airedTo, season,
// seasonYear) are safe to read across the whole union.
export function isCurrentlyAiring(item: AnyItem, now: Date = new Date()): boolean {
  // 1. Explicit status wins in both directions.
  if (item.airingStatus === 'airing') return true
  if (item.airingStatus === 'finished') return false
  if (item.airingStatus === 'not_yet_aired') return false

  // 2. Date window (airedFrom / airedTo).
  if (item.airedFrom) {
    const start = new Date(item.airedFrom)
    if (!Number.isNaN(start.getTime()) && start <= now) {
      if (!item.airedTo) return true
      const end = new Date(item.airedTo)
      if (Number.isNaN(end.getTime())) return true
      if (end >= now) return true
      return false
    }
  }

  // 3. Season match. Bare title + Winter 2026 + no other data → treat
  // it as airing during the corresponding calendar quarter, so users
  // who add shows without touching status get the same behaviour as
  // if they used a fetcher.
  if (item.season && item.seasonYear) {
    const y = parseInt(String(item.seasonYear), 10)
    if (!Number.isNaN(y)) {
      const cur = getCurrentAnimeSeason(now)
      if (item.season === cur.season && y === cur.year) return true
    }
  }

  return false
}

const WEEKDAYS_BY_INDEX: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// Weekday of a `YYYY-MM-DD` date, read as a local calendar day so the
// result never shifts across a timezone boundary.
export function weekdayFromDate(iso?: string): Weekday | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return undefined
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? undefined : WEEKDAYS_BY_INDEX[d.getDay()]
}

// The weekday new episodes air on: the one the user picked, otherwise
// the weekday of the first air date.
export function airingWeekday(item: AnyItem): Weekday | undefined {
  return item.airingDay || weekdayFromDate(item.airedFrom)
}

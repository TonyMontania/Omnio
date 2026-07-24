// Aggregations shown in the Insights tab.
// Every function here is pure: it takes the current items list and returns
// numbers, buckets, or "top N" lists. No React, no side effects.
//
// A lot of the "top X" functions look almost identical — that's deliberate.
// They each read a different field of Item, so trying to factor them into
// a single generic makes call sites less clear.

import type { Item, MusicArtist } from '../types'
import { GAME_STATUS_OPTIONS, MANGA_STATUS_OPTIONS } from '../types'

// ---- Playtime formatting ----

// Playtime is stored as "H.MM" (e.g. "12.30" = 12h 30min). Returns total minutes.
export function parsePlayTime(v?: string): number {
  if (!v) return 0
  const [h, m] = v.split('.')
  return parseInt(h || '0', 10) * 60 + parseInt((m || '0').padEnd(2, '0').slice(0, 2), 10)
}

export function formatMinutes(total: number): string {
  return `${Math.floor(total / 60)}h ${total % 60}m`
}

// ---- Headline stats per category ----

// Small pill row shown at the top of a library view.
// Shape and content are category-specific: games track hours + completion %,
// movies track total watch time, manga tracks chapters read, etc.
export function getCategoryStats(categoryId: string, list: Item[]): { label: string; value: string }[] {
  const currentYear = new Date().getFullYear()
  const finishedThisYear = list.filter((i) => i.finishedAt && new Date(i.finishedAt).getFullYear() === currentYear).length
  const ratedItems = list.filter((i) => i.rating)
  const avgRating = ratedItems.length ? (ratedItems.reduce((a, i) => a + (i.rating || 0), 0) / ratedItems.length).toFixed(1) : null

  const base: { label: string; value: string }[] = [{ label: 'Total in library', value: String(list.length) }]

  if (categoryId === 'videojuegos') {
    const totalMin = list.reduce((acc, i) => acc + parsePlayTime(i.playTime), 0)
    const completed = list.filter((i) => i.gameStatus === 'completed').length
    const pct = list.length ? Math.round((completed / list.length) * 100) : 0
    base.push({ label: 'Hours played', value: formatMinutes(totalMin) })
    base.push({ label: 'Completed', value: `${pct}%` })
  } else if (categoryId === 'peliculas') {
    const watchedMin = list.reduce((acc, i) => {
      if (!i.consumed) return acc
      const dur = parseInt(i.duration || '0', 10)
      const rewatches = i.rewatches ? i.rewatches.length : 0
      const times = parseInt(i.timesWatched || '1', 10)
      const totalTimes = Math.max(times, 1 + rewatches)
      return acc + dur * totalTimes
    }, 0)
    base.push({ label: 'Watch time', value: formatMinutes(watchedMin) })
    base.push({ label: 'Watched', value: String(list.filter((i) => i.consumed).length) })
  } else if (categoryId === 'series') {
    const epsWatched = list.reduce((acc, i) => acc + parseInt(i.episodesWatched || '0', 10), 0)
    const totalMin = list.reduce((acc, i) => acc + (parseInt(i.episodesWatched || '0', 10) * parseInt(i.episodeDuration || '0', 10)), 0)
    const seasonsWatched = list.reduce((acc, i) => {
      if (i.seasons && i.seasons.length > 0) return acc + i.seasons.filter((s) => s.watched || (s.episodes && s.episodes.length > 0 && s.episodes.every((e) => e.watched))).length
      return acc + (i.units?.filter((u) => u.watched).length || 0)
    }, 0)
    const completed = list.filter((i) => i.seriesStatus === 'completed').length
    const pct = list.length ? Math.round((completed / list.length) * 100) : 0
    base.push({ label: 'Episodes watched', value: String(epsWatched) })
    if (totalMin > 0) base.push({ label: 'Total watch time', value: formatMinutes(totalMin) })
    base.push({ label: 'Seasons watched', value: String(seasonsWatched) })
    base.push({ label: 'Completed', value: `${pct}%` })
  } else if (categoryId === 'anime' || categoryId === 'donghua') {
    const epsWatched = list.reduce((acc, i) => acc + parseInt(i.episodesWatched || '0', 10), 0)
    const totalMin = list.reduce((acc, i) => acc + (parseInt(i.episodesWatched || '0', 10) * parseInt(i.episodeDuration || '0', 10)), 0)
    const completed = list.filter((i) => i.watchStatus === 'completed').length
    const pct = list.length ? Math.round((completed / list.length) * 100) : 0
    base.push({ label: 'Episodes watched', value: String(epsWatched) })
    if (totalMin > 0) base.push({ label: 'Total watch time', value: formatMinutes(totalMin) })
    base.push({ label: 'Completed', value: `${pct}%` })
  } else if (categoryId === 'manga' || categoryId === 'manhwa' || categoryId === 'manhua' || categoryId === 'comics_west') {
    const totalChaptersRead = list.reduce((acc, i) => {
      if (i.hasChapters && i.chapters) return acc + i.chapters.filter((c) => c.read).length
      return acc + parseInt(i.chaptersRead || '0', 10)
    }, 0)
    const totalVolumesRead = list.reduce((acc, i) => acc + parseInt(i.volumesRead || '0', 10), 0)
    const completed = list.filter((i) => i.mangaStatus === 'completed').length
    const pct = list.length ? Math.round((completed / list.length) * 100) : 0
    base.push({ label: 'Chapters read', value: String(totalChaptersRead) })
    if (totalVolumesRead > 0) base.push({ label: 'Volumes read', value: String(totalVolumesRead) })
    base.push({ label: 'Completed', value: `${pct}%` })
  } else if (categoryId === 'musica') {
    base.push({ label: 'Listened', value: String(list.filter((i) => i.consumed).length) })
  }

  if (avgRating) base.push({ label: 'Average rating', value: `★ ${avgRating}` })
  base.push({ label: `Completed in ${currentYear}`, value: String(finishedThisYear) })

  return base
}

// ---- Top rated ----

export function getTopRated(list: Item[], limit = 5): Item[] {
  return [...list].filter((i) => i.rating).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, limit)
}

// ---- "Top N by frequency" families ----
// Two shapes cover every stat: either the item exposes an array (studios,
// cast, genres, directors, devs, publishers, platforms, authors, mangaArtists)
// or a single scalar (network, label, magazine). One helper each keeps the
// callsites tiny and lets new "top X" queries land in a single line.
function topByArray(list: Item[], get: (i: Item) => string[] | undefined, limit: number): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const i of list) for (const v of get(i) ?? []) counts.set(v, (counts.get(v) ?? 0) + 1)
  return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, limit)
}
function topByScalar(list: Item[], get: (i: Item) => string | undefined, limit: number): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const i of list) { const v = get(i); if (v) counts.set(v, (counts.get(v) ?? 0) + 1) }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, limit)
}

export function getTopArtists(artists: MusicArtist[], list: Item[], limit = 5): { name: string; count: number }[] {
  return artists
    .map((a) => ({ name: a.name, count: list.filter((i) => i.artist === a.name).length }))
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
export const getTopStudios       = (list: Item[], limit = 5) => topByArray(list, (i) => i.studios, limit)
export const getTopActors        = (list: Item[], limit = 5) => topByArray(list, (i) => i.cast, limit)
export const getTopGenres        = (list: Item[], limit = 5) => topByArray(list, (i) => i.genres, limit)
export const getTopDirectors     = (list: Item[], limit = 5) => topByArray(list, (i) => i.directors, limit)
export const getTopDevs          = (list: Item[], limit = 5) => topByArray(list, (i) => i.devs, limit)
export const getTopPublishers    = (list: Item[], limit = 5) => topByArray(list, (i) => i.publishers, limit)
export const getTopPlatforms     = (list: Item[], limit = 5) => topByArray(list, (i) => i.platforms, limit)
export const getTopMangaAuthors  = (list: Item[], limit = 5) => topByArray(list, (i) => i.authors, limit)
export const getTopMangaArtists  = (list: Item[], limit = 5) => topByArray(list, (i) => i.mangaArtists, limit)
export const getTopNetworks      = (list: Item[], limit = 5) => topByScalar(list, (i) => i.network, limit)
export const getTopMusicLabels   = (list: Item[], limit = 5) => topByScalar(list, (i) => i.label, limit)
export const getTopMagazines     = (list: Item[], limit = 5) => topByScalar(list, (i) => i.magazine, limit)

// ---- Activity per month (last 12 months, oldest first) ----
// One shared bucket walker: given a source of Date-like strings per item, we
// count how many fall into each of the trailing 12 months. Every stat below
// is a one-line adapter picking a different source.

function last12Months(): { label: string; key: string }[] {
  const now = new Date()
  const out: { label: string; key: string }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), key: `${d.getFullYear()}-${d.getMonth()}` })
  }
  return out
}
function monthKey(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${d.getMonth()}`
}
function bucketByMonth(list: Item[], collectDates: (i: Item) => (string | undefined)[]): { label: string; value: number }[] {
  const months = last12Months()
  const counts = new Map(months.map((m) => [m.key, 0]))
  for (const i of list) {
    for (const raw of collectDates(i)) {
      const k = monthKey(raw)
      if (k && counts.has(k)) counts.set(k, counts.get(k)! + 1)
    }
  }
  return months.map((m) => ({ label: m.label, value: counts.get(m.key) ?? 0 }))
}

export const getMonthlyActivity        = (list: Item[]) => bucketByMonth(list, (i) => [i.finishedAt])
export const getAnimeEpisodesPerMonth  = (list: Item[]) => bucketByMonth(list, (i) => (i.episodes ?? []).filter((e) => e.watched).map((e) => e.watchedDate))
export const getSeriesEpisodesPerMonth = (list: Item[]) => bucketByMonth(list, (i) => (i.seasons ?? []).flatMap((s) => (s.episodes ?? []).filter((e) => e.watched).map((e) => e.watchedDate)))
export const getMangaChaptersPerMonth  = (list: Item[]) => bucketByMonth(list, (i) => (i.chapters ?? []).filter((c) => c.read).map((c) => c.readDate))
// Music re-uses the rewatches[] field to store listen sessions.
export const getMusicListensPerMonth   = (list: Item[]) => bucketByMonth(list, (i) => (i.rewatches ?? []).map((r) => r.date))
// Movies count both the primary finishedAt and every rewatch entry.
export const getMoviesWatchedPerMonth  = (list: Item[]) => bucketByMonth(list, (i) => [i.finishedAt, ...(i.rewatches ?? []).map((r) => r.date)])

// ---- Status distribution (pie / bar chart data) ----

export interface DistSlice { label: string; value: number; color: string }

export function getDistribution(categoryId: string, list: Item[]): DistSlice[] {
  if (categoryId === 'videojuegos') {
    return GAME_STATUS_OPTIONS.map((s) => ({
      label: s.label,
      value: list.filter((i) => (i.gameStatus || 'backlog') === s.value).length,
      color: `var(--status-${s.value})`,
    }))
  }
  if (categoryId === 'peliculas' || categoryId === 'musica') {
    const done = list.filter((i) => i.consumed).length
    return [
      { label: categoryId === 'musica' ? 'Listened' : 'Watched', value: done, color: 'var(--status-completed)' },
      { label: categoryId === 'musica' ? 'Not listened' : 'Not watched', value: list.length - done, color: 'var(--status-backlog)' },
    ]
  }
  if (categoryId === 'manga' || categoryId === 'manhwa' || categoryId === 'manhua' || categoryId === 'comics_west') {
    return MANGA_STATUS_OPTIONS.map((s) => ({
      label: s.label,
      value: list.filter((i) => (i.mangaStatus || 'plan_to_read') === s.value).length,
      color: `var(--status-${s.value})`,
    }))
  }
  const full = list.filter((i) => i.units && i.units.length > 0 && i.units.every((u) => u.watched)).length
  const partial = list.filter((i) => i.units && i.units.some((u) => u.watched) && !i.units.every((u) => u.watched)).length
  const none = list.length - full - partial
  return [
    { label: 'Completed', value: full, color: 'var(--status-completed)' },
    { label: 'In progress', value: partial, color: 'var(--status-playing)' },
    { label: 'Not started', value: none, color: 'var(--status-backlog)' },
  ]
}

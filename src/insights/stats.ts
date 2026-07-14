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

export function getTopArtists(artists: MusicArtist[], list: Item[], limit = 5): { name: string; count: number }[] {
  return artists
    .map((a) => ({ name: a.name, count: list.filter((i) => i.artist === a.name).length }))
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function getTopStudios(list: Item[], limit = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  list.forEach((i) => i.studios?.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1)))
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function getTopNetworks(list: Item[], limit = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  list.forEach((i) => { if (i.network) counts.set(i.network, (counts.get(i.network) ?? 0) + 1) })
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function getTopActors(list: Item[], limit = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  list.forEach((i) => i.cast?.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1)))
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function getTopGenres(list: Item[], limit = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  list.forEach((i) => i.genres?.forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1)))
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function getTopDirectors(list: Item[], limit = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  list.forEach((i) => i.directors?.forEach((d) => counts.set(d, (counts.get(d) ?? 0) + 1)))
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function getTopDevs(list: Item[], limit = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  list.forEach((i) => i.devs?.forEach((d) => counts.set(d, (counts.get(d) ?? 0) + 1)))
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function getTopPublishers(list: Item[], limit = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  list.forEach((i) => i.publishers?.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1)))
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function getTopPlatforms(list: Item[], limit = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  list.forEach((i) => i.platforms?.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1)))
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function getTopMusicLabels(list: Item[], limit = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  list.forEach((i) => { if (i.label) counts.set(i.label, (counts.get(i.label) ?? 0) + 1) })
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function getTopMangaAuthors(list: Item[], limit = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  list.forEach((i) => i.authors?.forEach((a) => counts.set(a, (counts.get(a) ?? 0) + 1)))
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function getTopMangaArtists(list: Item[], limit = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  list.forEach((i) => i.mangaArtists?.forEach((a) => counts.set(a, (counts.get(a) ?? 0) + 1)))
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function getTopMagazines(list: Item[], limit = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  list.forEach((i) => { if (i.magazine) counts.set(i.magazine, (counts.get(i.magazine) ?? 0) + 1) })
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// ---- Activity per month (last 12 months, oldest first) ----

// The "per month" functions all share the same 12-month bucket structure
// but each reads a different date source (finishedAt, episodes[].watchedDate,
// chapters[].readDate, rewatches[].date). Kept as separate functions so
// each call site says exactly what it's counting.

export function getMonthlyActivity(list: Item[]): { label: string; value: number }[] {
  const months: { label: string; key: string }[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), key: `${d.getFullYear()}-${d.getMonth()}` })
  }
  return months.map((m) => ({
    label: m.label,
    value: list.filter((i) => {
      if (!i.finishedAt) return false
      const d = new Date(i.finishedAt)
      return `${d.getFullYear()}-${d.getMonth()}` === m.key
    }).length,
  }))
}

export function getAnimeEpisodesPerMonth(list: Item[]): { label: string; value: number }[] {
  const months: { label: string; key: string }[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), key: `${d.getFullYear()}-${d.getMonth()}` })
  }
  const allEpisodes = list.flatMap((i) => i.episodes ?? [])
  return months.map((m) => ({
    label: m.label,
    value: allEpisodes.filter((e) => {
      if (!e.watched || !e.watchedDate) return false
      const d = new Date(e.watchedDate)
      return `${d.getFullYear()}-${d.getMonth()}` === m.key
    }).length,
  }))
}

export function getSeriesEpisodesPerMonth(list: Item[]): { label: string; value: number }[] {
  const months: { label: string; key: string }[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), key: `${d.getFullYear()}-${d.getMonth()}` })
  }
  const allEpisodes = list.flatMap((i) => (i.seasons ?? []).flatMap((s) => s.episodes ?? []))
  return months.map((m) => ({
    label: m.label,
    value: allEpisodes.filter((e) => {
      if (!e.watched || !e.watchedDate) return false
      const d = new Date(e.watchedDate)
      return `${d.getFullYear()}-${d.getMonth()}` === m.key
    }).length,
  }))
}

// Counts each rewatch date as a separate watch, plus the primary finishedAt.
export function getMoviesWatchedPerMonth(list: Item[]): { label: string; value: number }[] {
  const months: { label: string; key: string }[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), key: `${d.getFullYear()}-${d.getMonth()}` })
  }
  return months.map((m) => ({
    label: m.label,
    value: list.reduce((acc, i) => {
      const primary = i.finishedAt && `${new Date(i.finishedAt).getFullYear()}-${new Date(i.finishedAt).getMonth()}` === m.key ? 1 : 0
      const extra = (i.rewatches ?? []).filter((r) => {
        if (!r.date) return false
        const d = new Date(r.date)
        return `${d.getFullYear()}-${d.getMonth()}` === m.key
      }).length
      return acc + primary + extra
    }, 0),
  }))
}

export function getMangaChaptersPerMonth(list: Item[]): { label: string; value: number }[] {
  const months: { label: string; key: string }[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), key: `${d.getFullYear()}-${d.getMonth()}` })
  }
  const allChapters = list.flatMap((i) => i.chapters ?? [])
  return months.map((m) => ({
    label: m.label,
    value: allChapters.filter((c) => {
      if (!c.read || !c.readDate) return false
      const d = new Date(c.readDate)
      return `${d.getFullYear()}-${d.getMonth()}` === m.key
    }).length,
  }))
}

// Music re-uses the rewatches[] field to store listen sessions.
export function getMusicListensPerMonth(list: Item[]): { label: string; value: number }[] {
  const months: { label: string; key: string }[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), key: `${d.getFullYear()}-${d.getMonth()}` })
  }
  const allSessions = list.flatMap((i) => i.rewatches ?? [])
  return months.map((m) => ({
    label: m.label,
    value: allSessions.filter((r) => {
      if (!r.date) return false
      const d = new Date(r.date)
      return `${d.getFullYear()}-${d.getMonth()}` === m.key
    }).length,
  }))
}

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

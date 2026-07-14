// Runtime helpers: label lookups, derived counts, formatters.
// Everything here is pure (input → output, no side effects, no state).

import type {
  Ownership, GameStatus,
  MusicType,
  MangaStatus, PublicationStatus,
  AnimeStatus, AiringStatus, AnimeFormat, AnimeSeason, Demographic, AnimeSource,
  SeriesStatus, SeriesFormat,
  MusicSource, MangaSource, MovieSource, GameSource, WatchLocation,
  AgeRating, RelationKind,
  Chapter, Episode, Season, Track, Item,
} from './entities'

import {
  OWNERSHIP_OPTIONS, GAME_STATUS_OPTIONS,
  ANIME_STATUS_OPTIONS, AIRING_STATUS_OPTIONS, ANIME_FORMAT_OPTIONS, ANIME_SEASON_OPTIONS, DEMOGRAPHIC_OPTIONS, ANIME_SOURCE_OPTIONS,
  SERIES_STATUS_OPTIONS, SERIES_FORMAT_OPTIONS,
  MUSIC_SOURCE_OPTIONS, MUSIC_TYPE_OPTIONS,
  MANGA_STATUS_OPTIONS, PUBLICATION_STATUS_OPTIONS, MANGA_SOURCE_OPTIONS,
  MOVIE_SOURCE_OPTIONS,
  GAME_SOURCE_OPTIONS,
  WATCH_LOCATION_OPTIONS,
  RELATION_OPTIONS, AGE_RATING_OPTIONS,
} from './options'

// ---- Asset resolution ----

// Turns a stored asset path into something the renderer can load.
// Data URLs / absolute URLs pass through unchanged; relative paths get the
// omnio-asset:// prefix so Electron's custom protocol handler picks them up.
export function assetSrc(value?: string | null): string | undefined {
  if (!value) return undefined
  if (/^(data:|https?:|file:|blob:|omnio-asset:)/i.test(value)) return value
  return `omnio-asset://${value}`
}

// ---- Relation ----

export function getRelationLabel(v: RelationKind): string {
  return RELATION_OPTIONS.find((r) => r.value === v)?.label ?? v
}

// ---- Seasons (Series) ----

export function getSeasonWatchedCount(season: Season): number {
  if (season.episodes && season.episodes.length > 0) return season.episodes.filter((e) => e.watched).length
  if (season.watched) return parseInt(season.totalEpisodes || '0', 10) || 0
  return 0
}

export function getSeasonTotalEpisodes(season: Season): number {
  if (season.episodes && season.episodes.length > 0) return season.episodes.length
  return parseInt(season.totalEpisodes || '0', 10) || 0
}

export function seasonsDerivedCounts(seasons: Season[]): { watched: number; total: number } {
  return seasons.reduce((acc, s) => ({
    watched: acc.watched + getSeasonWatchedCount(s),
    total: acc.total + getSeasonTotalEpisodes(s),
  }), { watched: 0, total: 0 })
}

// ---- Chapters (Manga family) ----

export function getReadChaptersCount(chapters?: Chapter[]): number {
  return chapters ? chapters.filter((c) => c.read).length : 0
}

export function getNextUnreadChapter(chapters?: Chapter[]): Chapter | null {
  return chapters?.find((c) => !c.read) ?? null
}

// ---- Episodes (Anime family) ----

export function getWatchedEpisodesCount(episodes?: Episode[]): number {
  return episodes ? episodes.filter((e) => e.watched).length : 0
}

export function getNextUnwatchedEpisode(episodes?: Episode[]): Episode | null {
  return episodes?.find((e) => !e.watched) ?? null
}

// ---- Tracks (Music) ----

export function parseDurationToSeconds(d: string): number {
  const parts = d.split(':').map((p) => parseInt(p, 10) || 0)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] || 0
}

export function getTotalDuration(tracks: Track[]): string {
  const totalSeconds = tracks.reduce((acc, t) => acc + parseDurationToSeconds(t.duration), 0)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function isAlbumLikeMusic(type?: MusicType): boolean {
  return type === 'album' || type === 'ep' || type === 'live' || type === 'recopilation'
}

// ---- Label lookups ----

export function getWatchLocationLabel(v: WatchLocation): string {
  return WATCH_LOCATION_OPTIONS.find((o) => o.value === v)?.label ?? v
}

export function getAnimeSeasonLabel(v: AnimeSeason): string {
  return ANIME_SEASON_OPTIONS.find((s) => s.value === v)?.label ?? v
}

export function getDemographicLabel(v: Demographic): string {
  return DEMOGRAPHIC_OPTIONS.find((d) => d.value === v)?.label ?? v
}

export function getAnimeSourceLabel(v: AnimeSource): string {
  return ANIME_SOURCE_OPTIONS.find((s) => s.value === v)?.label ?? v
}

export function getAgeRatingLabel(v: AgeRating): string {
  return AGE_RATING_OPTIONS.find((r) => r.value === v)?.label ?? v
}

export function getSeriesFormatLabel(v: SeriesFormat): string {
  return SERIES_FORMAT_OPTIONS.find((f) => f.value === v)?.label ?? v
}

export function getMusicSourceLabel(v: MusicSource): string {
  return MUSIC_SOURCE_OPTIONS.find((s) => s.value === v)?.label ?? v
}

export function getMangaSourceLabel(v: MangaSource): string {
  return MANGA_SOURCE_OPTIONS.find((s) => s.value === v)?.label ?? v
}

export function getMovieSourceLabel(v: MovieSource): string {
  return MOVIE_SOURCE_OPTIONS.find((s) => s.value === v)?.label ?? v
}

export function getGameSourceLabel(v: GameSource): string {
  return GAME_SOURCE_OPTIONS.find((s) => s.value === v)?.label ?? v
}

export function getAiringStatusLabel(value: AiringStatus): string {
  return AIRING_STATUS_OPTIONS.find((s) => s.value === value)?.label ?? value
}

export function getAnimeFormatLabel(value: AnimeFormat): string {
  return ANIME_FORMAT_OPTIONS.find((f) => f.value === value)?.label ?? value
}

export function getPublicationStatusLabel(value: PublicationStatus): string {
  return PUBLICATION_STATUS_OPTIONS.find((s) => s.value === value)?.label ?? value
}

export function getOwnershipLabel(ownership: Ownership): string {
  return OWNERSHIP_OPTIONS.find((o) => o.value === ownership)?.label ?? ownership
}

export function getMusicTypeLabel(type: MusicType): string {
  return MUSIC_TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type
}

// ---- Status lookups (return whole option row, with fallback to first) ----

export function getAnimeStatus(value?: AnimeStatus) {
  return ANIME_STATUS_OPTIONS.find((s) => s.value === (value || 'plan_to_watch')) ?? ANIME_STATUS_OPTIONS[0]
}

export function getSeriesStatus(value?: SeriesStatus) {
  return SERIES_STATUS_OPTIONS.find((s) => s.value === (value || 'plan_to_watch')) ?? SERIES_STATUS_OPTIONS[0]
}

export function getMangaStatus(value?: MangaStatus) {
  return MANGA_STATUS_OPTIONS.find((s) => s.value === (value || 'plan_to_read')) ?? MANGA_STATUS_OPTIONS[0]
}

export function getGameStatus(value?: GameStatus) {
  return GAME_STATUS_OPTIONS.find((s) => s.value === (value || 'backlog')) ?? GAME_STATUS_OPTIONS[0]
}

export function getGameStatusRank(status?: GameStatus): number {
  return GAME_STATUS_OPTIONS.findIndex((s) => s.value === (status || 'backlog'))
}

// ---- Runtime ----

export function getTotalRuntimeMinutes(episodeDuration?: string, totalEpisodes?: string, episodesWatched?: string): number | null {
  const dur = parseInt(episodeDuration || '', 10)
  const ep = parseInt(totalEpisodes || episodesWatched || '', 10)
  if (isNaN(dur) || isNaN(ep) || dur <= 0 || ep <= 0) return null
  return dur * ep
}

// ---- Category predicates & labels ----

export function isMangaLike(categoryId: string): boolean {
  return categoryId === 'manga' || categoryId === 'manhwa' || categoryId === 'manhua' || categoryId === 'comics_west'
}

export function unitsLabel(categoryId: string): string {
  return categoryId === 'manga' || categoryId === 'manhwa' || categoryId === 'manhua' ? 'Volumes' : 'Seasons'
}

// One-line summary shown under an item's title in list views.
// Which fields are picked depends on the category.
export function getCategoryLine(item: Item): string | null {
  switch (item.categoryId) {
    case 'videojuegos':
      return item.playTime ? `${item.playTime}h` : null
    case 'peliculas': {
      const parts = [item.releaseYear, item.duration ? `${item.duration} min` : null].filter(Boolean)
      return parts.length ? parts.join(' · ') : null
    }
    case 'series': {
      if (item.episodesWatched) return `Ep. ${item.episodesWatched}${item.totalEpisodes ? `/${item.totalEpisodes}` : ''}`
      if (!item.units || item.units.length === 0) return null
      const watchedCount = item.units.filter((u) => u.watched).length
      return `${watchedCount}/${item.units.length} ${unitsLabel(item.categoryId).toLowerCase()}`
    }
    case 'anime':
    case 'donghua': {
      if (!item.episodesWatched) return null
      return `Ep. ${item.episodesWatched}${item.totalEpisodes ? `/${item.totalEpisodes}` : ''}`
    }
    case 'manga':
    case 'manhwa':
    case 'manhua':
    case 'comics_west': {
      if (!item.chaptersRead) return null
      return `Ch. ${item.chaptersRead}${item.totalChapters ? `/${item.totalChapters}` : ''}`
    }
    case 'musica': {
      const parts = [item.releaseYear, item.musicType ? getMusicTypeLabel(item.musicType) : null].filter(Boolean)
      return parts.length ? parts.join(' · ') : null
    }
    default:
      return null
  }
}

// ---- Formatting ----

export function formatDurationMinutes(mins?: string): string | null {
  if (!mins) return null
  const total = parseInt(mins, 10)
  if (isNaN(total) || total <= 0) return null
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`
  return `${m}min`
}

// Minimal markdown-ish renderer used in notes previews.
// Supports **bold**, *italic*, and "- " bullet lists. HTML input is escaped first.
export function renderMiniMarkdown(text: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let html = escape(text)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  const lines = html.split('\n')
  let out = ''
  let inList = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      if (!inList) { out += '<ul>'; inList = true }
      out += `<li>${trimmed.slice(2)}</li>`
    } else {
      if (inList) { out += '</ul>'; inList = false }
      if (trimmed) out += `<p>${trimmed}</p>`
    }
  }
  if (inList) out += '</ul>'
  return out
}

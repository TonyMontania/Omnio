import type { Item, AnimeFormat, AnimeSource, AiringStatus, PublicationStatus, Demographic, Weekday } from '../types'

export interface FuzzyDate { year?: number; month?: number; day?: number }
export interface StaffEdge { role?: string; node?: { name?: { full?: string } } }
export interface NextAiringEpisode { episode: number; airingAt: number }

export interface AniListMedia {
  id: number
  title: { romaji?: string; english?: string; native?: string }
  format?: string
  status?: string
  episodes?: number
  chapters?: number
  volumes?: number
  duration?: number
  season?: string
  seasonYear?: number
  startDate?: FuzzyDate
  endDate?: FuzzyDate
  description?: string
  genres?: string[]
  studios?: { nodes?: { name: string }[] }
  staff?: { edges?: StaffEdge[] }
  source?: string
  countryOfOrigin?: string
  coverImage?: { extraLarge?: string; large?: string }
  bannerImage?: string
  synonyms?: string[]
  averageScore?: number
  siteUrl?: string
  tags?: { name: string; rank?: number; isMediaSpoiler?: boolean; isGeneralSpoiler?: boolean }[]
  nextAiringEpisode?: NextAiringEpisode | null
}

export function formatFuzzyDate(d?: FuzzyDate): string | undefined {
  if (!d?.year) return undefined
  const m = d.month ? String(d.month).padStart(2, '0') : '01'
  const day = d.day ? String(d.day).padStart(2, '0') : '01'
  return `${d.year}-${m}-${day}`
}

export const ANIME_FORMAT_MAP: Record<string, AnimeFormat> = {
  TV: 'tv', TV_SHORT: 'tv', MOVIE: 'movie', OVA: 'ova', ONA: 'ona',
  SPECIAL: 'special', MUSIC: 'music',
}

export const ANIME_SOURCE_MAP: Record<string, AnimeSource> = {
  ORIGINAL: 'original', MANGA: 'manga', LIGHT_NOVEL: 'light_novel',
  WEB_NOVEL: 'web_novel', NOVEL: 'novel', VIDEO_GAME: 'game',
  VISUAL_NOVEL: 'visual_novel', OTHER: 'other',
}

// HIATUS has no bucket of its own; it still counts as airing.
export const AIRING_STATUS_MAP: Record<string, AiringStatus> = {
  RELEASING: 'airing',
  FINISHED: 'finished',
  NOT_YET_RELEASED: 'not_yet_aired',
  CANCELLED: 'cancelled',
  HIATUS: 'airing',
}

export const PUB_STATUS_MAP: Record<string, PublicationStatus> = {
  RELEASING: 'publishing',
  FINISHED: 'finished',
  NOT_YET_RELEASED: 'not_yet_released',
  CANCELLED: 'cancelled',
  HIATUS: 'hiatus',
}

const DEMOGRAPHIC_FROM_GENRE: Record<string, Demographic> = {
  shounen: 'shonen', shonen: 'shonen',
  shoujo: 'shojo', shojo: 'shojo',
  seinen: 'seinen', josei: 'josei',
}

export function inferDemographic(genres?: string[]): Demographic | undefined {
  for (const g of genres ?? []) {
    const d = DEMOGRAPHIC_FROM_GENRE[g.toLowerCase()]
    if (d) return d
  }
  return undefined
}

export function stripAniListHtml(s?: string): string | undefined {
  if (!s) return undefined
  return s.replace(/<br\s*\/?>(?=\s|$)/gi, '\n').replace(/<[^>]+>/g, '').trim()
}

export function aniListTitle(m: AniListMedia): string {
  return m.title.english || m.title.romaji || m.title.native || ''
}

export function aniListCover(m: AniListMedia): string | undefined {
  return m.coverImage?.extraLarge || m.coverImage?.large
}

// Fields shared by anime and manga imports. Category-specific fields are
// added by the caller.
export function aniListCommonPatch(m: AniListMedia, kind: 'ANIME' | 'MANGA'): Partial<Item> {
  const title = aniListTitle(m)
  const desc = stripAniListHtml(m.description)
  return {
    title,
    ...(kind === 'ANIME' ? { animeDescription: desc } : { mangaDescription: desc }),
    alternativeTitles: Array.from(new Set([m.title.romaji, m.title.english, m.title.native, ...(m.synonyms ?? [])].filter(Boolean).filter((t) => t !== title))) as string[],
    genres: m.genres,
    demographic: inferDemographic(m.genres),
    releaseDate: formatFuzzyDate(m.startDate),
    seasonYear: m.seasonYear ? String(m.seasonYear) : undefined,
    season: (m.season?.toLowerCase() as Item['season']),
    airedFrom: formatFuzzyDate(m.startDate),
    airedTo: formatFuzzyDate(m.endDate),
    episodeDuration: m.duration ? String(m.duration) : undefined,
    studios: m.studios?.nodes?.map((n) => n.name),
  }
}

export function aniListAnimePatch(m: AniListMedia): Partial<Item> {
  return {
    ...aniListCommonPatch(m, 'ANIME'),
    animeFormat: m.format ? ANIME_FORMAT_MAP[m.format] : undefined,
    totalEpisodes: m.episodes ? String(m.episodes) : undefined,
    animeSource: m.source ? ANIME_SOURCE_MAP[m.source] : undefined,
    airingStatus: m.status ? AIRING_STATUS_MAP[m.status] : undefined,
    anilistId: m.id,
  }
}

export function aniListThemeTags(m: AniListMedia, limit = 12): string[] {
  return (m.tags ?? [])
    .filter((t) => !t.isMediaSpoiler && !t.isGeneralSpoiler)
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
    .slice(0, limit)
    .map((t) => t.name)
}

const normalizeTitle = (s: string): string => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '')

// The search result whose titles match one of the item's titles exactly
// (ignoring case, accents and punctuation). Returns undefined rather
// than guessing when nothing matches.
export function matchAniListMedia(results: AniListMedia[], titles: string[]): AniListMedia | undefined {
  const wanted = new Set(titles.map(normalizeTitle).filter(Boolean))
  return results.find((m) =>
    [m.title.romaji, m.title.english, m.title.native, ...(m.synonyms ?? [])]
      .some((t) => t && wanted.has(normalizeTitle(t))))
}

const WEEKDAYS: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function weekdayOfTimestamp(unixSeconds: number): Weekday {
  return WEEKDAYS[new Date(unixSeconds * 1000).getDay()]
}

// "3d 4h", "5h 12m", "18m" — time left until a unix timestamp.
export function formatCountdown(unixSeconds: number, now = Date.now()): string {
  const mins = Math.max(0, Math.round((unixSeconds * 1000 - now) / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

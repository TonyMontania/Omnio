// AniList metadata fetcher. Given an anime/manga title, search AniList,
// show a picker of matches, and hand back a shaped Partial<Item> the
// caller can merge into its editor state.

import type { Item, AnimeFormat, AnimeSource, AiringStatus, PublicationStatus } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'
import { assetBasename, downloadImageAsset } from './utils/files'

type MediaType = 'ANIME' | 'MANGA'

interface Props {
  initialQuery: string
  kind: MediaType
  categoryId: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
}

interface FuzzyDate { year?: number; month?: number; day?: number }
interface StaffEdge { role?: string; node?: { name?: { full?: string } } }
interface Media {
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
}

// AniList staff roles are free-text — "Story", "Art", "Story & Art", "Original
// Creator", etc. Split them into authors (writing) vs mangaArtists (drawing)
// so both fields fill correctly for manga imports.
function splitMangaStaff(staff?: { edges?: StaffEdge[] }): { authors: string[]; artists: string[] } {
  const authors: string[] = []
  const artists: string[] = []
  const seenA = new Set<string>()
  const seenB = new Set<string>()
  for (const e of staff?.edges ?? []) {
    const name = e.node?.name?.full
    const role = (e.role ?? '').toLowerCase()
    if (!name) continue
    if (/(story|writer|scenario|author|original creator|screenplay)/.test(role) && !seenA.has(name)) {
      authors.push(name); seenA.add(name)
    }
    if (/(art|illustrator|illustration|character design|drawer)/.test(role) && !seenB.has(name)) {
      artists.push(name); seenB.add(name)
    }
  }
  return { authors, artists }
}

function formatDate(d?: FuzzyDate): string | undefined {
  if (!d?.year) return undefined
  const m = d.month ? String(d.month).padStart(2, '0') : '01'
  const day = d.day ? String(d.day).padStart(2, '0') : '01'
  return `${d.year}-${m}-${day}`
}

const FORMAT_MAP: Record<string, AnimeFormat> = {
  TV: 'tv', TV_SHORT: 'tv', MOVIE: 'movie', OVA: 'ova', ONA: 'ona',
  SPECIAL: 'special', MUSIC: 'music',
}

const SOURCE_MAP_ANIME: Record<string, AnimeSource> = {
  ORIGINAL: 'original', MANGA: 'manga', LIGHT_NOVEL: 'light_novel',
  WEB_NOVEL: 'web_novel', NOVEL: 'novel', VIDEO_GAME: 'game',
  VISUAL_NOVEL: 'visual_novel', OTHER: 'other',
}
const AIRING_STATUS_MAP: Record<string, AiringStatus> = {
  RELEASING: 'airing',
  FINISHED: 'finished',
  NOT_YET_RELEASED: 'not_yet_aired',
  CANCELLED: 'cancelled',
  HIATUS: 'airing',   // no dedicated hiatus bucket — treat as still airing
}
// AniList reuses the same MediaStatus for manga — map into pubStatus.
const PUB_STATUS_MAP: Record<string, PublicationStatus> = {
  RELEASING: 'publishing',
  FINISHED: 'finished',
  NOT_YET_RELEASED: 'not_yet_released',
  CANCELLED: 'cancelled',
  HIATUS: 'hiatus',
}

function stripHtml(s?: string): string | undefined {
  if (!s) return undefined
  return s.replace(/<br\s*\/?>(?=\s|$)/gi, '\n').replace(/<[^>]+>/g, '').trim()
}

export default function AniListFetcher({ initialQuery, kind, categoryId, onApply, onClose }: Props) {
  const search = async (q: string): Promise<FetcherResult<Media>> => {
    const r = await window.ipcRenderer.invoke('anilist:search', q, kind)
    return r?.ok ? { ok: true, data: r.data as Media[] } : { ok: false, error: r?.error ?? 'Search failed' }
  }

  const apply = async (m: Media) => {
    const title = m.title.english || m.title.romaji || m.title.native || ''
    const cover = m.coverImage?.extraLarge || m.coverImage?.large
    const banner = m.bannerImage
    const coverPath = cover
      ? await downloadImageAsset( cover, categoryId, 'cover', assetBasename(title, 'cover'))
      : undefined
    const bannerPath = banner
      ? await downloadImageAsset( banner, categoryId, 'banner', assetBasename(title, 'banner'))
      : undefined
    const desc = stripHtml(m.description)
    const patch: Partial<Item> = {
      title,
      // Detail views render the category-specific description field. Writing
      // to the generic `description` was silently no-op'd in Anime/Manga.
      ...(kind === 'ANIME' ? { animeDescription: desc } : { mangaDescription: desc }),
      alternativeTitles: Array.from(new Set([m.title.romaji, m.title.english, m.title.native, ...(m.synonyms ?? [])].filter(Boolean).filter((t) => t !== title))) as string[],
      genres: m.genres,
      releaseDate: formatDate(m.startDate),
      seasonYear: m.seasonYear ? String(m.seasonYear) : undefined,
      season: (m.season?.toLowerCase() as Item['season']),
      airedFrom: formatDate(m.startDate),
      airedTo: formatDate(m.endDate),
      episodeDuration: m.duration ? String(m.duration) : undefined,
      studios: m.studios?.nodes?.map((n) => n.name),
    }
    if (kind === 'ANIME') {
      patch.animeFormat = m.format ? FORMAT_MAP[m.format] : undefined
      patch.totalEpisodes = m.episodes ? String(m.episodes) : undefined
      patch.animeSource = m.source ? SOURCE_MAP_ANIME[m.source] : undefined
      patch.airingStatus = m.status ? AIRING_STATUS_MAP[m.status] : undefined
    } else {
      patch.totalChapters = m.chapters ? String(m.chapters) : undefined
      patch.totalVolumes = m.volumes ? String(m.volumes) : undefined
      const { authors, artists } = splitMangaStaff(m.staff)
      if (authors.length) patch.authors = authors
      if (artists.length) patch.mangaArtists = artists
      if (m.status && PUB_STATUS_MAP[m.status]) patch.pubStatus = PUB_STATUS_MAP[m.status]
    }
    onApply(patch, coverPath || undefined, bannerPath || undefined)
    onClose()
  }

  return (
    <FetcherModal<Media>
      title={kind === 'ANIME' ? 'AniList · Anime' : 'AniList · Manga'}
      hint={
        <>AniList is free and needs no API key. Applying overwrites the standard fields
        (title, description, cover, banner, dates, episodes/chapters, studios, source, genres).
        Rating, notes, watch/read status and personal history stay as they are.</>
      }
      placeholder={`Search ${kind === 'ANIME' ? 'anime' : 'manga'}…`}
      initialQuery={initialQuery}
      onSearch={search}
      onApply={apply}
      onClose={onClose}
      renderHit={(m) => {
        const t = m.title.english || m.title.romaji || m.title.native || ''
        const y = m.startDate?.year
        const sub = [
          m.format ? m.format.replace('_', ' ').toLowerCase() : null,
          y,
          kind === 'ANIME' ? (m.episodes ? `${m.episodes} eps` : null) : (m.chapters ? `${m.chapters} ch` : null),
          m.averageScore ? `★ ${(m.averageScore / 10).toFixed(1)}` : null,
        ].filter(Boolean).join(' · ')
        return { key: m.id, title: t, sub, thumbUrl: m.coverImage?.large, desc: stripHtml(m.description) }
      }}
    />
  )
}

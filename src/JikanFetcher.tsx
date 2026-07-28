// MyAnimeList metadata fetcher via the Jikan v4 unofficial API. Same
// shape as AniListFetcher — search a title, pick a match, applies a
// Partial<Item> to the currently-open editor. Jikan has softer rate
// limits (3 rps) but similar reach; useful as a fallback when AniList
// misses a title (older or region-specific entries).

import type { Item, AnimeFormat, AnimeSource, Demographic, AgeRating, AiringStatus } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'
import { assetBasename, downloadImageAsset } from './utils/files'

type MediaType = 'anime' | 'manga'

interface Props {
  initialQuery: string
  kind: MediaType
  categoryId: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
}

interface JikanMedia {
  mal_id: number
  url: string
  images?: { jpg?: { large_image_url?: string; image_url?: string } }
  title: string
  title_english?: string
  title_japanese?: string
  title_synonyms?: string[]
  type?: string
  source?: string
  episodes?: number
  chapters?: number
  volumes?: number
  status?: string
  aired?: { from?: string; to?: string; string?: string }
  published?: { from?: string; to?: string; string?: string }
  duration?: string           // e.g. "24 min per ep"
  score?: number
  synopsis?: string
  season?: string
  year?: number
  studios?: { name: string }[]
  authors?: { name: string }[]
  serializations?: { name: string }[]
  genres?: { name: string }[]
  demographics?: { name: string }[]
  rating?: string             // "PG-13", "R+ - Mild Nudity", "Rx - Hentai", etc.
}

// MAL demographic strings → our Demographic union.
const DEMOGRAPHIC_MAP: Record<string, Demographic> = {
  Shounen: 'shonen', Shoujo: 'shojo', Seinen: 'seinen', Josei: 'josei',
}
// MAL rating strings are free-text prefixed with the code. We match on the
// prefix and drop the suffix so "R+ - Mild Nudity" maps like plain "R+".
function mapMalRating(raw?: string): AgeRating | undefined {
  if (!raw) return undefined
  const code = raw.trim().split(/[\s-]/)[0].toUpperCase()
  if (code === 'G') return 'e'
  if (code === 'PG') return 'e'
  if (code === 'PG-13') return 't'
  if (code === 'R') return 'm'
  if (code === 'R+') return 'm'
  if (code === 'RX') return 'ao'
  return undefined
}
// MAL airing status uses "Currently Airing" / "Finished Airing" / "Not yet aired".
const MAL_AIRING_MAP: Record<string, AiringStatus> = {
  'Currently Airing': 'airing',
  'Publishing': 'airing',
  'Finished Airing': 'finished',
  'Finished': 'finished',
  'Not yet aired': 'not_yet_aired',
  'Not yet published': 'not_yet_aired',
  'Discontinued': 'cancelled',
  'On Hiatus': 'airing',
}

const FORMAT_MAP: Record<string, AnimeFormat> = {
  'TV': 'tv', 'Movie': 'movie', 'OVA': 'ova', 'ONA': 'ona',
  'Special': 'special', 'Music': 'music', 'TV Special': 'special',
}

const SOURCE_MAP: Record<string, AnimeSource> = {
  'Original': 'original', 'Manga': 'manga', 'Light novel': 'light_novel',
  'Web novel': 'web_novel', 'Novel': 'novel', 'Game': 'game',
  'Visual novel': 'visual_novel',
}

function isoDate(s?: string): string | undefined {
  if (!s) return undefined
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  return m ? m[1] : undefined
}

function extractDurationMinutes(s?: string): string | undefined {
  if (!s) return undefined
  const m = /(\d+)\s*min/.exec(s)
  return m ? m[1] : undefined
}

export default function JikanFetcher({ initialQuery, kind, categoryId, onApply, onClose }: Props) {
  const search = async (q: string): Promise<FetcherResult<JikanMedia>> => {
    const r = await window.ipcRenderer.invoke('jikan:search', q, kind)
    return r?.ok ? { ok: true, data: r.data as JikanMedia[] } : { ok: false, error: r?.error ?? 'Search failed' }
  }

  const apply = async (m: JikanMedia) => {
    const displayTitle = m.title_english || m.title
    const coverUrl = m.images?.jpg?.large_image_url || m.images?.jpg?.image_url
    const coverPath = coverUrl
      ? await downloadImageAsset( coverUrl, categoryId, 'cover', assetBasename(displayTitle, 'cover')) as string | null
      : null
    const alts = Array.from(new Set([m.title, m.title_english, m.title_japanese, ...(m.title_synonyms ?? [])].filter(Boolean))) as string[]
    const patch: Partial<Item> = {
      title: displayTitle,
      description: m.synopsis,
      alternativeTitles: alts.filter((t) => t !== displayTitle),
      genres: m.genres?.map((g) => g.name),
      releaseDate: isoDate(m.aired?.from ?? m.published?.from),
      seasonYear: m.year ? String(m.year) : undefined,
      season: (m.season?.toLowerCase() as Item['season']),
      airedFrom: isoDate(m.aired?.from),
      airedTo: isoDate(m.aired?.to),
      episodeDuration: extractDurationMinutes(m.duration),
      studios: m.studios?.map((s) => s.name),
    }
    // Both anime and manga share demographic + rating.
    const demoName = m.demographics?.[0]?.name
    if (demoName && DEMOGRAPHIC_MAP[demoName]) patch.demographic = DEMOGRAPHIC_MAP[demoName]
    const age = mapMalRating(m.rating)
    if (age) patch.ageRating = age
    if (m.status && MAL_AIRING_MAP[m.status]) patch.airingStatus = MAL_AIRING_MAP[m.status]

    if (kind === 'anime') {
      patch.animeFormat = m.type ? FORMAT_MAP[m.type] : undefined
      patch.totalEpisodes = m.episodes ? String(m.episodes) : undefined
      patch.animeSource = m.source ? SOURCE_MAP[m.source] : undefined
    } else {
      patch.totalChapters = m.chapters ? String(m.chapters) : undefined
      patch.totalVolumes = m.volumes ? String(m.volumes) : undefined
      patch.authors = m.authors?.map((a) => a.name)
      patch.magazine = m.serializations?.[0]?.name
    }

    onApply(patch, coverPath || undefined, undefined)
    onClose()
  }

  return (
    <FetcherModal<JikanMedia>
      title={`MyAnimeList · ${kind === 'anime' ? 'Anime' : 'Manga'}`}
      hint={
        <>Via Jikan (unofficial MAL proxy — no API key needed). Applying overwrites the
        standard fields (title, description, cover, dates, episodes/chapters, studios,
        source, genres, authors, serialization, demographic, age rating, airing
        status). Rating, notes and personal history are left alone.</>
      }
      placeholder={`Search ${kind}…`}
      initialQuery={initialQuery}
      onSearch={search}
      onApply={apply}
      onClose={onClose}
      renderHit={(m) => {
        const t = m.title_english || m.title
        const y = m.year || (m.aired?.from ? new Date(m.aired.from).getFullYear() : m.published?.from ? new Date(m.published.from).getFullYear() : null)
        const sub = [
          m.type?.toLowerCase(),
          y,
          kind === 'anime' ? (m.episodes ? `${m.episodes} eps` : null) : (m.chapters ? `${m.chapters} ch` : null),
          m.score ? `★ ${m.score.toFixed(1)}` : null,
        ].filter(Boolean).join(' · ')
        return {
          key: m.mal_id,
          title: t,
          sub,
          thumbUrl: m.images?.jpg?.image_url,
          desc: m.synopsis,
        }
      }}
    />
  )
}

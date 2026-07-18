// AniList metadata fetcher. Given an anime/manga title, search AniList,
// show a picker of matches, and hand back a shaped Partial<Item> the
// caller can merge into its editor state.

import { useEffect, useMemo, useState } from 'react'
import type { Item, AnimeFormat, AnimeSource } from './types'

type MediaType = 'ANIME' | 'MANGA'

interface Props {
  initialQuery: string
  kind: MediaType
  categoryId: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
}

interface FuzzyDate { year?: number; month?: number; day?: number }
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
  staff?: { nodes?: { name: { full: string } }[] }
  source?: string
  countryOfOrigin?: string
  coverImage?: { extraLarge?: string; large?: string }
  bannerImage?: string
  synonyms?: string[]
  averageScore?: number
  siteUrl?: string
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

function stripHtml(s?: string): string | undefined {
  if (!s) return undefined
  return s.replace(/<br\s*\/?>(?=\s|$)/gi, '\n').replace(/<[^>]+>/g, '').trim()
}

export default function AniListFetcher({ initialQuery, kind, categoryId, onApply, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [results, setResults] = useState<Media[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<number | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    const r = await window.ipcRenderer.invoke('anilist:search', query.trim(), kind)
    setLoading(false)
    if (r?.ok) setResults((r.data as Media[]) ?? [])
    else setError(r?.error ?? 'Search failed')
  }

  // Auto-run on mount if there's a title.
  useEffect(() => {
    if ((initialQuery ?? '').trim()) search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = async (m: Media) => {
    setApplying(m.id)
    const cover = m.coverImage?.extraLarge || m.coverImage?.large
    const banner = m.bannerImage
    const coverPath = cover
      ? await window.ipcRenderer.invoke('image:download', cover, categoryId, 'cover')
      : undefined
    const bannerPath = banner
      ? await window.ipcRenderer.invoke('image:download', banner, categoryId, 'banner')
      : undefined

    const title = m.title.english || m.title.romaji || m.title.native || ''
    const patch: Partial<Item> = {
      title,
      description: stripHtml(m.description),
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
    } else {
      patch.totalChapters = m.chapters ? String(m.chapters) : undefined
      patch.totalVolumes = m.volumes ? String(m.volumes) : undefined
    }
    setApplying(null)
    onApply(patch, coverPath || undefined, bannerPath || undefined)
    onClose()
  }

  const title = useMemo(() => kind === 'ANIME' ? 'AniList · Anime' : 'AniList · Manga', [kind])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel fetch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            AniList is free and needs no API key. Applying overwrites the standard fields
            (title, description, cover, banner, dates, episodes/chapters, studios, source, genres).
            Rating, notes, watch/read status and personal history stay as they are.
          </p>
          <div className="fetch-search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search() }}
              placeholder={`Search ${kind === 'ANIME' ? 'anime' : 'manga'}…`}
              autoFocus
            />
            <button type="button" className="secondary-btn" onClick={search} disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
          {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}
          {!loading && !error && results.length === 0 && query && (
            <p className="hint">No matches. Try a different spelling.</p>
          )}
          {results.length > 0 && (
            <ul className="anilist-results">
              {results.map((m) => {
                const t = m.title.english || m.title.romaji || m.title.native
                const y = m.startDate?.year
                const sub = [
                  m.format ? m.format.replace('_', ' ').toLowerCase() : null,
                  y,
                  kind === 'ANIME' ? (m.episodes ? `${m.episodes} eps` : null) : (m.chapters ? `${m.chapters} ch` : null),
                  m.averageScore ? `★ ${(m.averageScore / 10).toFixed(1)}` : null,
                ].filter(Boolean).join(' · ')
                return (
                  <li key={m.id}>
                    <button type="button" className="anilist-hit" onClick={() => apply(m)} disabled={applying !== null}>
                      <div className="anilist-thumb">
                        {m.coverImage?.large ? <img src={m.coverImage.large} alt="" loading="lazy" /> : <span>{t?.charAt(0)}</span>}
                      </div>
                      <div className="anilist-text">
                        <div className="anilist-title">{t}</div>
                        <div className="anilist-sub">{sub}</div>
                        {m.description && <div className="anilist-desc">{stripHtml(m.description)?.slice(0, 180)}…</div>}
                      </div>
                      {applying === m.id && <span className="anilist-applying">Applying…</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// MyAnimeList metadata fetcher via the Jikan v4 unofficial API. Same
// shape as AniListFetcher — search a title, pick a match, applies a
// Partial<Item> to the currently-open editor. Jikan has softer rate
// limits (3 rps) but similar reach; useful as a fallback when AniList
// misses a title (older or region-specific entries).

import { useEffect, useMemo, useState } from 'react'
import type { Item, AnimeFormat, AnimeSource } from './types'

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
  const [query, setQuery] = useState(initialQuery ?? '')
  const [results, setResults] = useState<JikanMedia[]>([])
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
    const r = await window.ipcRenderer.invoke('jikan:search', query.trim(), kind)
    setLoading(false)
    if (r && (r as { ok?: boolean }).ok) setResults(((r as { data?: JikanMedia[] }).data) ?? [])
    else setError((r as { error?: string })?.error ?? 'Search failed')
  }

  useEffect(() => {
    if ((initialQuery ?? '').trim()) search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = async (m: JikanMedia) => {
    setApplying(m.mal_id)
    const coverUrl = m.images?.jpg?.large_image_url || m.images?.jpg?.image_url
    const coverPath = coverUrl
      ? await window.ipcRenderer.invoke('image:download', coverUrl, categoryId, 'cover') as string | null
      : null

    const displayTitle = m.title_english || m.title
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

    setApplying(null)
    onApply(patch, coverPath || undefined, undefined)
    onClose()
  }

  const title = useMemo(() => `MyAnimeList · ${kind === 'anime' ? 'Anime' : 'Manga'}`, [kind])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel fetch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Via Jikan (unofficial MAL proxy — no API key needed). Applying overwrites the
            standard fields (title, description, cover, dates, episodes/chapters, studios,
            source, genres, authors, serialization). Rating, notes and personal history
            are left alone.
          </p>
          <div className="fetch-search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search() }}
              placeholder={`Search ${kind}…`}
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
                const t = m.title_english || m.title
                const y = m.year || (m.aired?.from ? new Date(m.aired.from).getFullYear() : m.published?.from ? new Date(m.published.from).getFullYear() : null)
                const sub = [
                  m.type?.toLowerCase(),
                  y,
                  kind === 'anime' ? (m.episodes ? `${m.episodes} eps` : null) : (m.chapters ? `${m.chapters} ch` : null),
                  m.score ? `★ ${m.score.toFixed(1)}` : null,
                ].filter(Boolean).join(' · ')
                const cover = m.images?.jpg?.image_url
                return (
                  <li key={m.mal_id}>
                    <button type="button" className="anilist-hit" onClick={() => apply(m)} disabled={applying !== null}>
                      <div className="anilist-thumb">
                        {cover ? <img src={cover} alt="" loading="lazy" /> : <span>{t.charAt(0)}</span>}
                      </div>
                      <div className="anilist-text">
                        <div className="anilist-title">{t}</div>
                        <div className="anilist-sub">{sub}</div>
                        {m.synopsis && <div className="anilist-desc">{m.synopsis.slice(0, 180)}…</div>}
                      </div>
                      {applying === m.mal_id && <span className="anilist-applying">Applying…</span>}
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

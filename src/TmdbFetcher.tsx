// TMDb (The Movie Database) metadata fetcher — Movies and TV Series.
// Two-step flow: search a title, pick a hit, then fetch full details so we
// can populate the editor with cover, banner, cast, crew, seasons, etc.

import { useEffect, useMemo, useState } from 'react'
import type { Item, Season, SeriesFormat } from './types'

type Kind = 'movie' | 'tv'

interface Props {
  apiKey?: string
  initialQuery: string
  kind: Kind
  categoryId: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
}

// Only the fields we actually consume, typed loosely — TMDb payloads are
// consistent enough that runtime shape-checks aren't worth the ceremony.
interface Hit {
  id: number
  title?: string        // movie
  name?: string         // tv
  original_title?: string
  original_name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
}

interface CrewMember { name: string; job?: string; department?: string }
interface CastMember { name: string }
interface Company    { name: string }
interface Network    { name: string }
interface Genre      { name: string }
interface Country    { iso_3166_1: string; name?: string }
interface Language   { iso_639_1: string; english_name?: string }
interface TmdbSeason { season_number: number; episode_count?: number; air_date?: string; name?: string }
interface Details {
  id: number
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  overview?: string
  tagline?: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  last_air_date?: string
  runtime?: number
  number_of_seasons?: number
  number_of_episodes?: number
  genres?: Genre[]
  production_companies?: Company[]
  production_countries?: Country[]
  spoken_languages?: Language[]
  networks?: Network[]
  origin_country?: string[]
  status?: string
  type?: string             // 'Miniseries' / 'Scripted' / 'Reality' etc.
  seasons?: TmdbSeason[]
  credits?: { cast?: CastMember[]; crew?: CrewMember[] }
  created_by?: { name: string }[]
  alternative_titles?: { titles?: { title: string }[]; results?: { title: string }[] }
}

const IMG_BASE   = 'https://image.tmdb.org/t/p'
const POSTER_URL = (p?: string | null) => (p ? `${IMG_BASE}/w780${p}` : null)
const BACK_URL   = (p?: string | null) => (p ? `${IMG_BASE}/w1280${p}` : null)
const THUMB_URL  = (p?: string | null) => (p ? `${IMG_BASE}/w185${p}` : null)

function jobIs(job: string | undefined, want: string[]): boolean {
  if (!job) return false
  return want.some((w) => job.toLowerCase() === w.toLowerCase())
}

function mapSeriesFormat(d: Details): SeriesFormat | undefined {
  const t = (d.type ?? '').toLowerCase()
  const s = (d.status ?? '').toLowerCase()
  if (t.includes('miniseries') || t.includes('limited')) return 'miniseries'
  if (t.includes('anthology')) return 'anthology'
  if (s.includes('ended') || s.includes('canceled')) return 'ended'
  if (s.includes('returning') || s.includes('production')) return 'ongoing'
  return undefined
}

function detailsToPatch(kind: Kind, d: Details): Partial<Item> {
  const display = kind === 'movie' ? (d.title ?? d.original_title ?? '') : (d.name ?? d.original_name ?? '')
  const genres = d.genres?.map((g) => g.name)

  const rawTitles = kind === 'movie'
    ? [d.title, d.original_title]
    : [d.name, d.original_name]
  const alts = Array.from(new Set(rawTitles.filter(Boolean))).filter((t) => t !== display) as string[]

  const patch: Partial<Item> = {
    title: display,
    alternativeTitles: alts.length ? alts : undefined,
    genres,
    tags: undefined,
  }

  const cast = d.credits?.cast?.slice(0, 15).map((c) => c.name)
  const crew = d.credits?.crew ?? []

  if (kind === 'movie') {
    patch.movieDescription = d.overview || d.tagline || undefined
    patch.releaseDate = d.release_date || undefined
    patch.cast = cast
    patch.directors = crew.filter((c) => jobIs(c.job, ['Director'])).map((c) => c.name)
    patch.writers   = crew.filter((c) => jobIs(c.job, ['Writer', 'Screenplay', 'Story'])).map((c) => c.name)
    patch.productionCompanies = d.production_companies?.map((c) => c.name)
    if (d.runtime) patch.duration = String(d.runtime)   // stored as minutes
  } else {
    patch.seriesDescription = d.overview || d.tagline || undefined
    patch.releaseDate = d.first_air_date || undefined
    patch.cast = cast
    // "Directors" for series is an ambiguous field in TMDb — creators are
    // most useful as showrunners, and directing episodes rotates.
    patch.directors = crew.filter((c) => jobIs(c.job, ['Director'])).slice(0, 5).map((c) => c.name)
    patch.showrunners = d.created_by?.map((c) => c.name) ?? []
    patch.writers = crew.filter((c) => jobIs(c.job, ['Writer', 'Screenplay', 'Story'])).slice(0, 10).map((c) => c.name)
    patch.network = d.networks?.[0]?.name
    patch.country = d.origin_country?.[0] || d.production_countries?.[0]?.iso_3166_1
    patch.language = d.spoken_languages?.[0]?.english_name || d.spoken_languages?.[0]?.iso_639_1
    patch.seriesFormat = mapSeriesFormat(d)
    if (d.seasons && d.seasons.length > 0) {
      patch.hasSeasons = true
      patch.seasons = d.seasons
        // TMDb often includes a "Season 0" for specials — keep it, callers can
        // delete if they don't want it.
        .filter((s) => s.season_number !== undefined)
        .map<Season>((s) => ({
          id: crypto.randomUUID(),
          number: String(s.season_number),
          title: s.name && !/^Season\s+\d+$/i.test(s.name) ? s.name : undefined,
          year: s.air_date ? s.air_date.slice(0, 4) : undefined,
          totalEpisodes: s.episode_count ? String(s.episode_count) : undefined,
        }))
    }
  }

  return patch
}

export default function TmdbFetcher({ apiKey, initialQuery, kind, categoryId, onApply, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [results, setResults] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<number | null>(null)

  const keyLooksSet = useMemo(() => (apiKey ?? '').trim().length >= 20, [apiKey])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const search = async () => {
    if (!keyLooksSet) { setError('No API key configured'); return }
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    const r = await window.ipcRenderer.invoke('tmdb:search', apiKey, query.trim(), kind)
    setLoading(false)
    if (r?.ok) setResults((r.data as Hit[]) ?? [])
    else setError(r?.error ?? 'Search failed')
  }

  useEffect(() => {
    if (keyLooksSet && (initialQuery ?? '').trim()) search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = async (h: Hit) => {
    if (!keyLooksSet) return
    setApplying(h.id)
    const r = await window.ipcRenderer.invoke('tmdb:details', apiKey, kind, h.id)
    if (!r?.ok) { setApplying(null); setError(r?.error ?? 'Failed to load details'); return }
    const d = r.data as Details

    const coverUrl = POSTER_URL(d.poster_path)
    const bannerUrl = BACK_URL(d.backdrop_path)
    const coverPath = coverUrl
      ? await window.ipcRenderer.invoke('image:download', coverUrl, categoryId, 'cover') as string | null
      : null
    const bannerPath = bannerUrl
      ? await window.ipcRenderer.invoke('image:download', bannerUrl, categoryId, 'banner') as string | null
      : null

    const patch = detailsToPatch(kind, d)
    setApplying(null)
    onApply(patch, coverPath || undefined, bannerPath || undefined)
    onClose()
  }

  const title = kind === 'movie' ? 'TMDb · Movies' : 'TMDb · TV Series'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel fetch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {!keyLooksSet && (
            <p className="hint" style={{ color: 'var(--danger)' }}>
              Set your TMDb API key in Settings → Data → Integrations first.
              Register a free one at <code>themoviedb.org/settings/api</code> (takes ~2 minutes).
            </p>
          )}
          <p className="hint" style={{ marginTop: 0 }}>
            Applying overwrites the standard fields (title, description, cover, banner,
            {kind === 'movie'
              ? ' release date, directors, writers, cast, production companies, genres, runtime'
              : ' first-aired date, showrunners, directors, writers, cast, network, country, language, genres, format, seasons'
            }). Rating, notes, watch status and personal history are left alone.
          </p>

          <div className="fetch-search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search() }}
              placeholder={kind === 'movie' ? 'Search movies…' : 'Search TV series…'}
              disabled={!keyLooksSet}
              autoFocus
            />
            <button type="button" className="secondary-btn" onClick={search} disabled={!keyLooksSet || loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}
          {!loading && !error && results.length === 0 && query && keyLooksSet && (
            <p className="hint">No matches. Try a different spelling.</p>
          )}

          {results.length > 0 && (
            <ul className="anilist-results">
              {results.map((h) => {
                const t = h.title || h.name || ''
                const y = (h.release_date || h.first_air_date || '').slice(0, 4)
                const sub = [y, h.vote_average ? `★ ${h.vote_average.toFixed(1)}` : null].filter(Boolean).join(' · ')
                const thumb = THUMB_URL(h.poster_path)
                return (
                  <li key={h.id}>
                    <button type="button" className="anilist-hit" onClick={() => apply(h)} disabled={applying !== null}>
                      <div className="anilist-thumb">
                        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span>{t.charAt(0)}</span>}
                      </div>
                      <div className="anilist-text">
                        <div className="anilist-title">{t}</div>
                        <div className="anilist-sub">{sub}</div>
                        {h.overview && <div className="anilist-desc">{h.overview.slice(0, 180)}…</div>}
                      </div>
                      {applying === h.id && <span className="anilist-applying">Applying…</span>}
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

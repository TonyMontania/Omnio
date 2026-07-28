// TMDb (The Movie Database) metadata fetcher — Movies and TV Series.
// Two-step flow: search a title, pick a hit, then fetch full details so we
// can populate the editor with cover, banner, cast, crew, seasons, etc.

import { useMemo } from 'react'
import type { Item, Season, SeriesFormat } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'
import { assetBasename } from './utils/files'

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
interface Collection { name: string }
interface MovieReleaseDate { certification?: string; type?: number }
interface MovieReleaseCountry { iso_3166_1: string; release_dates?: MovieReleaseDate[] }
interface TvContentRating { iso_3166_1: string; rating?: string }
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
  episode_run_time?: number[]      // tv: minutes per episode, array of samples
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
  belongs_to_collection?: Collection | null
  release_dates?: { results?: MovieReleaseCountry[] }   // movies
  content_ratings?: { results?: TvContentRating[] }     // tv
}

// TMDb reports certifications per country. Prefer US, then GB, then AU,
// then whatever's first. TV series follow the same pattern under content_ratings.
function pickCertification(entries?: { iso_3166_1: string; rating?: string; release_dates?: MovieReleaseDate[] }[]): string | undefined {
  if (!entries || entries.length === 0) return undefined
  const order = ['US', 'GB', 'AU', 'CA']
  const pickFrom = (e: typeof entries[number]) => e.rating || e.release_dates?.find((d) => d.certification)?.certification
  for (const c of order) {
    const hit = entries.find((e) => e.iso_3166_1 === c && pickFrom(e))
    if (hit) return pickFrom(hit)
  }
  for (const e of entries) { const v = pickFrom(e); if (v) return v }
  return undefined
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
    if (d.belongs_to_collection?.name) patch.franchise = d.belongs_to_collection.name
    const cert = pickCertification(d.release_dates?.results)
    if (cert) patch.contentRating = cert
  } else {
    patch.seriesDescription = d.overview || d.tagline || undefined
    patch.releaseDate = d.first_air_date || undefined
    // first_air_date + last_air_date go into the aired-range too so the
    // detail modal shows "2015 → 2019" alongside the release date.
    if (d.first_air_date) patch.airedFrom = d.first_air_date
    if (d.last_air_date) patch.airedTo = d.last_air_date
    // TV series don't have belongs_to_collection, but number_of_episodes
    // gives us the series-level total that number_of_seasons doesn't.
    if (d.number_of_episodes) patch.totalEpisodes = String(d.number_of_episodes)
    if (d.number_of_seasons) patch.unitCount = String(d.number_of_seasons)
    if (d.episode_run_time && d.episode_run_time.length > 0) {
      patch.episodeDuration = String(d.episode_run_time[0])
    }
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
    const cert = pickCertification(d.content_ratings?.results)
    if (cert) patch.contentRating = cert
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
  const keyLooksSet = useMemo(() => (apiKey ?? '').trim().length >= 20, [apiKey])

  const search = async (q: string): Promise<FetcherResult<Hit>> => {
    const r = await window.ipcRenderer.invoke('tmdb:search', apiKey, q, kind)
    return r?.ok ? { ok: true, data: r.data as Hit[] } : { ok: false, error: r?.error ?? 'Search failed' }
  }

  const apply = async (h: Hit) => {
    const r = await window.ipcRenderer.invoke('tmdb:details', apiKey, kind, h.id)
    if (!r?.ok) return
    const d = r.data as Details

    const title = (d as { title?: string; name?: string }).title || (d as { name?: string }).name || h.title || h.name || ''
    const coverUrl = POSTER_URL(d.poster_path)
    const bannerUrl = BACK_URL(d.backdrop_path)
    const coverPath = coverUrl
      ? await window.ipcRenderer.invoke('image:download', coverUrl, categoryId, 'cover', assetBasename(title, 'cover')) as string | null
      : null
    const bannerPath = bannerUrl
      ? await window.ipcRenderer.invoke('image:download', bannerUrl, categoryId, 'banner', assetBasename(title, 'banner')) as string | null
      : null

    onApply(detailsToPatch(kind, d), coverPath || undefined, bannerPath || undefined)
    onClose()
  }

  return (
    <FetcherModal<Hit>
      title={kind === 'movie' ? 'TMDb · Movies' : 'TMDb · TV Series'}
      disabled={!keyLooksSet}
      disabledMessage={
        <>Set your TMDb API key in Settings → Data → Integrations first.
        Register a free one at <code>themoviedb.org/settings/api</code> (takes ~2 minutes).</>
      }
      hint={
        <>Applying overwrites the standard fields (title, description, cover, banner,
        {kind === 'movie'
          ? ' release date, directors, writers, cast, production companies, genres, runtime, franchise, content rating (MPAA)'
          : ' first-aired date, aired range, showrunners, directors, writers, cast, network, country, language, genres, format, seasons, total episodes, content rating (TV-MA…)'
        }). Rating, notes, watch status and personal history are left alone.</>
      }
      placeholder={kind === 'movie' ? 'Search movies…' : 'Search TV series…'}
      initialQuery={initialQuery}
      onSearch={search}
      onApply={apply}
      onClose={onClose}
      renderHit={(h) => {
        const t = h.title || h.name || ''
        const y = (h.release_date || h.first_air_date || '').slice(0, 4)
        const sub = [y, h.vote_average ? `★ ${h.vote_average.toFixed(1)}` : null].filter(Boolean).join(' · ')
        return {
          key: h.id,
          title: t,
          sub,
          thumbUrl: THUMB_URL(h.poster_path) ?? undefined,
          desc: h.overview,
        }
      }}
    />
  )
}

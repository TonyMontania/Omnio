// Kitsu metadata fetcher — free, no-key anime + manga backup source for
// when AniList / MAL / MangaDex miss a title. JSON:API shape, so the
// data lives under `attributes` and everything is flat strings we can
// map straight into Omnio fields.

import { useEffect, useMemo, useState } from 'react'
import type { Item, AnimeFormat, AnimeSeason, AiringStatus } from './types'

type Kind = 'anime' | 'manga'

interface Props {
  initialQuery: string
  kind: Kind
  categoryId: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
}

interface KitsuImage {
  tiny?: string
  small?: string
  medium?: string
  large?: string
  original?: string
}

interface KitsuAttrs {
  canonicalTitle?: string
  titles?: Record<string, string | null>
  abbreviatedTitles?: string[] | null
  synopsis?: string
  description?: string
  startDate?: string | null
  endDate?: string | null
  posterImage?: KitsuImage | null
  coverImage?: KitsuImage | null           // banner-shaped
  ageRating?: string | null                // 'G' | 'PG' | 'R' | 'R18'
  averageRating?: string | null
  status?: string                          // 'finished' | 'current' | 'tba' | ...
  // anime-only
  episodeCount?: number | null
  episodeLength?: number | null
  showType?: string                        // 'TV' | 'movie' | 'OVA' | ...
  // manga-only
  chapterCount?: number | null
  volumeCount?: number | null
  mangaType?: string                       // 'manga' | 'novel' | 'manhwa' | 'manhua' | ...
}

interface KitsuHit {
  id: string
  type: Kind
  attributes: KitsuAttrs
}

const ANIME_FORMAT_MAP: Record<string, AnimeFormat> = {
  TV: 'tv', movie: 'movie', OVA: 'ova', ONA: 'ona', special: 'special', music: 'music',
}
const AIRING_STATUS_MAP: Record<string, AiringStatus> = {
  current: 'airing', finished: 'finished', tba: 'not_yet_aired',
  unreleased: 'not_yet_aired', upcoming: 'not_yet_aired',
}

function seasonOfMonth(month: number): AnimeSeason | undefined {
  if (month >= 1 && month <= 3) return 'winter'
  if (month >= 4 && month <= 6) return 'spring'
  if (month >= 7 && month <= 9) return 'summer'
  if (month >= 10 && month <= 12) return 'fall'
  return undefined
}

function pickTitle(a: KitsuAttrs): string {
  if (a.canonicalTitle) return a.canonicalTitle
  const t = a.titles
  if (!t) return ''
  return t.en || t.en_jp || t.ja_jp || Object.values(t).find(Boolean) || ''
}

function collectAlts(a: KitsuAttrs, primary: string): string[] {
  const set = new Set<string>()
  if (a.titles) for (const v of Object.values(a.titles)) if (v && v !== primary) set.add(v)
  for (const alt of a.abbreviatedTitles ?? []) if (alt && alt !== primary) set.add(alt)
  return Array.from(set)
}

function hitToPatch(kind: Kind, h: KitsuHit): Partial<Item> {
  const a = h.attributes
  const title = pickTitle(a)
  const alts = collectAlts(a, title)
  const description = a.synopsis || a.description
  const startDate = a.startDate || undefined
  const patch: Partial<Item> = {
    title,
    alternativeTitles: alts.length ? alts : undefined,
    releaseDate: startDate,
    airedFrom: startDate,
    airedTo: a.endDate || undefined,
  }
  if (startDate) {
    const [y, m] = startDate.split('-')
    if (y) patch.seasonYear = y
    if (m) patch.season = seasonOfMonth(parseInt(m, 10))
  }
  if (kind === 'anime') {
    patch.animeDescription = description
    patch.animeFormat = a.showType ? ANIME_FORMAT_MAP[a.showType] : undefined
    patch.airingStatus = a.status ? AIRING_STATUS_MAP[a.status] : undefined
    patch.totalEpisodes = a.episodeCount ? String(a.episodeCount) : undefined
    patch.episodeDuration = a.episodeLength ? String(a.episodeLength) : undefined
  } else {
    patch.mangaDescription = description
    patch.totalChapters = a.chapterCount ? String(a.chapterCount) : undefined
    patch.totalVolumes = a.volumeCount ? String(a.volumeCount) : undefined
    // mangaType hints at manga vs manhwa vs manhua vs novel; only mark
    // it if Kitsu is confident. Otherwise leave source unset.
    if (a.mangaType === 'manhwa' || a.mangaType === 'manhua') {
      // sourceMap doesn't cover Korean/Chinese origins directly; leave undefined
    }
  }
  return patch
}

export default function KitsuFetcher({ initialQuery, kind, categoryId, onApply, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [results, setResults] = useState<KitsuHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    const r = await window.ipcRenderer.invoke('kitsu:search', query.trim(), kind)
    setLoading(false)
    if (r?.ok) setResults((r.data as KitsuHit[]) ?? [])
    else setError(r?.error ?? 'Search failed')
  }

  useEffect(() => {
    if ((initialQuery ?? '').trim()) search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = async (h: KitsuHit) => {
    setApplying(h.id)
    const a = h.attributes
    const coverUrl = a.posterImage?.large || a.posterImage?.medium || a.posterImage?.small
    const bannerUrl = a.coverImage?.large || a.coverImage?.original
    const coverPath = coverUrl
      ? await window.ipcRenderer.invoke('image:download', coverUrl, categoryId, 'cover') as string | null
      : null
    const bannerPath = bannerUrl
      ? await window.ipcRenderer.invoke('image:download', bannerUrl, categoryId, 'banner') as string | null
      : null

    const patch = hitToPatch(kind, h)
    setApplying(null)
    onApply(patch, coverPath || undefined, bannerPath || undefined)
    onClose()
  }

  const title = useMemo(() => kind === 'anime' ? 'Kitsu · Anime' : 'Kitsu · Manga', [kind])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel fetch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Free, no API key. Best used as a fallback when AniList / MAL
            {kind === 'manga' ? ' / MangaDex' : ''} miss a title. Applying overwrites
            title, alt titles, description, cover, banner, dates, {kind === 'anime'
              ? 'format, airing status, total episodes and episode duration'
              : 'total chapters and volumes'}. Rating, notes, watch/read status and
            personal history are left alone.
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
            <p className="hint">No matches.</p>
          )}

          {results.length > 0 && (
            <ul className="anilist-results">
              {results.map((h) => {
                const a = h.attributes
                const t = pickTitle(a)
                const y = (a.startDate ?? '').slice(0, 4)
                const sub = [
                  a.showType || a.mangaType || null,
                  y,
                  kind === 'anime'
                    ? (a.episodeCount ? `${a.episodeCount} eps` : null)
                    : (a.chapterCount ? `${a.chapterCount} ch` : null),
                  a.averageRating ? `★ ${(parseFloat(a.averageRating) / 10).toFixed(1)}` : null,
                ].filter(Boolean).join(' · ')
                const thumb = a.posterImage?.small || a.posterImage?.tiny
                return (
                  <li key={h.id}>
                    <button type="button" className="anilist-hit" onClick={() => apply(h)} disabled={applying !== null}>
                      <div className="anilist-thumb">
                        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span>{t.charAt(0) || '?'}</span>}
                      </div>
                      <div className="anilist-text">
                        <div className="anilist-title">{t}</div>
                        <div className="anilist-sub">{sub}</div>
                        {(a.synopsis || a.description) && (
                          <div className="anilist-desc">{(a.synopsis || a.description)!.slice(0, 180)}…</div>
                        )}
                      </div>
                      {applying === h.id && <span className="anilist-applying">Fetching…</span>}
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

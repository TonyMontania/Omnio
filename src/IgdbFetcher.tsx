// IGDB (Twitch) metadata fetcher for Games. One-step: search returns
// full metadata including cover, first artwork/screenshot (as banner),
// involved companies split into developers vs publishers, platforms,
// genres, franchises, release date and average rating.

import { useEffect, useMemo, useState } from 'react'
import type { Item, AgeRating } from './types'

interface Props {
  clientId?: string
  clientSecret?: string
  initialQuery: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
}

interface Company { name: string }
interface InvolvedCompany { company?: Company; developer?: boolean; publisher?: boolean }
interface Named { name: string }
interface ImageRef { image_id: string }
interface AltName { name: string; comment?: string }
// IGDB API v4 originally returned age_ratings as { category:number, rating:number }.
// Recent revisions also expose { rating_category:number|string, rating:number|string }
// and a synonym key `organization`. We accept every shape and normalize below.
interface AgeRatingRef {
  category?: number | string
  rating?: number | string
  rating_category?: number | string
  rating_content_descriptions?: unknown[]
  organization?: number | string
  synopsis?: string
  checksum?: string
}
interface Game {
  id: number
  name: string
  summary?: string
  storyline?: string
  first_release_date?: number   // unix seconds
  cover?: ImageRef
  artworks?: ImageRef[]
  screenshots?: ImageRef[]
  involved_companies?: InvolvedCompany[]
  platforms?: Named[]
  genres?: Named[]
  franchises?: Named[]
  collection?: Named
  alternative_names?: AltName[]
  age_ratings?: AgeRatingRef[]
  game_modes?: Named[]
  themes?: Named[]
  total_rating?: number
}

// IGDB has two coexisting encodings for age_ratings:
//   Legacy: category enum (1=ESRB, 2=PEGI…) + rating enum (8=E, 9=E10+…)
//   Newer:  category and rating are strings ("ESRB", "M") OR nested inside
//           rating_category with a numeric or string identifier.
// We normalize every combination into our AgeRating union.
const ESRB_NUM: Record<number, AgeRating> = {
  6: 'rp', 7: 'e', 8: 'e', 9: 'e10', 10: 't', 11: 'm', 12: 'ao',
}
const PEGI_NUM: Record<number, AgeRating> = {
  1: 'e', 2: 'e10', 3: 't', 4: 't', 5: 'm',
}
const ESRB_STR: Record<string, AgeRating> = {
  'rp': 'rp', 'ec': 'e', 'e': 'e', 'e10': 'e10', 'e10+': 'e10',
  't': 't', 'm': 'm', 'ao': 'ao',
}
const PEGI_STR: Record<string, AgeRating> = {
  'pegi 3': 'e', 'pegi 7': 'e10', 'pegi 12': 't', 'pegi 16': 't', 'pegi 18': 'm',
  '3': 'e', '7': 'e10', '12': 't', '16': 't', '18': 'm',
}
function categoryOf(r: AgeRatingRef): number | string | undefined {
  return r.category ?? r.rating_category ?? r.organization
}
function isESRB(cat: number | string | undefined): boolean {
  return cat === 1 || (typeof cat === 'string' && cat.toLowerCase().includes('esrb'))
}
function isPEGI(cat: number | string | undefined): boolean {
  return cat === 2 || (typeof cat === 'string' && cat.toLowerCase().includes('pegi'))
}
function mapESRB(rating: number | string | undefined): AgeRating | undefined {
  if (typeof rating === 'number') return ESRB_NUM[rating]
  if (typeof rating === 'string') return ESRB_STR[rating.toLowerCase().trim().replace(/^esrb[\s:]*/i, '')]
  return undefined
}
function mapPEGI(rating: number | string | undefined): AgeRating | undefined {
  if (typeof rating === 'number') return PEGI_NUM[rating]
  if (typeof rating === 'string') return PEGI_STR[rating.toLowerCase().trim().replace(/^pegi[\s:]*/i, 'pegi ')]
  return undefined
}
function pickAgeRating(refs?: AgeRatingRef[]): AgeRating | undefined {
  if (!refs || refs.length === 0) return undefined
  for (const r of refs) {
    if (isESRB(categoryOf(r))) {
      const m = mapESRB(r.rating)
      if (m) return m
    }
  }
  for (const r of refs) {
    if (isPEGI(categoryOf(r))) {
      const m = mapPEGI(r.rating)
      if (m) return m
    }
  }
  return undefined
}

// IGDB image sizes: t_cover_big (264x374), t_720p, t_1080p, t_original,
// t_screenshot_huge, t_screenshot_big. Cover uses t_cover_big; the banner
// picks the first artwork or screenshot at t_1080p.
const IMG = (imageId: string, size: string) =>
  `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`

function isoDateFromUnix(sec?: number): string | undefined {
  if (!sec) return undefined
  return new Date(sec * 1000).toISOString().slice(0, 10)
}

function gameToPatch(g: Game): Partial<Item> {
  const inv = g.involved_companies ?? []
  const devs = inv.filter((c) => c.developer && c.company?.name).map((c) => c.company!.name)
  const pubs = inv.filter((c) => c.publisher && c.company?.name).map((c) => c.company!.name)
  // Combine summary + storyline so long-form background isn't lost when IGDB
  // splits them (Yakuza-style games often have their real plot in storyline).
  const description = [g.summary, g.storyline].filter(Boolean).join('\n\n') || undefined
  // Alternative names include regional titles, subtitles and internal codenames.
  // Dedup by lowercased name and skip the main title so it isn't listed twice.
  const altSet = new Set<string>()
  for (const n of g.alternative_names ?? []) {
    if (!n?.name) continue
    if (n.name.toLowerCase() === g.name.toLowerCase()) continue
    altSet.add(n.name)
  }
  // Genres + themes both feed the app's genre tags — themes carry things
  // like "Open world" or "Stealth" that aren't in the tighter genre list.
  const genresPlusThemes = [
    ...(g.genres ?? []).map((x) => x.name),
    ...(g.themes ?? []).map((x) => x.name),
  ].filter(Boolean)
  return {
    title: g.name,
    description,
    releaseDate: isoDateFromUnix(g.first_release_date),
    devs: devs.length ? Array.from(new Set(devs)) : undefined,
    publishers: pubs.length ? Array.from(new Set(pubs)) : undefined,
    platforms: g.platforms?.map((p) => p.name),
    genres: genresPlusThemes.length ? Array.from(new Set(genresPlusThemes)) : undefined,
    franchise: g.franchises?.[0]?.name || g.collection?.name,
    alternativeTitles: altSet.size > 0 ? Array.from(altSet) : undefined,
    ageRating: pickAgeRating(g.age_ratings),
  }
}

export default function IgdbFetcher({ clientId, clientSecret, initialQuery, onApply, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [results, setResults] = useState<Game[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<number | null>(null)

  const authReady = useMemo(
    () => (clientId ?? '').trim().length > 8 && (clientSecret ?? '').trim().length > 8,
    [clientId, clientSecret],
  )

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const search = async () => {
    if (!authReady) { setError('Set Client ID + Secret in Settings first'); return }
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    const r = await window.ipcRenderer.invoke('igdb:search', clientId, clientSecret, query.trim())
    setLoading(false)
    if (r?.ok) setResults((r.data as Game[]) ?? [])
    else setError(r?.error ?? 'Search failed')
  }

  useEffect(() => {
    if (authReady && (initialQuery ?? '').trim()) search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = async (g: Game) => {
    setApplying(g.id)
    const coverUrl = g.cover?.image_id ? IMG(g.cover.image_id, 't_cover_big') : null
    const bannerId = g.artworks?.[0]?.image_id ?? g.screenshots?.[0]?.image_id
    const bannerUrl = bannerId ? IMG(bannerId, 't_1080p') : null

    const coverPath = coverUrl
      ? await window.ipcRenderer.invoke('image:download', coverUrl, 'videojuegos', 'cover') as string | null
      : null
    const bannerPath = bannerUrl
      ? await window.ipcRenderer.invoke('image:download', bannerUrl, 'videojuegos', 'banner') as string | null
      : null

    // Dev-tools breadcrumb: if the age rating still doesn't apply for some
    // titles, open DevTools (Ctrl+Shift+I) and look at this object — IGDB
    // occasionally ships shapes not covered by the maps in pickAgeRating.
    if (g.age_ratings && g.age_ratings.length > 0) {
      // eslint-disable-next-line no-console
      console.debug('[IGDB] age_ratings raw:', g.age_ratings)
    }
    const patch = gameToPatch(g)
    setApplying(null)
    onApply(patch, coverPath || undefined, bannerPath || undefined)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel fetch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>IGDB · Games</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {!authReady && (
            <p className="hint" style={{ color: 'var(--danger)' }}>
              Set your IGDB Client ID + Client Secret in Settings → Data → Integrations first.
              Get them free at <code>dev.twitch.tv/console/apps</code> (create an app, category "Application Integration",
              redirect URL <code>http://localhost</code>).
            </p>
          )}
          <p className="hint" style={{ marginTop: 0 }}>
            Applying overwrites title, alternative titles, description (summary + storyline),
            cover, banner (first artwork or screenshot), release date, developers, publishers,
            platforms, genres + themes, franchise/series and age rating (ESRB, falls back to
            PEGI). Rating, time played, achievements, notes and status are left alone.
          </p>

          <div className="fetch-search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search() }}
              placeholder="Search a game…"
              disabled={!authReady}
              autoFocus
            />
            <button type="button" className="secondary-btn" onClick={search} disabled={!authReady || loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}
          {!loading && !error && results.length === 0 && query && authReady && (
            <p className="hint">No matches. Try a different spelling.</p>
          )}

          {results.length > 0 && (
            <ul className="anilist-results">
              {results.map((g) => {
                const y = g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null
                const inv = g.involved_companies ?? []
                const devs = inv.filter((c) => c.developer && c.company?.name).map((c) => c.company!.name).slice(0, 2)
                const sub = [
                  y,
                  devs.join(' · ') || null,
                  g.total_rating ? `★ ${(g.total_rating / 10).toFixed(1)}` : null,
                ].filter(Boolean).join(' · ')
                const thumb = g.cover?.image_id ? IMG(g.cover.image_id, 't_cover_small') : null
                return (
                  <li key={g.id}>
                    <button type="button" className="anilist-hit" onClick={() => apply(g)} disabled={applying !== null}>
                      <div className="anilist-thumb">
                        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span>{g.name.charAt(0)}</span>}
                      </div>
                      <div className="anilist-text">
                        <div className="anilist-title">{g.name}</div>
                        <div className="anilist-sub">{sub}</div>
                        {g.summary && <div className="anilist-desc">{g.summary.slice(0, 180)}…</div>}
                      </div>
                      {applying === g.id && <span className="anilist-applying">Applying…</span>}
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

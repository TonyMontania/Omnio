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
interface AgeRatingRef { rating: number; category: number }
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

// IGDB age_ratings.category: 1=ESRB, 2=PEGI, 3=CERO, 4=USK, 5=GRAC, 6=CLASS_IND, 7=ACB
// ESRB rating codes → our AgeRating union.
const ESRB_MAP: Record<number, AgeRating> = {
  6: 'rp',   // RP
  7: 'e',    // EC → E (Early Childhood merged into E)
  8: 'e',    // E
  9: 'e10',  // E10+
  10: 't',   // T
  11: 'm',   // M
  12: 'ao',  // AO
}
// PEGI codes as a fallback so European entries still fill something.
const PEGI_MAP: Record<number, AgeRating> = {
  1: 'e',    // PEGI 3
  2: 'e10',  // PEGI 7
  3: 't',    // PEGI 12
  4: 't',    // PEGI 16
  5: 'm',    // PEGI 18
}
function pickAgeRating(refs?: AgeRatingRef[]): AgeRating | undefined {
  if (!refs || refs.length === 0) return undefined
  const esrb = refs.find((r) => r.category === 1)
  if (esrb) { const m = ESRB_MAP[esrb.rating]; if (m) return m }
  const pegi = refs.find((r) => r.category === 2)
  if (pegi) return PEGI_MAP[pegi.rating]
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

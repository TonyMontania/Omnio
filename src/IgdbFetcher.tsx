// IGDB (Twitch) metadata fetcher for Games. One-step: search returns
// full metadata including cover, first artwork/screenshot (as banner),
// involved companies split into developers vs publishers, platforms,
// genres, franchises, release date and average rating.

import { useMemo } from 'react'
import type { Item, AgeRating, GameSource } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'

interface Props {
  clientId?: string
  clientSecret?: string
  initialQuery: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string, hints?: { parentGameTitle?: string }) => void
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
  category?: number             // 0=main, 1=DLC, 8=remake, 9=remaster, 11=port...
  parent_game?: { id: number; name: string }
  total_rating?: number
  total_rating_count?: number   // popularity proxy — used to rank picker hits
}

// IGDB category enum → Omnio's GameSource union. Undocumented codes fall
// through to leave the field unset instead of guessing.
const CATEGORY_TO_SOURCE: Record<number, GameSource> = {
  0: 'original',    // main_game
  2: 'expanded',    // expansion
  3: 'collection',  // bundle
  4: 'standalone',  // standalone_expansion
  8: 'remake',      // remake
  9: 'remaster',    // remaster
  10: 'expanded',   // expanded_game
  11: 'port',       // port
  13: 'collection', // pack
}

// Fallback: IGDB frequently mislabels Remake/Remaster as category:0 (main),
// so infer from the title if the category didn't give us a definite answer.
function inferSourceFromTitle(title: string): GameSource | undefined {
  const t = title.toLowerCase()
  if (/\bremake\b/.test(t)) return 'remake'
  if (/\bremaster(ed)?\b/.test(t)) return 'remaster'
  if (/\breimagined\b/.test(t)) return 'reimagined'
  if (/\breboot\b/.test(t)) return 'reboot'
  if (/\bdefinitive edition\b|\bcomplete edition\b|\bgoty edition\b|\bgame of the year edition\b|\bultimate edition\b/.test(t)) return 'expanded'
  if (/\bhd collection\b|\btrilogy\b|\banthology\b|\bcollection\b|\bmasterpiece collection\b|\bmaster collection\b/.test(t)) return 'collection'
  if (/\bport\b/.test(t)) return 'port'
  return undefined
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
  const description = [g.summary, g.storyline].filter(Boolean).join('\n\n') || undefined
  const altSet = new Set<string>()
  for (const n of g.alternative_names ?? []) {
    if (!n?.name) continue
    if (n.name.toLowerCase() === g.name.toLowerCase()) continue
    altSet.add(n.name)
  }
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
    gameSource: (g.category !== undefined ? CATEGORY_TO_SOURCE[g.category] : undefined) ?? inferSourceFromTitle(g.name),
  }
}

export default function IgdbFetcher({ clientId, clientSecret, initialQuery, onApply, onClose }: Props) {
  const authReady = useMemo(
    () => (clientId ?? '').trim().length > 8 && (clientSecret ?? '').trim().length > 8,
    [clientId, clientSecret],
  )

  const search = async (q: string): Promise<FetcherResult<Game>> => {
    const r = await window.ipcRenderer.invoke('igdb:search', clientId, clientSecret, q)
    if (!r?.ok) return { ok: false, error: r?.error ?? 'Search failed' }
    // IGDB search returns hits ordered by name-match relevance, which for a
    // popular title puts DLC / bundle / region-variant entries above the
    // main entry. Re-sort by IGDB's total_rating_count (popularity proxy)
    // so the entry with the most metadata (devs, cover, etc.) surfaces
    // first — that's usually the main game, which is what the user wants.
    const games = (r.data as Game[]).slice().sort((a, b) => (b.total_rating_count ?? 0) - (a.total_rating_count ?? 0))
    return { ok: true, data: games }
  }

  const apply = async (g: Game) => {
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
    onApply(
      gameToPatch(g),
      coverPath || undefined,
      bannerPath || undefined,
      g.parent_game?.name ? { parentGameTitle: g.parent_game.name } : undefined,
    )
    onClose()
  }

  return (
    <FetcherModal<Game>
      title="IGDB · Games"
      disabled={!authReady}
      disabledMessage={
        <>Set your IGDB Client ID + Client Secret in Settings → Data → Integrations first.
        Get them free at <code>dev.twitch.tv/console/apps</code> (create an app, category "Application Integration",
        redirect URL <code>http://localhost</code>).</>
      }
      hint={
        <>Applying overwrites title, alternative titles, description (summary + storyline),
        cover, banner (first artwork or screenshot), release date, developers, publishers,
        platforms, genres + themes, franchise/series and age rating (ESRB, falls back to
        PEGI). Rating, time played, achievements, notes and status are left alone.</>
      }
      placeholder="Search a game…"
      initialQuery={initialQuery}
      onSearch={search}
      onApply={apply}
      onClose={onClose}
      renderHit={(g) => {
        const y = g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null
        const inv = g.involved_companies ?? []
        const devs = inv.filter((c) => c.developer && c.company?.name).map((c) => c.company!.name).slice(0, 2)
        const sub = [
          y,
          devs.join(' · ') || null,
          g.total_rating ? `★ ${(g.total_rating / 10).toFixed(1)}` : null,
        ].filter(Boolean).join(' · ')
        return {
          key: g.id,
          title: g.name,
          sub,
          thumbUrl: g.cover?.image_id ? IMG(g.cover.image_id, 't_cover_small') : undefined,
          desc: g.summary,
        }
      }}
    />
  )
}

// IGDB (Twitch) fetcher for Games. Single search returns full metadata,
// cover, first artwork/screenshot as banner, dev+pub splits, platforms,
// genres, franchises, release date and rating.

import { useMemo } from 'react'
import type { Item, AgeRating, GameSource } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'
import { assetBasename, downloadImageAsset } from './utils/files'

interface Props {
  clientId?: string
  clientSecret?: string
  initialQuery: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string, hints?: { parentGameTitle?: string; suggestedTags?: string[] }) => void
  onClose: () => void
}

interface Company { name: string }
interface InvolvedCompany { company?: Company; developer?: boolean; publisher?: boolean }
interface Named { name: string }
interface ImageRef { image_id: string }
interface AltName { name: string; comment?: string }
// Accepts both legacy `{category, rating}` and post-2024
// `{organization, rating_category}` IGDB shapes.
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
  player_perspectives?: Named[]
  keywords?: Named[]
  category?: number
  parent_game?: { id: number; name: string }
  total_rating?: number
  total_rating_count?: number
}

// IGDB `category` code → Omnio GameSource. Undocumented codes leave
// the field unset rather than guessing.
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

// IGDB frequently mislabels Remake/Remaster as category=0; catch those
// via the title as a fallback.
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

// Legacy schema. `category` was the org enum (1=ESRB, 2=PEGI…) and
// `rating` was the per-org value (ESRB range 6–12, PEGI 1–5).
const ESRB_NUM_LEGACY: Record<number, AgeRating> = {
  6: 'rp', 7: 'e', 8: 'e', 9: 'e10', 10: 't', 11: 'm', 12: 'ao',
}
const PEGI_NUM_LEGACY: Record<number, AgeRating> = {
  1: 'e', 2: 'e10', 3: 't', 4: 't', 5: 'm',
}
// Post-2024 schema. `rating_category` is a global ID; ESRB occupies
// 1–7 and PEGI 8–12 based on live API responses.
const ESRB_RATING_CATEGORY: Record<number, AgeRating> = {
  1: 'rp', 2: 'e', 3: 'e', 4: 'e10', 5: 't', 6: 'm', 7: 'ao',
}
const PEGI_RATING_CATEGORY: Record<number, AgeRating> = {
  8: 'e', 9: 'e10', 10: 't', 11: 't', 12: 'm',
}
const ESRB_STR: Record<string, AgeRating> = {
  'rp': 'rp', 'ec': 'e', 'e': 'e', 'e10': 'e10', 'e10+': 'e10',
  't': 't', 'm': 'm', 'ao': 'ao',
}
const PEGI_STR: Record<string, AgeRating> = {
  'pegi 3': 'e', 'pegi 7': 'e10', 'pegi 12': 't', 'pegi 16': 't', 'pegi 18': 'm',
  '3': 'e', '7': 'e10', '12': 't', '16': 't', '18': 'm',
}
function orgOf(r: AgeRatingRef): number | string | undefined {
  return r.organization ?? r.category
}
function isESRB(v: number | string | undefined): boolean {
  return v === 1 || (typeof v === 'string' && v.toLowerCase().includes('esrb'))
}
function isPEGI(v: number | string | undefined): boolean {
  return v === 2 || (typeof v === 'string' && v.toLowerCase().includes('pegi'))
}
function pickAgeRating(refs?: AgeRatingRef[]): AgeRating | undefined {
  if (!refs || refs.length === 0) return undefined
  // Prefer ESRB, fall through to PEGI.
  for (const r of refs) {
    if (!isESRB(orgOf(r))) continue
    if (typeof r.rating_category === 'number') {
      const m = ESRB_RATING_CATEGORY[r.rating_category]
      if (m) return m
    }
    if (typeof r.rating === 'number') {
      const m = ESRB_NUM_LEGACY[r.rating]
      if (m) return m
    }
    if (typeof r.rating === 'string') {
      const m = ESRB_STR[r.rating.toLowerCase().trim().replace(/^esrb[\s:]*/i, '')]
      if (m) return m
    }
  }
  for (const r of refs) {
    if (!isPEGI(orgOf(r))) continue
    if (typeof r.rating_category === 'number') {
      const m = PEGI_RATING_CATEGORY[r.rating_category]
      if (m) return m
    }
    if (typeof r.rating === 'number') {
      const m = PEGI_NUM_LEGACY[r.rating]
      if (m) return m
    }
    if (typeof r.rating === 'string') {
      const m = PEGI_STR[r.rating.toLowerCase().trim().replace(/^pegi[\s:]*/i, 'pegi ')]
      if (m) return m
    }
  }
  return undefined
}

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
    // Re-sort by rating count so the main game surfaces above DLCs /
    // bundles / region variants that IGDB's own relevance mixes in.
    const games = (r.data as Game[]).slice().sort((a, b) => (b.total_rating_count ?? 0) - (a.total_rating_count ?? 0))
    return { ok: true, data: games }
  }

  const apply = async (g: Game) => {
    const coverUrl = g.cover?.image_id ? IMG(g.cover.image_id, 't_cover_big') : null
    const bannerId = g.artworks?.[0]?.image_id ?? g.screenshots?.[0]?.image_id
    const bannerUrl = bannerId ? IMG(bannerId, 't_1080p') : null

    const coverPath = coverUrl
      ? await downloadImageAsset( coverUrl, 'videojuegos', 'cover', assetBasename(g.name, 'cover')) as string | null
      : null
    const bannerPath = bannerUrl
      ? await downloadImageAsset( bannerUrl, 'videojuegos', 'banner', assetBasename(g.name, 'banner')) as string | null
      : null

    console.log('[IGDB] game:', g.name, '| age_ratings:', g.age_ratings, '| category:', g.category, '| parent_game:', g.parent_game)
    // `themes` is excluded — it already goes into `genres`, adding it
    // here would show the same values twice in the tag suggestion panel.
    const tagPool = [
      ...(g.player_perspectives ?? []).map((x) => x.name),
      ...(g.game_modes ?? []).map((x) => x.name),
      ...(g.keywords ?? []).map((x) => x.name).slice(0, 8),
    ].filter(Boolean)
    onApply(
      gameToPatch(g),
      coverPath || undefined,
      bannerPath || undefined,
      {
        ...(g.parent_game?.name ? { parentGameTitle: g.parent_game.name } : {}),
        ...(tagPool.length > 0 ? { suggestedTags: Array.from(new Set(tagPool)) } : {}),
      },
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

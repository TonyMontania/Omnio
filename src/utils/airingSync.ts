import type { AnyItem } from '../types'
import { isCurrentlyAiring } from './airing'
import { AIRING_STATUS_MAP, matchAniListMedia, weekdayOfTimestamp, type AniListMedia } from './anilist'

const HOUR = 60 * 60 * 1000
export const AIRING_REFRESH_MS = 6 * HOUR
export const LOOKUP_RETRY_MS = 7 * 24 * HOUR
// AniList allows ~30 requests a minute right now; title lookups stay well under.
const LOOKUP_GAP_MS = 2500

type Envelope<T> = { ok: true; data: T } | { ok: false; error: string }
export interface AiringApi {
  search: (title: string) => Promise<Envelope<AniListMedia[]>>
  airing: (ids: number[]) => Promise<Envelope<AniListMedia[]>>
  sleep: (ms: number) => Promise<void>
}

export interface ItemPatch { id: string; patch: Partial<AnyItem> }

const ANIME_LIKE = new Set(['anime', 'donghua'])

export function tracksAiring(item: AnyItem, now = new Date()): boolean {
  if (!ANIME_LIKE.has(item.categoryId) || item.watchStatus === 'dropped') return false
  return isCurrentlyAiring(item, now) || item.airingStatus === 'not_yet_aired' || !!item.nextAiring
}

function isStale(item: AnyItem, now: number): boolean {
  const next = item.nextAiring
  if (!next) return true
  const airedAt = next.airingAt * 1000 + (next.dateOnly ? 24 * HOUR : 0)
  return now - next.checkedAt > AIRING_REFRESH_MS || airedAt <= now
}

export function airingPatchFor(item: AnyItem, media: AniListMedia, now: number): Partial<AnyItem> {
  const patch: Partial<AnyItem> = {}
  const status = media.status ? AIRING_STATUS_MAP[media.status] : undefined
  if (status && status !== item.airingStatus) patch.airingStatus = status
  const next = media.nextAiringEpisode
  if (next) {
    patch.nextAiring = { episode: next.episode, airingAt: next.airingAt, checkedAt: now }
    if (!item.airingDay) patch.airingDay = weekdayOfTimestamp(next.airingAt)
  } else if (item.nextAiring) {
    patch.nextAiring = undefined
  }
  return patch
}

// Links unresolved shows to AniList by title (a few per run), then
// refreshes the next episode of every linked show that is out of date.
export async function syncAiring(items: AnyItem[], api: AiringApi, opts: { now?: number; maxLookups?: number } = {}): Promise<ItemPatch[]> {
  const now = opts.now ?? Date.now()
  const maxLookups = opts.maxLookups ?? 8
  const tracked = items.filter((i) => tracksAiring(i, new Date(now)))
  const patches = new Map<string, Partial<AnyItem>>()
  const ids = new Map<string, number>()

  let lookups = 0
  for (const item of tracked) {
    if (item.anilistId) { ids.set(item.id, item.anilistId); continue }
    if (item.anilistCheckedAt && now - item.anilistCheckedAt < LOOKUP_RETRY_MS) continue
    if (lookups >= maxLookups) break
    if (lookups > 0) await api.sleep(LOOKUP_GAP_MS)
    lookups++
    const r = await api.search(item.title)
    if (!r.ok) break
    const match = matchAniListMedia(r.data, [item.title, ...(item.alternativeTitles ?? [])])
    patches.set(item.id, { anilistId: match?.id ?? 0, anilistCheckedAt: now })
    if (match) ids.set(item.id, match.id)
  }

  const due = tracked.filter((i) => ids.has(i.id) && (isStale(i, now) || !i.anilistId))
  if (due.length > 0) {
    const r = await api.airing(Array.from(new Set(due.map((i) => ids.get(i.id)!))))
    if (r.ok) {
      const byId = new Map(r.data.map((m) => [m.id, m]))
      for (const item of due) {
        const media = byId.get(ids.get(item.id)!)
        if (!media) continue
        patches.set(item.id, { ...patches.get(item.id), ...airingPatchFor(item, media, now) })
      }
    }
  }

  return Array.from(patches, ([id, patch]) => ({ id, patch }))
}

// ---- Series via TMDb ----

export interface TmdbShow {
  id: number
  name?: string
  original_name?: string
  first_air_date?: string
  status?: string
  next_episode_to_air?: { air_date?: string; episode_number?: number; season_number?: number } | null
}

export interface SeriesApi {
  search: (title: string) => Promise<Envelope<TmdbShow[]>>
  details: (id: number) => Promise<Envelope<TmdbShow>>
  sleep: (ms: number) => Promise<void>
}

const TMDB_GAP_MS = 300
const ENDED = new Set(['Ended', 'Canceled'])

export function tracksSeries(item: AnyItem): boolean {
  if (item.categoryId !== 'series') return false
  if (item.seriesStatus === 'dropped' || item.seriesStatus === 'completed') return false
  return item.seriesFormat !== 'ended' || !!item.nextAiring
}

function localMidnight(isoDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() / 1000
}

export function seriesPatchFor(item: AnyItem, show: TmdbShow, now: number): Partial<AnyItem> {
  const next = show.next_episode_to_air
  const at = next?.air_date ? localMidnight(next.air_date) : null
  if (next && at !== null && next.episode_number) {
    return {
      nextAiring: { episode: next.episode_number, season: next.season_number, airingAt: at, checkedAt: now, dateOnly: true },
      ...(item.airingDay ? {} : { airingDay: weekdayOfTimestamp(at) }),
    }
  }
  if (item.nextAiring || (show.status && ENDED.has(show.status))) return { nextAiring: undefined }
  return {}
}

function pickShow(results: TmdbShow[], item: AnyItem): TmdbShow | undefined {
  const norm = (s?: string) => (s ?? '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '')
  const titles = new Set([item.title, ...(item.alternativeTitles ?? [])].map(norm).filter(Boolean))
  const year = item.startYear?.slice(0, 4)
  const matches = results.filter((r) => titles.has(norm(r.name)) || titles.has(norm(r.original_name)))
  return matches.find((r) => year && r.first_air_date?.startsWith(year)) ?? (matches.length === 1 ? matches[0] : undefined)
}

export async function syncSeriesAiring(items: AnyItem[], api: SeriesApi, opts: { now?: number; maxRequests?: number } = {}): Promise<ItemPatch[]> {
  const now = opts.now ?? Date.now()
  let budget = opts.maxRequests ?? 20
  const patches: ItemPatch[] = []
  for (const item of items.filter(tracksSeries)) {
    if (budget <= 0) break
    let id = item.tmdbId
    const patch: Partial<AnyItem> = {}
    if (!id) {
      if (id === 0 && item.tmdbCheckedAt && now - item.tmdbCheckedAt < LOOKUP_RETRY_MS) continue
      budget--
      const r = await api.search(item.title)
      if (!r.ok) break
      const show = pickShow(r.data, item)
      patch.tmdbId = show?.id ?? 0
      patch.tmdbCheckedAt = now
      id = show?.id
      await api.sleep(TMDB_GAP_MS)
    }
    if (id && (!item.tmdbId || isStale(item, now)) && budget > 0) {
      budget--
      const r = await api.details(id)
      if (r.ok) Object.assign(patch, seriesPatchFor(item, r.data, now))
      await api.sleep(TMDB_GAP_MS)
    }
    if (Object.keys(patch).length > 0) patches.push({ id: item.id, patch })
  }
  return patches
}

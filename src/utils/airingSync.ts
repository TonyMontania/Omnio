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
  return now - next.checkedAt > AIRING_REFRESH_MS || next.airingAt * 1000 <= now
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

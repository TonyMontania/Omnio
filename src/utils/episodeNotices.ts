import type { AnyItem } from '../types'

const DAY = 24 * 60 * 60 * 1000
const MAX_AGE_MS = 3 * DAY
const MAX_SEPARATE = 3

export interface EpisodeNotice { id: string; title: string; episode: number; label: string }

function following(item: AnyItem): boolean {
  if (item.categoryId === 'series') return item.seriesStatus === 'watching'
  if (item.categoryId === 'anime' || item.categoryId === 'donghua') return item.watchStatus === 'watching'
  return false
}

// Episodes of shows you're watching that came out since the last
// check and haven't been announced yet.
export function newEpisodes(items: AnyItem[], now = Date.now()): EpisodeNotice[] {
  const out: EpisodeNotice[] = []
  for (const item of items) {
    const next = item.nextAiring
    if (!next || !following(item) || item.notifiedEpisode === next.episode) continue
    const airedAt = next.airingAt * 1000
    if (airedAt > now || now - airedAt > MAX_AGE_MS) continue
    const label = next.season ? `S${next.season}E${next.episode}` : `Episode ${next.episode}`
    out.push({ id: item.id, title: item.title, episode: next.episode, label })
  }
  return out
}

export function noticeMessages(notices: EpisodeNotice[]): { title: string; body: string }[] {
  if (notices.length <= MAX_SEPARATE) {
    return notices.map((n) => ({ title: n.title, body: `${n.label} is out.` }))
  }
  const names = notices.slice(0, 4).map((n) => n.title).join(', ')
  return [{ title: `${notices.length} new episodes`, body: notices.length > 4 ? `${names} and ${notices.length - 4} more.` : `${names}.` }]
}

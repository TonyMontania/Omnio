// HowLongToBeat per-game lookup. No official API — the endpoint URL
// rotates, so token discovery happens on the Rust side (hltb_search).

import type { Item } from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'

interface Props {
  initialQuery: string
  onApply: (patch: Partial<Item>) => void
  onClose: () => void
}

interface HltbHit {
  game_id: number
  game_name: string
  game_name_date?: number
  game_alias?: string
  game_image?: string
  release_world?: number
  profile_platform?: string
  comp_main?: number       // seconds
  comp_plus?: number       // seconds — main + extras
  comp_100?: number        // seconds — completionist
  invested_co?: number     // seconds — co-op multiplayer
  comp_all_avg?: number
}

function fmtHours(seconds?: number): string {
  if (!seconds || seconds <= 0) return '—'
  const h = seconds / 3600
  return h < 10 ? `${h.toFixed(1)}h` : `${Math.round(h)}h`
}

function toHours(seconds?: number): number | undefined {
  if (!seconds || seconds <= 0) return undefined
  const h = seconds / 3600
  return Math.round(h * 10) / 10
}

export default function HltbFetcher({ initialQuery, onApply, onClose }: Props) {
  const search = async (q: string): Promise<FetcherResult<HltbHit>> => {
    const r = await window.ipcRenderer.invoke('hltb:search', q) as
      | { ok: true; data: { hits: HltbHit[] } }
      | { ok: false; error: string }
    if (!r?.ok) return { ok: false, error: r?.error ?? 'Search failed' }
    return { ok: true, data: r.data.hits ?? [] }
  }

  const apply = async (h: HltbHit) => {
    // Fall through the ladder for multiplayer/co-op-only games that
    // have no main-story data logged.
    const hours = toHours(h.comp_main)
      ?? toHours(h.comp_plus)
      ?? toHours(h.comp_100)
      ?? toHours(h.invested_co)
    if (hours !== undefined) {
      onApply({ hltbHours: hours } as unknown as Partial<Item>)
    }
    onClose()
  }

  return (
    <FetcherModal<HltbHit>
      title="HowLongToBeat"
      hint={
        <>Estimated hours to beat, pulled from howlongtobeat.com. Main story is
        preferred; if the game has none logged, we fall through to Main+Extras,
        then Completionist. Only <code>hltbHours</code> is written — the field
        feeds the "Shortest to beat" backlog sort. No API key. <em>The site rotates its
        API token every few months; if the search errors out, use the bulk
        paste importer as a fallback.</em></>
      }
      placeholder="e.g. Hollow Knight"
      initialQuery={initialQuery}
      onSearch={search}
      onApply={apply}
      renderHit={(h) => ({
        key: h.game_id,
        title: h.game_name,
        sub: [
          h.release_world ? String(h.release_world) : null,
          h.profile_platform || null,
        ].filter(Boolean).join(' · '),
        desc: [
          `Main ${fmtHours(h.comp_main)}`,
          `+Extras ${fmtHours(h.comp_plus)}`,
          `100% ${fmtHours(h.comp_100)}`,
        ].join(' · '),
        thumbUrl: h.game_image ? `https://howlongtobeat.com/games/${h.game_image}` : undefined,
      })}
      onClose={onClose}
    />
  )
}

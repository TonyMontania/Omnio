import type { AnyItem } from '../types'

// Fields the editor form never shows. Saving an edit rebuilds the item
// from the form, so these are copied over from the stored item instead
// of being dropped.
export const SIDECAR_FIELDS = ['pinnedAt', 'anilistId', 'anilistCheckedAt', 'nextAiring', 'tmdbId', 'tmdbCheckedAt', 'notifiedEpisode'] as const satisfies readonly (keyof AnyItem)[]

export function withSidecarFields<T extends AnyItem>(oldItem: AnyItem | undefined, built: T): T {
  if (!oldItem) return built
  const next = { ...built } as Record<string, unknown>
  const old = oldItem as unknown as Record<string, unknown>
  for (const key of SIDECAR_FIELDS) {
    if (old[key] !== undefined && next[key] === undefined) next[key] = old[key]
  }
  return next as T
}

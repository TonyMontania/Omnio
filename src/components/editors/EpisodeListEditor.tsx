// Thin wrapper — Episode maps "watched" onto the shared `done` and enables
// the filler column.

import type { Episode } from '../../types'
import { UnitListEditor } from './UnitListEditor'

// AniDB-style prefix legend: S / C / T / P / O carry meaning. Show it
// as a hover tooltip on the # cell so users don't have to remember
// which letter maps to which category.
function anidbNumberTooltip(number: string): string | undefined {
  const first = number.charAt(0).toUpperCase()
  switch (first) {
    case 'S': return 'Special / OVA'
    case 'C': return 'Credits (opening / ending)'
    case 'T': return 'Trailer / PV'
    case 'P': return 'Parody'
    case 'O': return 'Other'
    default: return undefined
  }
}
// Section header — grouped by the AniDB prefix so the table breaks
// into visually distinct blocks between regulars, specials, credits,
// trailers, parodies and other. Regular numbers return undefined so
// the top block stays untitled (matches user expectation).
function anidbNumberGroup(number: string): string | undefined {
  const first = number.charAt(0).toUpperCase()
  switch (first) {
    case 'S': return 'Specials / OVAs'
    case 'C': return 'Openings & Endings'
    case 'T': return 'Trailers / PVs'
    case 'P': return 'Parodies'
    case 'O': return 'Other'
    default: return undefined
  }
}
const EPISODE_CONFIG = {
  noun: 'episode' as const,
  doneLabel: 'Watched',
  showFiller: true,
  showAirdate: true,
  showLength: true,
  numberPlaceholder: 'Ep #',
  numberTooltip: anidbNumberTooltip,
  numberGroup: anidbNumberGroup,
}

export default function EpisodeListEditor({ episodes, onAdd, onRemove, onUpdate, onToggleWatched, onToggleFiller, onRatingChange, onBulkAdd }: {
  episodes: Episode[]
  onAdd: (e: Omit<Episode, 'id'>) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<Episode>) => void
  onToggleWatched: (id: string) => void
  onToggleFiller: (id: string) => void
  onRatingChange: (id: string, r: number) => void
  onBulkAdd: (count: number) => void
}) {
  return (
    <UnitListEditor
      units={episodes.map((e) => ({ ...e, done: e.watched }))}
      config={EPISODE_CONFIG}
      onAdd={onAdd}
      onRemove={onRemove}
      onUpdate={onUpdate}
      onToggleDone={onToggleWatched}
      onToggleFiller={onToggleFiller}
      onRatingChange={onRatingChange}
      onBulkAdd={onBulkAdd}
    />
  )
}

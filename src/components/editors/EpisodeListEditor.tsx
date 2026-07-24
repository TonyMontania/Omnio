// Thin wrapper — Episode maps "watched" onto the shared `done` and enables
// the filler column.

import type { Episode } from '../../types'
import { UnitListEditor } from './UnitListEditor'

const EPISODE_CONFIG = { noun: 'episode' as const, doneLabel: 'Watched', showFiller: true, numberPlaceholder: 'Ep #' }

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

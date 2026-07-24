// Thin wrapper — Chapter is just a UnitListEditor with the "read" flag
// mapped onto the shared `done` and no filler column.

import type { Chapter } from '../../types'
import { UnitListEditor } from './UnitListEditor'

const CHAPTER_CONFIG = { noun: 'chapter' as const, doneLabel: 'Read', showFiller: false, numberPlaceholder: 'Ch #' }

export default function ChapterListEditor({ chapters, onAdd, onRemove, onUpdate, onToggleRead, onRatingChange, onBulkAdd }: {
  chapters: Chapter[]
  onAdd: (c: Omit<Chapter, 'id'>) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<Chapter>) => void
  onToggleRead: (id: string) => void
  onRatingChange: (id: string, r: number) => void
  onBulkAdd: (count: number) => void
}) {
  return (
    <UnitListEditor
      units={chapters.map((c) => ({ ...c, done: c.read }))}
      config={CHAPTER_CONFIG}
      onAdd={onAdd}
      onRemove={onRemove}
      onUpdate={onUpdate}
      onToggleDone={onToggleRead}
      onRatingChange={onRatingChange}
      onBulkAdd={onBulkAdd}
    />
  )
}

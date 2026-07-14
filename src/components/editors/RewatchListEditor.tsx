// Log of rewatch / reread / replay / listen sessions with date, rating, notes.
// Same shape reused across all "history" features per category.

import { useState } from 'react'
import type { RewatchEntry } from '../../types'
import { StarRatingInput } from '../../StarRating'

export default function RewatchListEditor({ rewatches, onAdd, onRemove, onUpdate, onRatingChange }: {
  rewatches: RewatchEntry[]
  onAdd: (r: Omit<RewatchEntry, 'id'>) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<RewatchEntry>) => void
  onRatingChange: (id: string, r: number) => void
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const handleAdd = () => {
    if (!date) return
    onAdd({ date, notes: notes.trim() || undefined })
    setDate(new Date().toISOString().slice(0, 10)); setNotes('')
  }

  return (
    <div className="track-editor">
      <div className="track-editor-row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="track-name" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button type="button" onClick={handleAdd}>Add rewatch</button>
      </div>
      {rewatches.length > 0 && (
        <table className="track-table">
          <thead>
            <tr>
              <th className="col-num">Date</th>
              <th className="col-rating">Rating</th>
              <th className="col-title">Notes</th>
              <th />
              <th className="col-spacer"></th>
            </tr>
          </thead>
          <tbody>
            {rewatches.map((r) => (
              <tr key={r.id}>
                <td className="col-num">{r.date}</td>
                <td className="col-rating"><StarRatingInput value={r.rating ?? 0} onChange={(v) => onRatingChange(r.id, v)} /></td>
                <td className="col-title"><input className="track-artist-cell" value={r.notes ?? ''} onChange={(e) => onUpdate(r.id, { notes: e.target.value })} placeholder="—" /></td>
                <td><button type="button" className="track-remove" onClick={() => onRemove(r.id)}>✕</button></td>
                <td className="col-spacer"></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

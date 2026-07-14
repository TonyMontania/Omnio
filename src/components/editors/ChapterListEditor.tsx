// Granular chapter list for manga / manhwa / manhua / western comics.
// Bulk-add N rows at once for long series.

import { useState } from 'react'
import type { Chapter } from '../../types'
import { StarRatingInput } from '../../StarRating'

export default function ChapterListEditor({ chapters, onAdd, onRemove, onUpdate, onToggleRead, onRatingChange, onBulkAdd }: {
  chapters: Chapter[]
  onAdd: (c: Omit<Chapter, 'id'>) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<Chapter>) => void
  onToggleRead: (id: string) => void
  onRatingChange: (id: string, r: number) => void
  onBulkAdd: (count: number) => void
}) {
  const [number, setNumber] = useState('')
  const [title, setTitle] = useState('')
  const [bulkCount, setBulkCount] = useState('')

  const handleAdd = () => {
    if (!number.trim() && !title.trim()) return
    onAdd({ number: number.trim() || String(chapters.length + 1), title: title.trim() || undefined })
    setNumber(''); setTitle('')
  }
  const handleBulk = () => {
    const n = parseInt(bulkCount, 10)
    if (isNaN(n) || n <= 0) return
    onBulkAdd(n)
    setBulkCount('')
  }

  return (
    <div className="track-editor">
      <div className="track-editor-row">
        <input className="track-num" placeholder="Ch #" value={number} onChange={(e) => setNumber(e.target.value)} />
        <input className="track-name" placeholder="Chapter title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" onClick={handleAdd}>Add</button>
      </div>
      <div className="track-editor-row">
        <input className="track-num" placeholder="Count" value={bulkCount} onChange={(e) => setBulkCount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        <button type="button" onClick={handleBulk}>Bulk add chapters</button>
      </div>
      {chapters.length > 0 && (
        <table className="track-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th className="col-title">Title</th>
              <th className="col-listened">Read</th>
              <th className="col-rating">Rating</th>
              <th />
              <th className="col-spacer"></th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((c) => (
              <tr key={c.id}>
                <td className="col-num">{c.number}</td>
                <td className="col-title"><input className="track-artist-cell" value={c.title ?? ''} onChange={(e) => onUpdate(c.id, { title: e.target.value })} placeholder="—" /></td>
                <td className="col-listened">
                  <button type="button" className={c.read ? 'track-listened-check active' : 'track-listened-check'} onClick={() => onToggleRead(c.id)}>{c.read ? '✓' : ''}</button>
                </td>
                <td className="col-rating"><StarRatingInput value={c.rating ?? 0} onChange={(v) => onRatingChange(c.id, v)} /></td>
                <td><button type="button" className="track-remove" onClick={() => onRemove(c.id)}>✕</button></td>
                <td className="col-spacer"></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

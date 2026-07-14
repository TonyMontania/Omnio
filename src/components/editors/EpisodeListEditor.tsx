// Granular episode list for anime / donghua. Like ChapterListEditor but adds
// a filler flag per episode.

import { useState } from 'react'
import type { Episode } from '../../types'
import { StarRatingInput } from '../../StarRating'

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
  const [number, setNumber] = useState('')
  const [title, setTitle] = useState('')
  const [bulkCount, setBulkCount] = useState('')

  const handleAdd = () => {
    if (!number.trim() && !title.trim()) return
    onAdd({ number: number.trim() || String(episodes.length + 1), title: title.trim() || undefined })
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
        <input className="track-num" placeholder="Ep #" value={number} onChange={(e) => setNumber(e.target.value)} />
        <input className="track-name" placeholder="Episode title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" onClick={handleAdd}>Add</button>
      </div>
      <div className="track-editor-row">
        <input className="track-num" placeholder="Count" value={bulkCount} onChange={(e) => setBulkCount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        <button type="button" onClick={handleBulk}>Bulk add episodes</button>
      </div>
      {episodes.length > 0 && (
        <table className="track-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th className="col-title">Title</th>
              <th className="col-listened">Watched</th>
              <th className="col-rating">Rating</th>
              <th className="col-fav">Filler</th>
              <th />
              <th className="col-spacer"></th>
            </tr>
          </thead>
          <tbody>
            {episodes.map((ep) => (
              <tr key={ep.id}>
                <td className="col-num">{ep.number}</td>
                <td className="col-title"><input className="track-artist-cell" value={ep.title ?? ''} onChange={(e) => onUpdate(ep.id, { title: e.target.value })} placeholder="—" /></td>
                <td className="col-listened">
                  <button type="button" className={ep.watched ? 'track-listened-check active' : 'track-listened-check'} onClick={() => onToggleWatched(ep.id)}>{ep.watched ? '✓' : ''}</button>
                </td>
                <td className="col-rating"><StarRatingInput value={ep.rating ?? 0} onChange={(v) => onRatingChange(ep.id, v)} /></td>
                <td className="col-fav">
                  <button type="button" className={ep.filler ? 'track-fav active' : 'track-fav'} onClick={() => onToggleFiller(ep.id)}>F</button>
                </td>
                <td><button type="button" className="track-remove" onClick={() => onRemove(ep.id)}>✕</button></td>
                <td className="col-spacer"></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

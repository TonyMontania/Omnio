// Generic granular list used by both ChapterListEditor (manga) and
// EpisodeListEditor (anime). The two used to be near-identical files
// differing only in the noun ("Chapter" vs "Episode"), the done flag name
// ("read" vs "watched") and a filler column (episodes only). The concrete
// wrappers below expose the same public API the app already calls with.

import { useState } from 'react'
import { StarRatingInput } from '../../StarRating'

export interface UnitLike {
  id: string
  number: string
  title?: string
  rating?: number
  done?: boolean
  filler?: boolean
}

export interface UnitListConfig {
  noun: 'chapter' | 'episode'
  doneLabel: string     // "Read" or "Watched"
  showFiller: boolean
  numberPlaceholder: string
}

export function UnitListEditor({
  units, config, onAdd, onRemove, onUpdate, onToggleDone, onToggleFiller, onRatingChange, onBulkAdd,
}: {
  units: UnitLike[]
  config: UnitListConfig
  onAdd: (u: { number: string; title?: string }) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: { title?: string }) => void
  onToggleDone: (id: string) => void
  onToggleFiller?: (id: string) => void
  onRatingChange: (id: string, r: number) => void
  onBulkAdd: (count: number) => void
}) {
  const [number, setNumber] = useState('')
  const [title, setTitle] = useState('')
  const [bulkCount, setBulkCount] = useState('')

  const handleAdd = () => {
    if (!number.trim() && !title.trim()) return
    onAdd({ number: number.trim() || String(units.length + 1), title: title.trim() || undefined })
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
        <input className="track-num" placeholder={config.numberPlaceholder} value={number} onChange={(e) => setNumber(e.target.value)} />
        <input className="track-name" placeholder={`${config.noun.charAt(0).toUpperCase() + config.noun.slice(1)} title (optional)`} value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" onClick={handleAdd}>Add</button>
      </div>
      <div className="track-editor-row">
        <input className="track-num" placeholder="Count" value={bulkCount} onChange={(e) => setBulkCount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        <button type="button" onClick={handleBulk}>Bulk add {config.noun}s</button>
      </div>
      {units.length > 0 && (
        <table className="track-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th className="col-title">Title</th>
              <th className="col-listened">{config.doneLabel}</th>
              <th className="col-rating">Rating</th>
              {config.showFiller && <th className="col-fav">Filler</th>}
              <th />
              <th className="col-spacer"></th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <td className="col-num">{u.number}</td>
                <td className="col-title"><input className="track-artist-cell" value={u.title ?? ''} onChange={(e) => onUpdate(u.id, { title: e.target.value })} placeholder="—" /></td>
                <td className="col-listened">
                  <button type="button" className={u.done ? 'track-listened-check active' : 'track-listened-check'} onClick={() => onToggleDone(u.id)}>{u.done ? '✓' : ''}</button>
                </td>
                <td className="col-rating"><StarRatingInput value={u.rating ?? 0} onChange={(v) => onRatingChange(u.id, v)} /></td>
                {config.showFiller && (
                  <td className="col-fav">
                    <button type="button" className={u.filler ? 'track-fav active' : 'track-fav'} onClick={() => onToggleFiller?.(u.id)}>F</button>
                  </td>
                )}
                <td><button type="button" className="track-remove" onClick={() => onRemove(u.id)}>✕</button></td>
                <td className="col-spacer"></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

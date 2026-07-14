// Album tracklist editor: add tracks (number, title, artist, duration), toggle
// favorite/listened, per-track rating, and a "fill all with main artist" shortcut.

import { useState } from 'react'
import type { Track } from '../../types'
import { StarRatingInput } from '../../StarRating'

export default function TrackListEditor({ tracks, mainArtist, onAdd, onRemove, onToggleFavorite, onRatingChange, onArtistChange, onFillAllArtist, onToggleListened }: {
  tracks: Track[]; mainArtist: string
  onAdd: (t: Omit<Track, 'id'>) => void; onRemove: (id: string) => void
  onToggleFavorite: (id: string) => void; onRatingChange: (id: string, rating: number) => void
  onArtistChange: (id: string, artist: string) => void; onFillAllArtist: () => void
  onToggleListened: (id: string) => void
}) {
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [artist, setArtist] = useState(mainArtist)
  const [duration, setDuration] = useState('')

  const handleAdd = () => {
    if (!name.trim()) return
    onAdd({ number: number.trim(), name: name.trim(), artist: artist.trim() || undefined, duration: duration.trim() })
    setNumber('')
    setName('')
    setDuration('')
  }

  return (
    <div className="track-editor">
      <div className="track-editor-row">
        <input className="track-num" placeholder="01" value={number} onChange={(e) => setNumber(e.target.value)} />
        <input className="track-name" placeholder="Track name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="track-artist-input" placeholder="Artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
        <input className="track-dur" placeholder="3:40" value={duration} onChange={(e) => setDuration(e.target.value)} />
        <button type="button" onClick={handleAdd}>Add</button>
      </div>
      {tracks.length > 0 && (
        <>
          <button type="button" className="fill-artist-btn" onClick={onFillAllArtist}>Fill all with main artist</button>
          <table className="track-table">
            <thead>
              <tr>
                <th className="col-fav"></th>
                <th className="col-num">#</th>
                <th className="col-title">Title</th>
                <th className="col-artist">Artist</th>
                <th className="col-duration">Duration</th>
                <th className="col-rating">Rating</th>
                <th className="col-listened">Listened</th>
                <th />
                <th className="col-spacer"></th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((t) => (
                <tr key={t.id}>
                  <td className="col-fav">
                    <button type="button" className={t.favorite ? 'track-fav active' : 'track-fav'} onClick={() => onToggleFavorite(t.id)}>★</button>
                  </td>
                  <td className="col-num">{t.number}</td>
                  <td className="col-title">{t.name}</td>
                  <td className="col-artist"><input className="track-artist-cell" value={t.artist ?? ''} onChange={(e) => onArtistChange(t.id, e.target.value)} placeholder="—" /></td>
                  <td className="col-duration">{t.duration}</td>
                  <td className="col-rating">
                    <StarRatingInput value={t.rating ?? 0} onChange={(v) => onRatingChange(t.id, v)} />
                  </td>
                  <td className="col-listened">
                    <button type="button" className={t.listened ? 'track-listened-check active' : 'track-listened-check'} onClick={() => onToggleListened(t.id)}>{t.listened ? '✓' : ''}</button>
                  </td>
                  <td><button type="button" className="track-remove" onClick={() => onRemove(t.id)}>✕</button></td>
                  <td className="col-spacer"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

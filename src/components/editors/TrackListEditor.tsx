// Album tracklist editor: add tracks (number, title, artist, duration), toggle
// favorite/listened, per-track rating, per-track lyrics fetcher (lrclib.net,
// no key), and a "fill all with main artist" shortcut.

import { useState } from 'react'
import type { Track } from '../../types'
import { StarRatingInput } from '../../StarRating'

export default function TrackListEditor({ tracks, mainArtist, albumTitle, discCount, onAdd, onRemove, onToggleFavorite, onRatingChange, onArtistChange, onFillAllArtist, onToggleListened, onLyricsChange, onNumberChange, onNameChange, onDurationChange, onDiscChange }: {
  tracks: Track[]; mainArtist: string; albumTitle?: string
  // Free-text number of discs from the parent editor. When it parses
  // to > 1, the tracklist splits into "Disc 1", "Disc 2", … dividers
  // and the add-track row exposes a disc picker.
  discCount?: string
  onAdd: (t: Omit<Track, 'id'>) => void; onRemove: (id: string) => void
  onToggleFavorite: (id: string) => void; onRatingChange: (id: string, rating: number) => void
  onArtistChange: (id: string, artist: string) => void; onFillAllArtist: () => void
  onToggleListened: (id: string) => void
  onLyricsChange?: (id: string, lyrics: string | undefined) => void
  onNumberChange?: (id: string, number: string) => void
  onNameChange?: (id: string, name: string) => void
  onDurationChange?: (id: string, duration: string) => void
  onDiscChange?: (id: string, disc: string) => void
}) {
  // "3 (2 CD + 1 DVD)" → 3, "2 CDs" → 2, "" → 1. Anything unparseable
  // falls back to 1 so the multi-disc UI stays hidden.
  const parsedDiscs = (() => {
    const raw = (discCount ?? '').trim()
    if (!raw) return 1
    const m = /(\d+)/.exec(raw)
    return m ? Math.max(1, Math.min(20, parseInt(m[1], 10))) : 1
  })()
  const isMultiDisc = parsedDiscs > 1
  const [fetching, setFetching] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Track | null>(null)

  const fetchLyrics = async (t: Track) => {
    if (!onLyricsChange) return
    setFetching(t.id)
    const res = await window.ipcRenderer.invoke(
      'lrclib:track',
      t.name,
      (t.artist || mainArtist).trim(),
      albumTitle,
    ) as { ok: true; data: { lyrics: string; synced: boolean } } | { ok: false; error: string }
    setFetching(null)
    if (res.ok) {
      onLyricsChange(t.id, res.data.lyrics)
      setViewing({ ...t, lyrics: res.data.lyrics })
    } else {
      window.dispatchEvent(new CustomEvent('omnio-toast', { detail: `Lyrics: ${res.error}` }))
    }
  }

  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [artist, setArtist] = useState(mainArtist)
  const [duration, setDuration] = useState('')
  const [addDisc, setAddDisc] = useState('1')

  const handleAdd = () => {
    if (!name.trim()) return
    onAdd({
      number: number.trim(),
      name: name.trim(),
      artist: artist.trim() || undefined,
      duration: duration.trim(),
      disc: isMultiDisc ? addDisc : undefined,
    })
    setNumber('')
    setName('')
    setDuration('')
  }

  // Group tracks by disc for multi-disc rendering. Single-disc / undefined
  // → one group keyed by empty string that renders without a divider.
  const groupedTracks: { disc: string; list: Track[] }[] = (() => {
    if (!isMultiDisc) return [{ disc: '', list: tracks }]
    const map = new Map<string, Track[]>()
    for (let d = 1; d <= parsedDiscs; d++) map.set(String(d), [])
    for (const t of tracks) {
      const key = t.disc && map.has(t.disc) ? t.disc : '1'
      map.get(key)!.push(t)
    }
    return Array.from(map.entries()).map(([disc, list]) => ({ disc, list }))
  })()

  const renderTrackRow = (t: Track) => (
    <tr key={t.id}>
      <td className="col-fav">
        <button type="button" className={t.favorite ? 'track-fav active' : 'track-fav'} onClick={() => onToggleFavorite(t.id)}>★</button>
      </td>
      <td className="col-num">
        {onNumberChange
          ? <input className="track-num-cell" value={t.number} onChange={(e) => onNumberChange(t.id, e.target.value)} placeholder="—" />
          : t.number}
      </td>
      <td className="col-title">
        {onNameChange
          ? <input className="track-name-cell" value={t.name} onChange={(e) => onNameChange(t.id, e.target.value)} placeholder="Track name" />
          : t.name}
      </td>
      <td className="col-artist"><input className="track-artist-cell" value={t.artist ?? ''} onChange={(e) => onArtistChange(t.id, e.target.value)} placeholder="—" /></td>
      <td className="col-duration">
        {onDurationChange
          ? <input className="track-dur-cell" value={t.duration ?? ''} onChange={(e) => onDurationChange(t.id, e.target.value)} placeholder="3:40" />
          : t.duration}
      </td>
      {isMultiDisc && onDiscChange && (
        <td className="col-disc">
          <input
            type="number"
            className="track-disc-cell"
            min={1}
            max={parsedDiscs}
            value={t.disc && Number(t.disc) >= 1 && Number(t.disc) <= parsedDiscs ? t.disc : '1'}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d]/g, '')
              const n = Math.max(1, Math.min(parsedDiscs, parseInt(raw || '1', 10)))
              onDiscChange(t.id, String(n))
            }}
          />
        </td>
      )}
      <td className="col-rating">
        <StarRatingInput value={t.rating ?? 0} onChange={(v) => onRatingChange(t.id, v)} />
      </td>
      <td className="col-listened">
        <button type="button" className={t.listened ? 'track-listened-check active' : 'track-listened-check'} onClick={() => onToggleListened(t.id)}>{t.listened ? '✓' : ''}</button>
      </td>
      {onLyricsChange && (
        <td className="col-lyrics">
          {t.lyrics
            ? <button type="button" className="track-lyrics-btn has" onClick={() => setViewing(t)}>View</button>
            : <button type="button" className="track-lyrics-btn" onClick={() => fetchLyrics(t)} disabled={fetching === t.id}>{fetching === t.id ? '…' : 'Fetch'}</button>}
        </td>
      )}
      <td><button type="button" className="track-remove" onClick={() => onRemove(t.id)}>✕</button></td>
      <td className="col-spacer"></td>
    </tr>
  )

  return (
    <div className="track-editor">
      <div className="track-editor-row">
        <input className="track-num" placeholder="01" value={number} onChange={(e) => setNumber(e.target.value)} />
        <input className="track-name" placeholder="Track name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="track-artist-input" placeholder="Artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
        <input className="track-dur" placeholder="3:40" value={duration} onChange={(e) => setDuration(e.target.value)} />
        {isMultiDisc && (
          <select className="track-disc-input" value={addDisc} onChange={(e) => setAddDisc(e.target.value)} title="Which disc this track lives on">
            {Array.from({ length: parsedDiscs }, (_, i) => String(i + 1)).map((d) => (
              <option key={d} value={d}>Disc {d}</option>
            ))}
          </select>
        )}
        <button type="button" onClick={handleAdd}>Add</button>
      </div>
      {tracks.length > 0 && (
        <>
          <button type="button" className="fill-artist-btn" onClick={onFillAllArtist}>Fill all with main artist</button>
          {groupedTracks.map(({ disc, list }) => (
            <div key={disc || 'single'} className="track-disc-group">
              {isMultiDisc && <div className="track-disc-divider">Disc {disc} <span className="track-disc-count">· {list.length} {list.length === 1 ? 'track' : 'tracks'}</span></div>}
              <table className="track-table">
                <thead>
                  <tr>
                    <th className="col-fav"></th>
                    <th className="col-num">#</th>
                    <th className="col-title">Title</th>
                    <th className="col-artist">Artist</th>
                    <th className="col-duration">Duration</th>
                    {isMultiDisc && <th className="col-disc">Disc</th>}
                    <th className="col-rating">Rating</th>
                    <th className="col-listened">Listened</th>
                    {onLyricsChange && <th className="col-lyrics">Lyrics</th>}
                    <th />
                    <th className="col-spacer"></th>
                  </tr>
                </thead>
                <tbody>{list.map(renderTrackRow)}</tbody>
              </table>
            </div>
          ))}
        </>
      )}

      {viewing && onLyricsChange && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: '92vw', maxHeight: '80vh' }}>
            <div className="modal-header">
              <h2>{viewing.name}</h2>
              <button type="button" className="panel-close" onClick={() => setViewing(null)}>✕</button>
            </div>
            <div className="modal-body">
              <pre className="track-lyrics-view">{viewing.lyrics}</pre>
            </div>
            <div className="modal-footer">
              <button type="button" className="ghost-btn" onClick={() => { onLyricsChange(viewing.id, undefined); setViewing(null) }}>Clear lyrics</button>
              <button type="button" className="ghost-btn" onClick={() => fetchLyrics(viewing)}>Re-fetch</button>
              <button type="button" className="primary-btn" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Editor for alternate album editions (Deluxe, Japan, 10th Anniversary…).
// Each edition can carry its own cover and its own set of extra/alternate
// tracks, reusing the same TrackListEditor as the main tracklist.

import { useState, useRef, ChangeEvent } from 'react'
import type { AlbumEdition, Track } from '../../types'
import { assetSrc } from '../../types'
import TrackListEditor from './TrackListEditor'

export default function EditionsEditor({ editions, mainArtist, onChange }: {
  editions: AlbumEdition[]
  mainArtist: string
  onChange: (next: AlbumEdition[]) => void
}) {
  const [name, setName] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const addEdition = () => {
    if (!name.trim()) return
    const id = crypto.randomUUID()
    onChange([...editions, { id, name: name.trim(), tracks: [] }])
    setName('')
    setExpanded(id)
  }
  const removeEdition = (id: string) => onChange(editions.filter((e) => e.id !== id))
  const patchEdition = (id: string, patch: Partial<AlbumEdition>) =>
    onChange(editions.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  const setEditionTracks = (id: string, updater: (tracks: Track[]) => Track[]) => {
    const ed = editions.find((e) => e.id === id)
    if (!ed) return
    patchEdition(id, { tracks: updater(ed.tracks ?? []) })
  }

  const handleCoverFile = (id: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') patchEdition(id, { cover: reader.result }) }
    reader.readAsDataURL(file)
  }

  return (
    <div className="editions-editor">
      <div className="tag-list-input">
        <input
          placeholder="Edition name (Deluxe, Japan, 10th Anniversary…)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEdition() } }}
        />
        <button type="button" onClick={addEdition}>Add edition</button>
      </div>

      {editions.map((ed) => {
        const isOpen = expanded === ed.id
        return (
          <div key={ed.id} className="edition-card">
            <div className="edition-head">
              <button type="button" className="season-expand" onClick={() => setExpanded(isOpen ? null : ed.id)}>{isOpen ? '▾' : '▸'}</button>
              <input
                className="band-member-name"
                value={ed.name}
                onChange={(e) => patchEdition(ed.id, { name: e.target.value })}
                placeholder="Edition name"
              />
              <span className="edition-track-count">{(ed.tracks ?? []).length} tracks</span>
              <button type="button" className="track-remove" onClick={() => removeEdition(ed.id)}>✕</button>
            </div>
            {isOpen && (
              <div className="edition-body">
                <div className="edition-cover-row">
                  {ed.cover
                    ? <img className="edition-cover" src={assetSrc(ed.cover)} alt="" />
                    : <div className="edition-cover placeholder">No cover</div>}
                  <div className="upload-row">
                    <button type="button" className="upload-btn" onClick={() => fileRefs.current[ed.id]?.click()}>Upload cover</button>
                    {ed.cover && <button type="button" className="upload-btn clear" onClick={() => patchEdition(ed.id, { cover: undefined })}>Clear</button>}
                    <input type="file" accept="image/*" ref={(el) => { fileRefs.current[ed.id] = el }} style={{ display: 'none' }} onChange={(e) => handleCoverFile(ed.id, e)} />
                  </div>
                </div>
                <TrackListEditor
                  tracks={ed.tracks ?? []}
                  mainArtist={mainArtist}
                  onAdd={(t) => setEditionTracks(ed.id, (prev) => [...prev, { ...t, id: crypto.randomUUID() }])}
                  onRemove={(tid) => setEditionTracks(ed.id, (prev) => prev.filter((t) => t.id !== tid))}
                  onToggleFavorite={(tid) => setEditionTracks(ed.id, (prev) => prev.map((t) => (t.id === tid ? { ...t, favorite: !t.favorite } : t)))}
                  onRatingChange={(tid, r) => setEditionTracks(ed.id, (prev) => prev.map((t) => (t.id === tid ? { ...t, rating: r || undefined } : t)))}
                  onArtistChange={(tid, a) => setEditionTracks(ed.id, (prev) => prev.map((t) => (t.id === tid ? { ...t, artist: a || undefined } : t)))}
                  onFillAllArtist={() => setEditionTracks(ed.id, (prev) => prev.map((t) => ({ ...t, artist: mainArtist })))}
                  onToggleListened={(tid) => setEditionTracks(ed.id, (prev) => prev.map((t) => (t.id === tid ? { ...t, listened: !t.listened } : t)))}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

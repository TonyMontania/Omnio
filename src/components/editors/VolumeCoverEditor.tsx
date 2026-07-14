// Add/preview/remove volume covers for a manga entry.
// Each cover is uploaded as a data URL that the parent later persists to disk.

import { useState, useRef, ChangeEvent } from 'react'
import type { MangaVolume } from '../../types'
import { assetSrc } from '../../types'

export default function VolumeCoverEditor({ volumes, onAdd, onRemove }: { volumes: MangaVolume[]; onAdd: (v: Omit<MangaVolume, 'id'>) => void; onRemove: (id: string) => void }) {
  const [number, setNumber] = useState('')
  const [cover, setCover] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setCover(reader.result) }
    reader.readAsDataURL(file)
  }

  const handleAdd = () => {
    if (!number.trim() || !cover) return
    onAdd({ number: number.trim(), cover })
    setNumber('')
    setCover('')
  }

  return (
    <div className="volume-editor">
      <div className="volume-add-row">
        <input className="track-num" placeholder="1" value={number} onChange={(e) => setNumber(e.target.value)} />
        <input placeholder="Image URL" value={cover.startsWith('data:') ? '' : cover} onChange={(e) => setCover(e.target.value)} />
        <button type="button" className="upload-btn" onClick={() => fileRef.current?.click()}>Upload</button>
        <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }} onChange={handleFile} />
        <button type="button" onClick={handleAdd}>Add</button>
      </div>
      {volumes.length > 0 && (
        <div className="volume-grid-preview">
          {volumes.map((v) => (
            <div key={v.id} className="volume-preview-card">
              <img src={assetSrc(v.cover)} alt={`Volume ${v.number}`} />
              <span>Vol. {v.number}</span>
              <button type="button" onClick={() => onRemove(v.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

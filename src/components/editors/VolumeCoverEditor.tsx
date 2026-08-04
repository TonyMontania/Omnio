// Add/preview/remove volume covers for a manga entry.
// Each cover is uploaded as a data URL that the parent later persists to disk.

import { useState, useRef } from 'react'
import type { MangaVolume } from '../../types'
import { assetSrc } from '../../types'
import { pickImageToDataUrl } from '../../utils/files'
import ImageLightbox from '../ImageLightbox'

export default function VolumeCoverEditor({ volumes, onAdd, onRemove }: { volumes: MangaVolume[]; onAdd: (v: Omit<MangaVolume, 'id'>) => void; onRemove: (id: string) => void }) {
  const [number, setNumber] = useState('')
  const [cover, setCover] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const handleFile = pickImageToDataUrl(setCover)

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
          {volumes.map((v, i) => (
            <div key={v.id} className="volume-preview-card">
              <img
                src={assetSrc(v.cover)}
                alt={`Volume ${v.number}`}
                onClick={() => setLightboxIndex(i)}
                title="Click to view full size"
                style={{ cursor: 'zoom-in' }}
              />
              <span>Vol. {v.number}</span>
              <button type="button" onClick={() => onRemove(v.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={volumes.map((v) => ({ src: v.cover, label: `Vol. ${v.number}` }))}
          index={lightboxIndex}
          onIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}

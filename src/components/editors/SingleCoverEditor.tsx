// Gallery of single artworks for an album — singles that shipped with their
// own cover art (often before the album). Mirrors the manga VolumeCoverEditor.

import { useState, useRef, ChangeEvent } from 'react'
import type { SingleCover } from '../../types'
import { assetSrc } from '../../types'

export default function SingleCoverEditor({ singles, onAdd, onRemove }: {
  singles: SingleCover[]
  onAdd: (s: Omit<SingleCover, 'id'>) => void
  onRemove: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [year, setYear] = useState('')
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
    if (!name.trim() || !cover) return
    onAdd({ name: name.trim(), year: year.trim() || undefined, cover })
    setName(''); setYear(''); setCover('')
  }

  return (
    <div className="volume-editor">
      <div className="volume-add-row">
        <input className="track-num" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" />
        <input placeholder="Single title" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="upload-btn" onClick={() => fileRef.current?.click()}>Upload</button>
        <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }} onChange={handleFile} />
        <button type="button" onClick={handleAdd}>Add</button>
      </div>
      {cover && <p className="hint">Cover ready — add a title to save this single.</p>}
      {singles.length > 0 && (
        <div className="volume-grid-preview">
          {singles.map((s) => (
            <div key={s.id} className="volume-preview-card">
              <img src={assetSrc(s.cover)} alt={s.name} />
              <span>{s.name}{s.year ? ` (${s.year})` : ''}</span>
              <button type="button" onClick={() => onRemove(s.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Screenshots gallery for a Game. Same on-disk pattern as save files —
// files land under assets/games/screenshots/<title>/<filename>. Editor
// shows thumbnails with per-image caption + delete; detail modal renders
// them read-only as a grid.

import { useRef, useState } from 'react'
import type { Screenshot } from '../../types'
import { assetSrc } from '../../types'
import ImageLightbox from '../ImageLightbox'

type Props = {
  gameTitle: string
  categoryId: string
  screenshots: Screenshot[]
  onChange: (next: Screenshot[]) => void
}

export default function ScreenshotsGallery({ gameTitle, categoryId, screenshots, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const upload = async (files: FileList | File[]) => {
    if (!gameTitle.trim()) { setError('Give the game a title before adding screenshots.'); return }
    setError(null)
    setBusy(true)
    const added: Screenshot[] = []
    try {
      for (const f of Array.from(files)) {
        if (!/^image\//.test(f.type)) continue
        const buf = await f.arrayBuffer()
        const res = await window.ipcRenderer.invoke(
          'screenshot:save',
          categoryId,
          gameTitle.trim(),
          f.name,
          new Uint8Array(buf),
        ) as { ok: boolean; entry?: Screenshot; error?: string }
        if (res.ok && res.entry) added.push(res.entry)
        else setError(res.error ?? `Failed to save ${f.name}`)
      }
      if (added.length > 0) onChange([...added, ...screenshots])
    } finally {
      setBusy(false)
    }
  }

  const remove = async (entry: Screenshot) => {
    const ok = await window.ipcRenderer.invoke('screenshot:delete', entry.path) as boolean
    if (ok) onChange(screenshots.filter((s) => s.id !== entry.id))
  }

  const setCaption = (id: string, caption: string) => {
    onChange(screenshots.map((s) => (s.id === id ? { ...s, caption: caption || undefined } : s)))
  }

  return (
    <div className="field-group">
      <label>Screenshots</label>
      <div
        className={dragOver ? 'screenshots-drop dragover' : 'screenshots-drop'}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false)
          if (e.dataTransfer.files.length > 0) upload(e.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) upload(e.target.files)
            e.target.value = ''
          }}
        />
        <button type="button" className="save-files-add" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? 'Uploading…' : '+ Add screenshots'}
        </button>
        <span className="save-files-hint">Drag images here · multiple accepted · any image format</span>
      </div>
      {error && <p className="save-files-error">{error}</p>}
      {screenshots.length > 0 && (
        <div className="screenshots-grid">
          {screenshots.map((s, i) => (
            <figure key={s.id} className="screenshot-tile">
              <img
                src={assetSrc(s.path)}
                alt={s.caption || s.filename}
                loading="lazy"
                onClick={() => setLightboxIndex(i)}
                title="Click to view full size"
              />
              <input
                className="screenshot-caption"
                placeholder="Caption (optional)"
                value={s.caption ?? ''}
                onChange={(e) => setCaption(s.id, e.target.value)}
              />
              <button type="button" className="screenshot-delete" onClick={() => remove(s)} title="Delete">✕</button>
            </figure>
          ))}
        </div>
      )}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={screenshots.map((s) => ({ src: s.path, caption: s.caption, label: s.filename }))}
          index={lightboxIndex}
          onIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}

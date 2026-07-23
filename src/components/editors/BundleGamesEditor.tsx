// Editor for a game's bundled contents (Metal Gear Solid HD Collection →
// MGS2 + MGS3, Devil May Cry HD → DMC1/2/3, and so on). Each entry keeps
// its own cover and status; the parent Item carries the shared metadata.

import { useRef, useState } from 'react'
import type { BundleGame, GameStatus } from '../../types'
import { assetSrc, GAME_STATUS_OPTIONS } from '../../types'

export default function BundleGamesEditor({
  enabled, onToggle, entries, onChange, onRequestSgdb,
}: {
  enabled: boolean
  onToggle: (v: boolean) => void
  entries: BundleGame[]
  onChange: (next: BundleGame[]) => void
  onRequestSgdb?: (entryId: string, title: string) => void
}) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const name = draft.trim()
    if (!name) return
    onChange([...entries, { id: crypto.randomUUID(), name, status: 'backlog' }])
    setDraft('')
  }
  const patch = (id: string, p: Partial<BundleGame>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...p } : e)))
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id))

  return (
    <div className="field-group">
      <label>Is this a bundle / collection?</label>
      <div className="yesno">
        <button type="button" className={enabled ? 'pill active' : 'pill'} onClick={() => onToggle(true)}>Yes</button>
        <button type="button" className={!enabled ? 'pill active' : 'pill'} onClick={() => onToggle(false)}>No</button>
      </div>
      {enabled && (
        <div className="bundle-list">
          <div className="tag-list-input">
            <input
              placeholder="Game inside the bundle (e.g. Metal Gear Solid 2)"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            />
            <button type="button" onClick={add}>Add</button>
          </div>
          {entries.length > 0 && (
            <div className="bundle-rows">
              {entries.map((e) => (
                <BundleRow key={e.id} entry={e} onPatch={(p) => patch(e.id, p)} onRemove={() => remove(e.id)} onRequestSgdb={onRequestSgdb} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BundleRow({ entry, onPatch, onRemove, onRequestSgdb }: {
  entry: BundleGame
  onPatch: (patch: Partial<BundleGame>) => void
  onRemove: () => void
  onRequestSgdb?: (entryId: string, title: string) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)

  const uploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = String(reader.result)
      const rel = await window.ipcRenderer.invoke('image:save', 'videojuegos', 'bundle', dataUrl)
      if (rel) onPatch({ cover: rel })
    }
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  const cover = assetSrc(entry.cover)
  return (
    <div className="bundle-row">
      <div className="bundle-thumb">
        {cover
          ? <img src={cover} alt="" />
          : <span className="bundle-fallback">{entry.name.charAt(0).toUpperCase()}</span>}
      </div>
      <div className="bundle-body">
        <input
          className="bundle-name"
          value={entry.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Title"
        />
        <div className="bundle-controls">
          <select
            value={entry.status}
            onChange={(e) => onPatch({ status: e.target.value as GameStatus })}
          >
            {GAME_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button type="button" className="upload-btn" onClick={() => fileInput.current?.click()}>
            {entry.cover ? 'Change cover' : 'Upload cover'}
          </button>
          {onRequestSgdb && (
            <button type="button" className="upload-btn" onClick={() => onRequestSgdb(entry.id, entry.name)} title="Fetch from SteamGridDB">↗ SteamGridDB</button>
          )}
          {entry.cover && (
            <button type="button" className="upload-btn clear" onClick={() => onPatch({ cover: undefined })}>Clear</button>
          )}
          <input type="file" accept="image/*" ref={fileInput} style={{ display: 'none' }} onChange={uploadCover} />
        </div>
      </div>
      <button type="button" className="bundle-remove" onClick={onRemove} title="Remove">✕</button>
    </div>
  )
}

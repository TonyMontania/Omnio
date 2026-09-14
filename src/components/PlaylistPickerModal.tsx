// Small picker modal for "Add this item to a playlist". Shows every
// playlist the user has plus an inline "New playlist" affordance so
// they can bottle a new list without leaving the current view.

import { useState } from 'react'
import type { Playlist } from '../types/playlists'

interface Props {
  playlists: Playlist[]
  itemCategoryId: string
  itemId: string
  onClose: () => void
  onPick: (playlistId: string) => void
  onCreate: (name: string) => string | null   // returns the new playlist id or null on empty name
}

export default function PlaylistPickerModal({ playlists, itemCategoryId, itemId, onClose, onPick, onCreate }: Props) {
  const [name, setName] = useState('')
  const alreadyIn = (p: Playlist) => p.entries.some((e) => e.categoryId === itemCategoryId && e.itemId === itemId)
  const createAndPick = () => {
    const id = onCreate(name.trim())
    if (id) { onPick(id); onClose() }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal playlist-picker" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Add to playlist</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </header>
        <ul className="playlist-picker-list">
          {playlists.length === 0 && <li className="empty">You don't have any playlists yet — create one below.</li>}
          {playlists.map((p) => {
            const already = alreadyIn(p)
            return (
              <li
                key={p.id}
                className={already ? 'picked' : ''}
                onClick={() => { if (!already) { onPick(p.id); onClose() } }}
              >
                <span className="playlist-picker-name">{p.name}</span>
                <span className="playlist-picker-count">{p.entries.length} item{p.entries.length === 1 ? '' : 's'}</span>
                {already && <span className="playlist-picker-tag">Already added</span>}
              </li>
            )
          })}
        </ul>
        <div className="playlist-picker-create">
          <input
            placeholder="New playlist name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createAndPick() }}
          />
          <button className="primary-btn" onClick={createAndPick} disabled={!name.trim()}>+ Create and add</button>
        </div>
      </div>
    </div>
  )
}

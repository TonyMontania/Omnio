// Cross-library playlists — hub view.
//
// Two nested screens driven by local state:
//   - list mode: every playlist as a card + a "New" button + inline
//     create form
//   - detail mode: entries of one playlist, reorder with up/down
//     buttons, remove individual entries, and add more via a modal
//     item picker.
//
// Kept as one component so the tab lives at a single specialView key
// and can hand off open-item callbacks to the parent without another
// hop.

import { useMemo, useState } from 'react'
import type { AnyItem } from '../types/entities'
import type { Playlist } from '../types/playlists'
import { playlistAdd, playlistRemove, playlistReorder } from '../types/playlists'
import { CATEGORIES } from '../categories'
import { assetSrc } from '../types'

interface Props {
  playlists: Playlist[]
  items: AnyItem[]
  onChange: (playlists: Playlist[]) => void
  onOpenItem: (item: AnyItem) => void
}

export default function PlaylistsView({ playlists, items, onChange, onOpenItem }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const active = useMemo(
    () => (activeId ? playlists.find((p) => p.id === activeId) ?? null : null),
    [activeId, playlists],
  )
  const itemById = useMemo(() => {
    const m = new Map<string, AnyItem>()
    for (const it of items) m.set(it.id, it)
    return m
  }, [items])

  const createPlaylist = () => {
    const name = newName.trim()
    if (!name) return
    const p: Playlist = {
      id: crypto.randomUUID(),
      name,
      entries: [],
      createdAt: Date.now(),
    }
    onChange([...playlists, p])
    setNewName('')
    setActiveId(p.id)
  }

  const updateActive = (fn: (p: Playlist) => Playlist) => {
    if (!active) return
    onChange(playlists.map((p) => (p.id === active.id ? fn(p) : p)))
  }

  const deleteActive = () => {
    if (!active) return
    onChange(playlists.filter((p) => p.id !== active.id))
    setActiveId(null)
  }

  if (active) {
    const entries = active.entries
    return (
      <div className="playlists-view">
        <div className="playlists-detail-header">
          <button className="secondary-btn" onClick={() => setActiveId(null)}>← Back</button>
          <input
            className="playlists-title-input"
            value={active.name}
            onChange={(e) => updateActive((p) => ({ ...p, name: e.target.value, updatedAt: Date.now() }))}
          />
          <button className="secondary-btn" onClick={() => setPickerOpen(true)}>+ Add items</button>
          <button className="secondary-btn danger" onClick={deleteActive}>Delete</button>
        </div>
        <textarea
          className="playlists-description"
          placeholder="Optional description — what's the idea behind this list?"
          value={active.description ?? ''}
          onChange={(e) => updateActive((p) => ({ ...p, description: e.target.value, updatedAt: Date.now() }))}
        />

        {entries.length === 0 ? (
          <p className="empty">This playlist is empty. Add items with the button above.</p>
        ) : (
          <ol className="playlists-entries">
            {entries.map((entry, i) => {
              const it = itemById.get(entry.itemId)
              const cat = CATEGORIES.find((c) => c.id === entry.categoryId)?.label ?? entry.categoryId
              return (
                <li key={`${entry.categoryId}:${entry.itemId}`} className="playlists-entry">
                  <span className="playlists-entry-pos">{i + 1}</span>
                  <button className="playlists-entry-cover" onClick={() => it && onOpenItem(it)}>
                    {it?.cover
                      ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                      : <span>{(it?.title ?? '?').charAt(0).toUpperCase()}</span>}
                  </button>
                  <div className="playlists-entry-body">
                    <div className="playlists-entry-title" onClick={() => it && onOpenItem(it)}>
                      {it?.title ?? <em>Item deleted</em>}
                    </div>
                    <div className="playlists-entry-meta">{cat}</div>
                  </div>
                  <div className="playlists-entry-actions">
                    <button
                      title="Move up"
                      disabled={i === 0}
                      onClick={() => updateActive((p) => playlistReorder(p, i, i - 1))}
                    >↑</button>
                    <button
                      title="Move down"
                      disabled={i === entries.length - 1}
                      onClick={() => updateActive((p) => playlistReorder(p, i, i + 1))}
                    >↓</button>
                    <button
                      title="Remove from playlist"
                      className="danger"
                      onClick={() => updateActive((p) => playlistRemove(p, entry.categoryId, entry.itemId))}
                    >✕</button>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {pickerOpen && (
          <PlaylistItemPicker
            items={items}
            existing={active.entries}
            onClose={() => setPickerOpen(false)}
            onPick={(it) => updateActive((p) => playlistAdd(p, it.categoryId, it.id))}
          />
        )}
      </div>
    )
  }

  return (
    <div className="playlists-view">
      <div className="playlists-create-bar">
        <input
          placeholder="New playlist name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') createPlaylist() }}
        />
        <button className="primary-btn" onClick={createPlaylist}>+ Create playlist</button>
      </div>
      {playlists.length === 0 ? (
        <p className="empty">No playlists yet. A playlist is an ordered list that can mix items from every library — a rewatch queue, a study reading list, a soundtrack in the order you like it.</p>
      ) : (
        <div className="playlists-grid">
          {playlists.map((p) => (
            <div key={p.id} className="playlists-card" onClick={() => setActiveId(p.id)}>
              <div className="playlists-card-head">
                <h3>{p.name}</h3>
                <span className="playlists-card-count">{p.entries.length}</span>
              </div>
              {p.description && <p className="playlists-card-desc">{p.description}</p>}
              <div className="playlists-card-strip">
                {p.entries.slice(0, 6).map((e) => {
                  const it = itemById.get(e.itemId)
                  return (
                    <div key={`${e.categoryId}:${e.itemId}`} className="playlists-strip-cover">
                      {it?.cover
                        ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                        : <span>{(it?.title ?? '?').charAt(0).toUpperCase()}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// -- Item picker ----------------------------------------------------
//
// Modal shown from a playlist detail's "Add items" button. Lists every
// item across every library with a search box + a category filter,
// and greys out anything already in the playlist so the user sees
// what they've already picked without needing to remember.

interface PickerProps {
  items: AnyItem[]
  existing: { categoryId: string; itemId: string }[]
  onClose: () => void
  onPick: (item: AnyItem) => void
}

function PlaylistItemPicker({ items, existing, onClose, onPick }: PickerProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')

  const existingKeys = useMemo(() => {
    const s = new Set<string>()
    for (const e of existing) s.add(`${e.categoryId}:${e.itemId}`)
    return s
  }, [existing])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((it) => {
      if (category !== 'all' && it.categoryId !== category) return false
      if (q && !it.title.toLowerCase().includes(q)) return false
      return true
    }).slice(0, 200)
  }, [items, search, category])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal playlists-picker" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Add items to playlist</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </header>
        <div className="playlists-picker-tools">
          <input
            autoFocus
            placeholder="Search titles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">Every library</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <ul className="playlists-picker-list">
          {filtered.length === 0 && <li className="empty">No matches.</li>}
          {filtered.map((it) => {
            const key = `${it.categoryId}:${it.id}`
            const already = existingKeys.has(key)
            return (
              <li
                key={key}
                className={already ? 'picked' : ''}
                onClick={() => { if (!already) onPick(it) }}
              >
                <div className="playlists-picker-cover">
                  {it.cover
                    ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                    : <span>{it.title.charAt(0).toUpperCase()}</span>}
                </div>
                <div className="playlists-picker-body">
                  <div className="playlists-picker-title">{it.title}</div>
                  <div className="playlists-picker-cat">{CATEGORIES.find((c) => c.id === it.categoryId)?.label ?? it.categoryId}</div>
                </div>
                {already && <span className="playlists-picker-tag">Added</span>}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
